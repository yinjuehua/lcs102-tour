import * as pc from './vendor/playcanvas.mjs';
import { sceneTransform, waypoints, hotspots, navigation, issueKinds } from './tour-data.js';
import { clamp, allowedMove, angleDelta, validateIssue } from './navigation.js';
import { createAtmosphere } from './atmosphere.js?v=20261027-windows';
import { createRepairs } from './repairs.js';
import { createWindows } from './windows.js?v=20261027-windows';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORAGE_KEY = 'ship-bridge-review-v1';
let app, camera, atmosphere, repairs, oceanWindows, entered = false, loaded = false, fatal = false;
let yaw = waypoints[0].yaw, pitch = waypoints[0].pitch, fov = 65;
let activeWaypoint = 'origin', flight = null, activeDetail = null, showHotspots = true;
const keys = new Set(), heldMovement = new Set();
const markerElements = new Map();
let issues = [], storageAvailable = true, toastTimer, boundaryToastAt = 0;

function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3300);
}

function fail(error) {
  if (fatal) return;
  fatal = true; console.error(error);
  $('loading').hidden = true; $('fatal-error').hidden = false;
  $('error-message').textContent = error?.message || 'Open the local launcher, or try a browser that supports WebGL 2.';
  $('enter-label').textContent = 'Scene could not load';
}

function closePanels() {
  ['detail-panel','review-panel','help-panel'].forEach(id => { $(id).hidden = true; });
  activeDetail = null;
  markerElements.forEach(button => button.setAttribute('aria-expanded', 'false'));
}

function enterTour() {
  if (!loaded || entered) return;
  entered = true; document.body.classList.add('entered');
  $('welcome').setAttribute('aria-hidden', 'true'); $('welcome').inert = true;
  $('tour-bar').hidden = false; $('movement-pad').hidden = false; $('hotspots').hidden = !showHotspots;
  canvas.focus({preventScroll:true});
  toast('Drag to look around · W A S D to move · Select a marker for details');
}

function updateWaypointUI(id) {
  activeWaypoint = id;
  const wp = waypoints.find(w => w.id === id);
  $('location-name').textContent = wp?.label || 'Free exploration';
  document.querySelectorAll('.waypoint').forEach(button => button.setAttribute('aria-current', String(button.dataset.waypoint === id)));
}

function goToView(view, id = null) {
  if (!loaded || !camera) return;
  enterTour();
  const position = camera.getPosition();
  flight = {
    started: performance.now(), duration: reducedMotion ? 0 : 1050,
    from: [position.x, position.y, position.z], to: [...view.position],
    fromYaw: yaw, toYaw: yaw + angleDelta(yaw, view.yaw), fromPitch: pitch, toPitch: view.pitch
  };
  keys.clear(); heldMovement.clear(); updateWaypointUI(id);
}

function goToWaypoint(id) {
  const view = waypoints.find(w => w.id === id);
  if (view) goToView(view, id);
}

function openDetail(id) {
  const item = hotspots.find(h => h.id === id);
  if (!item) return;
  closePanels(); activeDetail = item;
  $('detail-kicker').textContent = item.kicker;
  $('detail-title').textContent = item.title;
  $('detail-body').textContent = item.body;
  $('detail-observation').textContent = item.observation;
  $('detail-panel').hidden = false;
  markerElements.get(id)?.setAttribute('aria-expanded', 'true');
  $('detail-close').focus({preventScroll:true});
}

function createInterface() {
  waypoints.forEach((view, i) => {
    const button = document.createElement('button'); button.className = 'waypoint';
    button.dataset.waypoint = view.id; button.setAttribute('aria-current', String(i === 0));
    const number = document.createElement('span'); number.className = 'waypoint-index'; number.textContent = `0${i+1}`;
    const text = document.createElement('span'); text.textContent = view.label;
    button.append(number, text); button.addEventListener('click', () => goToWaypoint(view.id));
    $('waypoints').append(button);
  });
  hotspots.forEach(item => {
    const button = document.createElement('button'); button.className = 'hotspot'; button.hidden = true;
    button.setAttribute('aria-label', `${item.number} ${item.title}`); button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-controls','detail-panel'); button.textContent = item.number;
    const label = document.createElement('span'); label.className = 'hotspot-label'; label.textContent = item.title;
    button.append(label); button.addEventListener('click', () => openDetail(item.id));
    $('hotspots').append(button); markerElements.set(item.id, button);
  });
}

function readIssues() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    issues = Array.isArray(parsed) ? parsed.filter(validateIssue).slice(0,200) : [];
  } catch { issues = []; storageAvailable = false; }
  renderIssues();
}

