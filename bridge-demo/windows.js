import { windowPanes } from './window-layout.js?v=20261028-polish';
import { installExteriorCutout, roomFootprint } from './exterior-cutout.js?v=20261028-polish';

/** A far sea/sky sphere surrounds the cabin. Transparent glass is composed
 * before the splat pass so indoor equipment always remains in front of it. */
export async function createWindows(pc, app, camera, { bridge, reducedMotion = false } = {}) {
  const asset = new pc.Asset('Scenic ocean and sky', 'texture',
    { url: './assets/ocean-sky-v1.jpg' }, { flipY: false, mipmaps: true });
  app.assets.add(asset);
  await new Promise((resolve, reject) => {
    asset.once('load', resolve); asset.once('error', reject); app.assets.load(asset);
  });
  const texture = asset.resource;
  // The panorama is reflected in the shader at the azimuth seam. Clamping
  // keeps the linear sampler from pulling a mismatched texel from the other
  // side of this non-seamless photograph.
  texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
  texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

  const root = new pc.Entity('Scenic ocean windows');
  app.root.addChild(root);
  // Background sphere -> glass -> cabin splats -> cinematic light. No
  // window-sized opaque image is allowed to paint over indoor geometry.
  const layers = app.scene.layers;
  const worldTransparentIndex=layers.layerList.findIndex((layer,index)=>
    layer.id===pc.LAYERID_WORLD && layers.subLayerList[index]);
  const glassLayer=new pc.Layer({name:'Glass behind cabin splats',transparentSortMode:pc.SORTMODE_MANUAL});
  layers.insertTransparent(glassLayer,worldTransparentIndex<0?0:worldTransparentIndex);
  camera.camera.layers=[...camera.camera.layers,glassLayer.id];

  const vertexGLSL = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv0;
    uniform mat4 matrix_viewProjection;
    uniform mat4 matrix_model;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main(void) {
      vWorld = (matrix_model * vec4(aPosition,1.0)).xyz; vNormal = aNormal; vUv = aUv0;
      gl_Position = matrix_viewProjection * vec4(vWorld, 1.0);
    }`;
  const attributes = { aPosition: pc.SEMANTIC_POSITION, aNormal: pc.SEMANTIC_NORMAL, aUv0: pc.SEMANTIC_TEXCOORD0 };
  const scenery = new pc.ShaderMaterial({
    uniqueName: 'LCS102ContinuousOcean', attributes, vertexGLSL,
    fragmentGLSL: `
      precision highp float;
      uniform sampler2D uOcean;
      uniform vec3 view_position;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUv;
      float mirrorPanoramaU(float u) {
        // Fold the source around its ends so both sides of the atan seam
        // arrive at the same edge texel. This avoids a wide edge-column mix
        // that visibly stretches the ocean near the wrap.
        float folded = fract(u + 0.5);
        return 1.0 - abs(folded * 2.0 - 1.0);
      }
      vec3 sampleOcean(vec2 uv) {
        return texture2D(uOcean, vec2(mirrorPanoramaU(uv.x),
                                      clamp(uv.y, 0.02, 0.98))).rgb;
      }
      vec3 defocusedSea(vec2 uv) {
        // Small, symmetric taps give the water a mild optical defocus while
        // preserving the horizon and avoiding directional smear at the wrap.
        vec2 tap = vec2(0.0030, 0.0020);
        return sampleOcean(uv) * 0.52 +
          (sampleOcean(uv + vec2(tap.x, 0.0)) +
           sampleOcean(uv - vec2(tap.x, 0.0)) +
           sampleOcean(uv + vec2(0.0, tap.y)) +
           sampleOcean(uv - vec2(0.0, tap.y))) * 0.12;
      }
      void main(void) {
        // One direction-based panorama, rather than one repeated picture per
        // pane. Translation preserves a level, effectively distant horizon.
        vec3 ray = normalize(vWorld - view_position);
        float elevation = atan(ray.y, length(ray.xz));
        vec2 uv = vec2(0.5 + atan(ray.x, -ray.z) / 6.2831853,
                       clamp(0.5 - elevation / 1.8, 0.02, 0.98));
        float sea = smoothstep(0.49, 0.56, uv.y);
        uv.x += sea * sin(uTime * 0.12 + uv.y * 58.0) * 0.00065;
        vec3 sharpColor = sampleOcean(uv);
        vec3 color = mix(sharpColor, defocusedSea(uv), sea * 0.9);
        // ShaderMaterial outputs linear color into CameraFrame's HDR target.
        color = pow(color, vec3(2.2));
        float drift = 1.0 + sea * sin(uTime * 0.17 + vWorld.x * 2.8) * 0.018;
        gl_FragColor = vec4(color * drift * 1.06, 1.0);
      }`
  });
  scenery.setParameter('uOcean', texture);
  scenery.setParameter('uTime', 0);
  scenery.blendType = pc.BLEND_NONE;
  scenery.depthTest = true; scenery.depthWrite = false;
  scenery.cull = pc.CULLFACE_FRONT;
  scenery.update();

  const glass = new pc.ShaderMaterial({
    uniqueName: 'LCS102WeatheredWindowGlass', attributes, vertexGLSL,
    fragmentGLSL: `
      precision highp float;
      uniform vec3 view_position;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(void) {
        vec3 view = normalize(view_position - vWorld);
        float facing = abs(dot(view, normalize(vNormal)));
        float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
        float edge = 1.0 - smoothstep(0.0, 0.10,
          min(min(vUv.x, 1.0-vUv.x), min(vUv.y, 1.0-vUv.y)));
        float smear = pow(0.5 + 0.5 * sin(vUv.x*49.0 + sin(vUv.y*13.0)*1.2), 16.0);
        float speck = smoothstep(0.985, 1.0, hash(floor(vUv * vec2(430.0, 260.0))));
        float reflection = pow(max(0.0, 1.0 - abs(vUv.y - (0.77 + vUv.x*0.18))*4.0), 9.0);
        float glimmer = 0.94 + 0.06 * sin(uTime * 0.16 + vWorld.x);
        vec3 tint = mix(vec3(0.40, 0.55, 0.53), vec3(0.93, 0.88, 0.71), reflection);
        float alpha = 0.038 + fresnel*0.24 + edge*0.08 + smear*0.014 + speck*0.075;
        gl_FragColor = vec4(tint * glimmer, alpha);
      }`
  });
  glass.setParameter('uTime', 0);
  glass.blendType = pc.BLEND_NORMAL;
  glass.depthWrite = false; glass.depthTest = true;
  glass.cull = pc.CULLFACE_NONE;
  glass.update();

  const meshes = [];
  // A dark, inferred under-deck cap stops the exterior sphere being visible
  // through missing floor Gaussians. It sits below the observed deck (-0.16m
  // at its lowest) and preserves the original floor, hatch and equipment.
  const footprint=roomFootprint();
  const deckPositions=footprint.flatMap(([x,z])=>[x,-0.20,z]);
  const deckIndices=[];
  for(let i=1;i<footprint.length-1;i++)deckIndices.push(0,i,i+1);
  const deckMesh=new pc.Mesh(app.graphicsDevice);
  deckMesh.setPositions(deckPositions);deckMesh.setIndices(deckIndices);deckMesh.update();meshes.push(deckMesh);
  const deckMaterial=new pc.ShaderMaterial({
    uniqueName:'LCS102DarkUnderDeckBacking',attributes,vertexGLSL,
    fragmentGLSL:`
      precision highp float;
      varying vec3 vWorld;
      void main(void) {
        float grain=fract(sin(dot(floor(vWorld.xz*180.0),vec2(12.9898,78.233)))*43758.5453);
        vec3 paint=mix(vec3(0.006,0.009,0.008),vec3(0.010,0.015,0.012),grain);
        gl_FragColor=vec4(paint,1.0);
      }`
  });
  deckMaterial.blendType=pc.BLEND_NONE;deckMaterial.depthTest=true;deckMaterial.depthWrite=true;
  deckMaterial.cull=pc.CULLFACE_NONE;deckMaterial.update();
  const deck=new pc.Entity('Inferred opaque under-deck cap');
  const deckInstance=new pc.MeshInstance(deckMesh,deckMaterial,deck);
  deckInstance.castShadow=false;deckInstance.receiveShadow=false;
  deck.addComponent('render',{meshInstances:[deckInstance],layers:[pc.LAYERID_WORLD]});root.addChild(deck);
  const makePaneMesh = (pane, inwardOffset) => {
    const positions = [], normals = [];
    for (const corner of pane.corners) {
      positions.push(...corner.map((value, i) => value + pane.inward[i] * inwardOffset));
      normals.push(...pane.inward);
    }
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(positions); mesh.setNormals(normals);
    mesh.setUvs(0, [0,0, 1,0, 1,1, 0,1]);
    mesh.setIndices([0,1,2, 0,2,3]); mesh.update(); meshes.push(mesh);
    return mesh;
  };
  const sphereMesh=pc.createSphere(app.graphicsDevice,{radius:40,latitudeBands:32,longitudeBands:64});
  meshes.push(sphereMesh);
  const sphere=new pc.Entity('Sea and sky sphere outside the entire cabin');
  sphere.setPosition(0,1.6626,0);
  const sphereInstance=new pc.MeshInstance(sphereMesh,scenery,sphere);
  sphereInstance.castShadow=false; sphereInstance.receiveShadow=false;
  sphere.addComponent('render',{meshInstances:[sphereInstance],layers:[pc.LAYERID_WORLD]});
  root.addChild(sphere);
  windowPanes.forEach((pane,index)=>{
    const entity=new pc.Entity(`${pane.name} transparent glass`);
    const instance=new pc.MeshInstance(makePaneMesh(pane,0.006),glass,entity);
    instance.castShadow=false; instance.receiveShadow=false;
    instance.drawOrder=index;
    entity.addComponent('render',{meshInstances:[instance],layers:[glassLayer.id]});
    root.addChild(entity);
  });
  const cutout=installExteriorCutout(bridge.gsplat);
  let time = 0, destroyed = false;
  return {
    root,
    get enabled() { return root.enabled; },
    setEnabled(value) { root.enabled = Boolean(value); cutout.setEnabled(root.enabled); return root.enabled; },
    update(dt) {
      if (destroyed || !root.enabled || reducedMotion) return;
      time += Math.min(Math.max(dt, 0), 0.1);
      scenery.setParameter('uTime', time); glass.setParameter('uTime', time);
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      camera.camera.layers = camera.camera.layers.filter(id => id !== glassLayer.id);
      cutout.destroy(); root.destroy(); app.scene.layers.remove(glassLayer);
      scenery.destroy(); glass.destroy(); deckMaterial.destroy(); meshes.forEach(mesh => mesh.destroy());
      app.assets.remove(asset); asset.unload();
    }
  };
}