function storeIssues() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(issues)); }
  catch { storageAvailable = false; toast('This browser could not save the notes. Export JSON to keep a copy.'); }
  renderIssues();
}

function renderIssues() {
  $('issue-list').replaceChildren(); $('review-total').textContent = issues.length;
  $('issue-count').textContent = issues.length; $('issue-count').hidden = !issues.length;
  $('issues-empty').hidden = issues.length > 0;
  $('export-issues').disabled = !issues.length;
  issues.forEach(issue => {
    const li = document.createElement('li'), top = document.createElement('div'), note = document.createElement('p'), actions = document.createElement('div');
    top.className = 'issue-top'; actions.className = 'issue-actions';
    const type = document.createElement('span'); type.textContent = issueKinds[issue.kind] || 'Other';
    const date = document.createElement('span'); date.textContent = new Date(issue.createdAt).toLocaleString('en-US',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    top.append(type,date); note.textContent = issue.note;
    const revisit = document.createElement('button'); revisit.className = 'text-button'; revisit.textContent = 'Return to this view ↗';
    revisit.addEventListener('click', () => goToView(issue.camera));
    const remove = document.createElement('button'); remove.className = 'text-button issue-delete'; remove.textContent = 'Delete';
    remove.addEventListener('click', () => { issues = issues.filter(i => i.id !== issue.id); storeIssues(); });
    actions.append(revisit,remove); li.append(top,note,actions); $('issue-list').append(li);
  });
}

function bindInterface() {
  $('enter-button').addEventListener('click', enterTour);
  $('home-link').addEventListener('click', e => { e.preventDefault(); if (loaded) { closePanels(); goToWaypoint('origin'); } });
  $('reset-button').addEventListener('click', () => { fov = 65; camera.camera.fov = fov; goToWaypoint('origin'); });
  $('detail-close').addEventListener('click', () => { closePanels(); canvas.focus(); });
  $('detail-view').addEventListener('click', () => { if(activeDetail) goToWaypoint(activeDetail.waypoint); });
  $('review-close').addEventListener('click', () => { closePanels(); canvas.focus(); });
  $('help-close').addEventListener('click', () => { closePanels(); canvas.focus(); });
  $('help-button').addEventListener('click', () => {
    const wasOpen = !$('help-panel').hidden; closePanels(); $('help-panel').hidden = wasOpen;
    if (!wasOpen) $('help-close').focus();
  });
  $('review-button').addEventListener('click', () => {
    if (!loaded) return;
    enterTour(); const wasOpen = !$('review-panel').hidden; closePanels(); $('review-panel').hidden = wasOpen;
    if (!wasOpen) $('issue-note').focus();
  });
  $('hotspot-toggle').addEventListener('click', () => {
    showHotspots = !showHotspots; $('hotspots').hidden = !showHotspots;
    $('hotspot-toggle').setAttribute('aria-pressed', String(showHotspots)); $('hotspot-toggle').textContent = showHotspots ? 'Hide markers' : 'Show markers';
  });
  $('quality').addEventListener('change', () => setQuality($('quality').value));
  $('atmosphere-button').addEventListener('click', () => {
    if(!atmosphere) return;
    const enabled=atmosphere.setEnabled(!atmosphere.enabled);
    $('atmosphere-button').setAttribute('aria-pressed',String(enabled));
    toast(enabled?'Fading in cinematic light and floating dust.':'Fading out the atmosphere.');
  });
  $('ocean-windows').addEventListener('change', () => {
    if (!oceanWindows) return;
    oceanWindows.setEnabled($('ocean-windows').checked);
  });
  $('restoration-button').addEventListener('click', () => {
    if(!repairs) return;
    const enabled=repairs.setEnabled(!repairs.root.enabled);
    $('restoration-button').setAttribute('aria-pressed',String(enabled));
    $('repair-status').hidden=!enabled;
    toast(enabled?'Inferred backing surfaces shown. Hidden details are approximations.':'Inferred repairs hidden. Original splat only.');
  });
  $('fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('Use your browser’s fullscreen command on this device.');
    } catch { toast('Fullscreen could not start. Use your browser’s fullscreen command.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  });
  $('issue-form').addEventListener('submit', e => {
    e.preventDefault(); if (!camera || flight) { toast('Wait for the camera to stop before saving.'); return; }
    const note = $('issue-note').value.trim(); if (!note) { $('issue-note').focus(); return; }
    if (issues.length >= 200) { toast('The 200-note limit has been reached. Export and organize the notes first.'); return; }
    const p = camera.getPosition();
    issues.unshift({id:crypto.randomUUID(),createdAt:new Date().toISOString(),kind:$('issue-kind').value,note,
      camera:{position:[p.x,p.y,p.z],yaw,pitch}, scene:'ship-bridge-control-room', vessel:'LCS-102', source:'World Labs single-panorama reconstruction'});
    storeIssues(); $('issue-note').value = '';
    if (storageAvailable) toast('Note and current view saved.');
  });
  $('export-issues').addEventListener('click', () => {
    if (!issues.length) return;
    const data = {schemaVersion:1,scene:'ship-bridge-control-room',vessel:'LCS-102',exportedAt:new Date().toISOString(),sceneTransform,issues};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = `lcs102-bridge-review-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  $('retry-button').addEventListener('click', () => window.location.reload());
}

function setQuality(value) {
  if (!app) return;
  const ratios = {low:0.8,standard:1,high:Math.min(Math.max(window.devicePixelRatio || 1,1.35),1.7)};
  const ratio=ratios[value] || 1;
  app.resizeCanvas();
  app.graphicsDevice.maxPixelRatio=1;
  app.setCanvasResolution(pc.RESOLUTION_FIXED,Math.round(canvas.clientWidth*ratio),Math.round(canvas.clientHeight*ratio));
  atmosphere?.setQuality(value);
}

function bindNavigation() {
  let pointer = null;
  canvas.addEventListener('pointerdown', e => {
    if (!entered || !loaded || e.button !== 0) return;
    flight = null; pointer = {id:e.pointerId,x:e.clientX,y:e.clientY};
    canvas.setPointerCapture(e.pointerId); canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    yaw -= (e.clientX-pointer.x)*0.14; pitch = clamp(pitch-(e.clientY-pointer.y)*0.12,-68,72);
    pointer.x = e.clientX; pointer.y = e.clientY;
  });
  function endPointer(e) {
    if (pointer?.id === e.pointerId) { if(canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); pointer = null; }
  }
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', e => {
    if (!entered) return; e.preventDefault(); fov = clamp(fov+e.deltaY*.02,45,80); camera.camera.fov = fov;
  },{passive:false});
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePanels(); keys.clear(); heldMovement.clear(); return; }
    const typing = ['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName);
    if (!entered || typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','home'].includes(key)) {
      e.preventDefault(); if (key === 'home') goToWaypoint('origin'); else { keys.add(key); flight = null; }
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); heldMovement.clear(); pointer = null; });
  document.querySelectorAll('[data-move]').forEach(button => {
    button.addEventListener('pointerdown', e => { e.preventDefault(); heldMovement.add(button.dataset.move); button.classList.add('is-held'); button.setPointerCapture(e.pointerId); flight = null; });
    const release = () => { heldMovement.delete(button.dataset.move); button.classList.remove('is-held'); };
    button.addEventListener('pointerup',release); button.addEventListener('pointercancel',release); button.addEventListener('lostpointercapture',release);
    button.addEventListener('keydown', e => { if(e.key===' '||e.key==='Enter'){e.preventDefault();heldMovement.add(button.dataset.move);} });
    button.addEventListener('keyup', () => heldMovement.delete(button.dataset.move));
    button.addEventListener('blur',release);
  });
}

function updateCamera(dt) {
  dt = Math.min(dt,0.05);
  if (flight) {
    const t = flight.duration ? clamp((performance.now()-flight.started)/flight.duration,0,1) : 1;
    const eased = t*t*(3-2*t);
    camera.setPosition(...flight.from.map((v,i)=>v+(flight.to[i]-v)*eased));
    yaw = flight.fromYaw+(flight.toYaw-flight.fromYaw)*eased; pitch = flight.fromPitch+(flight.toPitch-flight.fromPitch)*eased;
    if (t === 1) flight = null;
  } else if (entered) {
    if(keys.has('arrowleft')) yaw += 45*dt;
    if(keys.has('arrowright')) yaw -= 45*dt;
    if(keys.has('arrowup')) pitch = clamp(pitch+35*dt,-68,72);
    if(keys.has('arrowdown')) pitch = clamp(pitch-35*dt,-68,72);
    let forward = Number(keys.has('w')||heldMovement.has('forward'))-Number(keys.has('s')||heldMovement.has('back'));
    let right = Number(keys.has('d')||heldMovement.has('right'))-Number(keys.has('a')||heldMovement.has('left'));
    if (forward || right) {
      const length = Math.hypot(forward,right); forward /= length; right /= length;
      const r = yaw*Math.PI/180, speed = navigation.speed*dt;
      const dx = (-Math.sin(r)*forward+Math.cos(r)*right)*speed, dz = (-Math.cos(r)*forward-Math.sin(r)*right)*speed;
      const p = camera.getPosition(), oldX = p.x, oldZ = p.z;
      const next = allowedMove([p.x,p.y,p.z],dx,dz,navigation.polygon);
      camera.setPosition(...next); updateWaypointUI(null);
      if (Math.hypot(next[0]-oldX,next[2]-oldZ)<speed*.1 && performance.now()-boundaryToastAt>5000) {
        boundaryToastAt = performance.now(); toast('You have reached the preview boundary. Select another viewpoint to continue.');
      }
    }
  }
  camera.setEulerAngles(pitch,yaw,0);
  // Read-only virtual camera pose for reproducible aperture calibration.
  const p=camera.getPosition();
  const view=[p.x,p.y,p.z,yaw,pitch,fov].map(value=>Number(value.toFixed(4))).join(',');
  if(canvas.dataset.view!==view) canvas.dataset.view=view;
}

const projected = new pc.Vec3(), toMarker = new pc.Vec3();
function updateMarkers() {
  if (!entered || !showHotspots) return;
  const cameraPosition = camera.getPosition(), cameraForward = camera.forward;
  const rect = canvas.getBoundingClientRect();
  hotspots.forEach(item => {
    const button = markerElements.get(item.id), point = new pc.Vec3(...item.position);
    toMarker.sub2(point,cameraPosition);
    if (toMarker.dot(cameraForward) <= 0.15) {button.hidden = true;return;}
    camera.camera.worldToScreen(point,projected);
    const x = rect.left+projected.x, y = rect.top+projected.y;
    const visible = x>28 && x<rect.width-28 && y>100 && y<rect.height-130;
    button.hidden = !visible; if (visible) { button.style.left=`${x}px`; button.style.top=`${y}px`; }
  });
}

async function start() {
  createInterface(); bindInterface(); readIssues();
  try {
    app = new pc.Application(canvas,{graphicsDeviceOptions:{antialias:false,alpha:false,powerPreference:'high-performance',deviceTypes:[pc.DEVICETYPE_WEBGL2]}});
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW); app.setCanvasResolution(pc.RESOLUTION_AUTO); setQuality('standard');
    camera = new pc.Entity('Visitor camera');
    camera.addComponent('camera',{clearColor:new pc.Color(0.055,0.095,0.09),fov,nearClip:0.03,farClip:100});
    camera.setPosition(...waypoints[0].position); camera.setEulerAngles(pitch,yaw,0); app.root.addChild(camera);
    camera.camera.toneMapping = pc.TONEMAP_NONE;
    camera.camera.gammaCorrection = pc.GAMMA_SRGB;
    const asset = new pc.Asset('Bridge visual scene','gsplat',{url:'./assets/bridge.compressed.ply'});
    app.assets.add(asset);
    await new Promise((resolve,reject)=>{asset.once('load',resolve);asset.once('error',reject);app.assets.load(asset);});
    const bridge = new pc.Entity('Ship bridge');
    bridge.setPosition(...sceneTransform.position); bridge.setEulerAngles(...sceneTransform.rotation); bridge.setLocalScale(sceneTransform.scale,sceneTransform.scale,sceneTransform.scale);
    bridge.addComponent('gsplat',{asset}); app.root.addChild(bridge);
    repairs=createRepairs(pc,app);
    try {
      oceanWindows=await createWindows(pc,app,camera,{reducedMotion});
      oceanWindows.setEnabled($('ocean-windows').checked);
    } catch(windowError) {
      console.warn('Scenic windows unavailable; keeping original exterior.',windowError);
      $('ocean-windows').checked=false;
      $('ocean-windows').disabled=true;
    }
    try {
      atmosphere=createAtmosphere(pc,app,camera,{reducedMotion});
    } catch(effectError) {
      console.warn('Atmosphere unavailable; using original rendering.',effectError);
      $('atmosphere-button').disabled=true;
      $('atmosphere-button').setAttribute('aria-pressed','false');
      $('atmosphere-button').title='Atmosphere is unavailable on this graphics device';
    }
    bindNavigation();
    app.on('update',dt=>{updateCamera(dt);updateMarkers();oceanWindows?.update(dt);atmosphere?.update(dt);});
    app.graphicsDevice.on('devicelost',()=>{toast('Graphics were interrupted. Waiting for the device to recover.');});
    window.addEventListener('resize',()=>setQuality($('quality').value));
    app.start();
    loaded = true; $('loading').hidden = true; $('enter-button').disabled = false; $('enter-label').textContent = 'Start exploring';
    // Public, read-only diagnostics for local verification; no external requests or analytics.
    window.bridgeTour = {get state(){const p=camera.getPosition();return {loaded,entered,position:[p.x,p.y,p.z],yaw,pitch,activeWaypoint,issueCount:issues.length,engine:pc.version};}};
  } catch(error) {fail(error);}
}
window.addEventListener('unhandledrejection', e=>{if(!loaded)fail(e.reason);else console.error(e.reason);});
start();
