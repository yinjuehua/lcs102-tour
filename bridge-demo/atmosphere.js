import { windowPanes } from './window-layout.js?v=20261027-windows';

/**
 * Strong, switchable cinematic presentation effects for the reconstructed
 * bridge. The bright parts are deliberately world anchored: window light
 * moves with the camera because it is real scene geometry, not a fixed white
 * screen overlay. The scene remains legible, but the effect favors a dreamy
 * bloom veil that can hide thin AI reconstruction seams.
 */
export function createAtmosphere(pc, app, camera, { reducedMotion = false } = {}) {
  const frame = new pc.CameraFrame(app, camera.camera);

  // Keep the scene in HDR until the final composite. This makes the window
  // cards and airborne motes feed CameraFrame's bloom instead of clipping to
  // the back-buffer's 0..1 range first.
  frame.rendering.toneMapping = pc.TONEMAP_ACES2 ?? pc.TONEMAP_ACES ?? pc.TONEMAP_FILMIC;
  frame.rendering.samples = 1;
  frame.rendering.renderTargetScale = 1;
  frame.grading.enabled = true;
  frame.grading.brightness = 1.045;
  frame.grading.contrast = 0.92;
  frame.grading.saturation = 1.13;
  frame.grading.tint.set(1.045, 1.012, 0.965);
  frame.bloom.threshold = 0.78;
  frame.bloom.blurLevel = 16;
  frame.bloom.intensity = 0.40;
  frame.fringing.intensity = 0.24;
  frame.vignette.intensity = 0.13;
  frame.vignette.inner = 0.54;
  frame.vignette.outer = 1.04;
  frame.vignette.curvature = 0.35;
  frame.vignette.color.set(0.035, 0.012, 0.004);
  frame.colorEnhance.enabled = true;
  frame.colorEnhance.shadows = -0.08;
  frame.colorEnhance.highlights = 0.2;
  frame.colorEnhance.vibrance = 0.16;
  frame.colorEnhance.midtones = 0.05;
  frame.colorEnhance.dehaze = -0.035;
  // TAA is intentionally off: the splat already has soft temporal edges and
  // the moving light should not leave a second trail behind it.
  frame.taa.enabled = false;
  frame.rendering.sharpness = 0;
  frame.dof.enabled = false;
  frame.volumetricFog.enabled = false;
  frame.update();

  const effectRoot = new pc.Entity('Cinematic window light');
  effectRoot.setLocalPosition(0, 0, 0);
  effectRoot.setLocalEulerAngles(0, 0, 0);
  effectRoot.setLocalScale(1, 1, 1);
  app.root.addChild(effectRoot);

  const quadMesh = (specs, name) => {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    specs.forEach((spec, quadIndex) => {
      const a = [
        spec[1][0] - spec[0][0],
        spec[1][1] - spec[0][1],
        spec[1][2] - spec[0][2]
      ];
      const b = [
        spec[2][0] - spec[0][0],
        spec[2][1] - spec[0][1],
        spec[2][2] - spec[0][2]
      ];
      const normal = [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
      const normalLength = Math.hypot(normal[0], normal[1], normal[2]) || 1;
      normal[0] /= normalLength;
      normal[1] /= normalLength;
      normal[2] /= normalLength;
      spec.forEach((point) => {
        positions.push(point[0], point[1], point[2]);
        normals.push(normal[0], normal[1], normal[2]);
      });
      // Every quad uses the same local coordinates so the fragment shader can
      // shape a soft edge and animate cloud shadows over its surface.
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      const n = quadIndex * 4;
      indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    });
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.name = name;
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uvs);
    mesh.setIndices(indices);
    mesh.update();
    return mesh;
  };

  const addMesh = (name, mesh, material, drawOrder = 180) => {
    const entity = new pc.Entity(name);
    const meshInstance = new pc.MeshInstance(mesh, material, entity);
    meshInstance.castShadow = false;
    meshInstance.receiveShadow = false;
    // Shader vertex motion is deliberately tiny, but these are translucent
    // cards and dust quads: stale AABBs or a frustum edge should never make a
    // light pop out while the camera turns. A stable draw bucket also keeps
    // the transparent groups ordered while their depth changes.
    meshInstance.cull = false;
    meshInstance.drawBucket = Math.max(0, Math.min(255, Math.round(drawOrder)));
    meshInstance.drawOrder = drawOrder;
    entity.addComponent('render', { meshInstances: [meshInstance] });
    effectRoot.addChild(entity);
    return entity;
  };

  const materialDefaults = (material) => {
    material.blendType = pc.BLEND_ADDITIVEALPHA;
    material.depthTest = true;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
    material.setParameter('uTime', 0);
    material.setParameter('uOpacity', 1);
    material.setParameter('uIntensity', 1);
    material.update();
    return material;
  };

  // Share calibrated apertures with the ocean and glass. Light is slightly
  // cabinward of the opaque pane so it cannot depth-fight the background.
  const windowCards = windowPanes.map(pane => pane.corners.map(corner =>
    corner.map((value, axis) => value + pane.inward[axis] * 0.018)));

  const windowMaterial = materialDefaults(new pc.ShaderMaterial({
    uniqueName: 'LCS102CinematicWindowGlow',
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aNormal: pc.SEMANTIC_NORMAL,
      aUv0: pc.SEMANTIC_TEXCOORD0
    },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aUv0;
      uniform mat4 matrix_viewProjection;
      uniform float uTime;
      varying vec2 vUv;
      varying float vPhase;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      void main(void) {
        vec3 p = aPosition;
        float phase = fract(sin(dot(aPosition, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        // A nearly imperceptible wobble avoids a dead, pasted-on card while
        // preserving the opening's world anchor and silhouette.
        p.y += sin(uTime * 0.16 + phase * 17.0) * 0.003;
        p.x += cos(uTime * 0.11 + phase * 23.0) * 0.002;
        gl_Position = matrix_viewProjection * vec4(p, 1.0);
        vUv = aUv0;
        vPhase = phase;
        vWorldPosition = p;
        vNormal = aNormal;
      }`,
    fragmentGLSL: `
      precision highp float;
      uniform vec3 uColor;
      uniform vec3 uCameraPosition;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uIntensity;
      varying vec2 vUv;
      varying float vPhase;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      float viewFade(vec3 worldPosition, vec3 normal) {
        vec3 toCamera = uCameraPosition - worldPosition;
        float distanceToCamera = max(length(toCamera), 0.0001);
        float nearFade = smoothstep(0.035, 0.24, distanceToCamera);
        float farFade = 1.0 - smoothstep(14.0, 26.0, distanceToCamera);
        float normalLength = max(length(normal), 0.0001);
        float facing = abs(dot(normal / normalLength, toCamera / distanceToCamera));
        float angleFade = smoothstep(0.035, 0.22, facing);
        return nearFade * farFade * angleFade;
      }
      void main(void) {
        vec2 p = vUv - 0.5;
        float edgeX = smoothstep(0.0, 0.17, vUv.x) * (1.0 - smoothstep(0.83, 1.0, vUv.x));
        float edgeY = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.86, 1.0, vUv.y));
        float edge = edgeX * edgeY;
        float cloudWave = 0.5 + 0.5 * sin(
          uTime * 0.22 + vUv.x * 7.2 + sin(uTime * 0.075 + vUv.y * 4.0 + vPhase * 8.0) * 1.1
        );
        float cloud = mix(0.52, 1.0, smoothstep(0.12, 0.88, cloudWave));
        float center = 1.0 - 0.18 * min(1.0, dot(p, p) * 3.0);
        float alpha = edge * cloud * center * uOpacity * viewFade(vWorldPosition, vNormal);
        gl_FragColor = vec4(uColor * uIntensity * (0.82 + cloud * 0.48), alpha);
      }`
  }));
  windowMaterial.setParameter('uColor', new Float32Array([1.0, 0.71, 0.35]));
  const windowMesh = quadMesh(windowCards, 'LCS102 warm window cards');
  addMesh('Warm window openings', windowMesh, windowMaterial, 170);

  // Make tapered, world-space ribbons from the window run into the room. The
  // animated shader is a cheap cloud-shadow approximation: the bright bands
  // drift slowly even when reduced motion freezes the time parameter.
  const shafts = windowPanes.map((pane, index) => {
    const [bl, br, tr, tl] = windowCards[index];
    const inward = pane.inward;
    const reach = 1.15;
    const near = corner => [corner[0] + inward[0] * reach,
      Math.max(0.76, corner[1] - 0.30), corner[2] + inward[2] * reach];
    return [near(bl), near(br), tr, tl];
  });
  const shaftMaterial = materialDefaults(new pc.ShaderMaterial({
    uniqueName: 'LCS102SlowWindowLightShafts',
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aNormal: pc.SEMANTIC_NORMAL,
      aUv0: pc.SEMANTIC_TEXCOORD0
    },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aUv0;
      uniform mat4 matrix_viewProjection;
      uniform float uTime;
      varying vec2 vUv;
      varying float vPhase;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      void main(void) {
        vec3 p = aPosition;
        float phase = fract(sin(dot(aPosition, vec3(21.17, 47.23, 11.91))) * 19341.73);
        // The light itself stays anchored at the window; only the soft sheet
        // flexes by a few millimeters as if clouds or water were outside.
        p.x += sin(uTime * 0.19 + p.y * 1.8 + phase * 12.0) * 0.012;
        p.z += cos(uTime * 0.15 + p.x * 2.0 + phase * 9.0) * 0.010;
        gl_Position = matrix_viewProjection * vec4(p, 1.0);
        vUv = aUv0;
        vPhase = phase;
        vWorldPosition = p;
        vNormal = aNormal;
      }`,
    fragmentGLSL: `
      precision highp float;
      uniform vec3 uColor;
      uniform vec3 uCameraPosition;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uIntensity;
      varying vec2 vUv;
      varying float vPhase;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      float viewFade(vec3 worldPosition, vec3 normal) {
        vec3 toCamera = uCameraPosition - worldPosition;
        float distanceToCamera = max(length(toCamera), 0.0001);
        float nearFade = smoothstep(0.035, 0.24, distanceToCamera);
        float farFade = 1.0 - smoothstep(14.0, 26.0, distanceToCamera);
        float normalLength = max(length(normal), 0.0001);
        float facing = abs(dot(normal / normalLength, toCamera / distanceToCamera));
        float angleFade = smoothstep(0.035, 0.22, facing);
        return nearFade * farFade * angleFade;
      }
      void main(void) {
        float edge = smoothstep(0.0, 0.19, vUv.x) * (1.0 - smoothstep(0.81, 1.0, vUv.x));
        float fade = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
        float waveA = 0.5 + 0.5 * sin(uTime * 0.18 + vUv.y * 8.7 + vPhase * 6.2831);
        float waveB = 0.5 + 0.5 * sin(uTime * 0.11 - vUv.y * 4.3 + vUv.x * 6.0 + vPhase * 2.1);
        float cloud = 0.42 + 0.58 * smoothstep(0.18, 0.92, waveA * 0.62 + waveB * 0.38);
        float alpha = edge * fade * cloud * uOpacity * viewFade(vWorldPosition, vNormal);
        gl_FragColor = vec4(uColor * uIntensity * (0.68 + cloud * 0.62), alpha);
      }`
  }));
  shaftMaterial.setParameter('uColor', new Float32Array([1.0, 0.55, 0.20]));
  const shaftMesh = quadMesh(shafts, 'LCS102 tapered window light shafts');
  addMesh('Slow warm light shafts', shaftMesh, shaftMaterial, 175);

  // Window-centered lens glints make the bloom unmistakable without using a
  // fixed post-process overlay. Their movement is therefore tied to the
  // world-space panes as the viewer turns.
  const glintCards = windowCards.filter((_, index) => index === 0 || index === 2).map(corners => {
    const center = corners.reduce((sum, c) => sum.map((v, axis) => v+c[axis]/4), [0,0,0]);
    const height = Math.abs(corners[3][1] - corners[0][1]);
    return corners.map(c => [
      center[0] + (c[0]-center[0])*0.92,
      center[1] + height*0.27 + (c[1]-center[1])*1.15,
      center[2] + (c[2]-center[2])*0.92
    ]);
  });
  const glintMaterial = materialDefaults(new pc.ShaderMaterial({
    uniqueName: 'LCS102WindowLensGlints',
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aNormal: pc.SEMANTIC_NORMAL,
      aUv0: pc.SEMANTIC_TEXCOORD0
    },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aUv0;
      uniform mat4 matrix_viewProjection;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      void main(void) {
        gl_Position = matrix_viewProjection * vec4(aPosition, 1.0);
        vUv = aUv0;
        vWorldPosition = aPosition;
        vNormal = aNormal;
      }`,
    fragmentGLSL: `
      precision highp float;
      uniform float uTime;
      uniform vec3 uCameraPosition;
      uniform float uOpacity;
      uniform float uIntensity;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      float viewFade(vec3 worldPosition, vec3 normal) {
        vec3 toCamera = uCameraPosition - worldPosition;
        float distanceToCamera = max(length(toCamera), 0.0001);
        float nearFade = smoothstep(0.035, 0.24, distanceToCamera);
        float farFade = 1.0 - smoothstep(14.0, 26.0, distanceToCamera);
        float normalLength = max(length(normal), 0.0001);
        float facing = abs(dot(normal / normalLength, toCamera / distanceToCamera));
        float angleFade = smoothstep(0.035, 0.22, facing);
        return nearFade * farFade * angleFade;
      }
      void main(void) {
        vec2 p = (vUv - 0.5) * vec2(2.0, 2.0);
        float radius = length(p);
        float core = exp(-radius * radius * 5.8);
        float crossX = exp(-abs(p.x) * 14.0) * exp(-abs(p.y) * 1.8);
        float crossY = exp(-abs(p.y) * 18.0) * exp(-abs(p.x) * 2.0);
        float flare = core * 0.78 + crossX * 0.26 + crossY * 0.20;
        float pulse = 0.80 + 0.20 * sin(uTime * 0.24 + p.x * 3.0 + p.y * 2.0);
        float alpha = flare * pulse * uOpacity * viewFade(vWorldPosition, vNormal);
        gl_FragColor = vec4(uColor * uIntensity, alpha);
      }`
  }));
  glintMaterial.setParameter('uColor', new Float32Array([1.0, 0.72, 0.40]));
  glintMaterial.setParameter('uIntensity', 1.85);
  const glintMesh = quadMesh(glintCards, 'LCS102 window lens glints');
  addMesh('Window lens glints', glintMesh, glintMaterial, 185);

  // Airborne particulate is intentionally more visible than the previous 72
  // point pass. These are tiny world-space billboards, depth-tested against
  // the splat, so they read as luminous motes in the incoming beams rather
  // than a flat screen texture.
  const count = 220;
  const dustPositions = [];
  const dustUvs = [];
  const dustIndices = [];
  let randomState = 102;
  const random = () => {
    randomState = (1664525 * randomState + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const center = [-1.24 + random() * 2.72, 0.92 + random() * 1.78, -2.18 + random() * 2.55];
    for (const uv of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      dustPositions.push(...center);
      dustUvs.push(...uv);
    }
    const n = i * 4;
    dustIndices.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const dustMesh = new pc.Mesh(app.graphicsDevice);
  dustMesh.name = 'LCS102 airborne light dust';
  dustMesh.setPositions(dustPositions);
  dustMesh.setUvs(0, dustUvs);
  dustMesh.setIndices(dustIndices);
  dustMesh.update();
  const dustMaterial = materialDefaults(new pc.ShaderMaterial({
    uniqueName: 'LCS102AirborneLightDust',
    attributes: { aPosition: pc.SEMANTIC_POSITION, aUv0: pc.SEMANTIC_TEXCOORD0 },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec2 aUv0;
      uniform mat4 matrix_viewProjection;
      uniform vec3 uRight;
      uniform vec3 uUp;
      uniform float uTime;
      varying vec2 vUv;
      varying float vFade;
      varying vec3 vWorldPosition;
      void main(void) {
        float seed = fract(sin(dot(aPosition, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vec3 center = aPosition;
        center.x += sin(uTime * 0.14 + seed * 31.4) * 0.045;
        center.y += sin(uTime * 0.09 + seed * 17.0) * 0.055;
        center.z += cos(uTime * 0.11 + seed * 23.0) * 0.035;
        float size = mix(0.0018, 0.0058, seed);
        vec3 world = center + (uRight * aUv0.x + uUp * aUv0.y) * size;
        gl_Position = matrix_viewProjection * vec4(world, 1.0);
        vUv = aUv0;
        vFade = mix(0.18, 0.58, seed) * (0.82 + 0.18 * sin(uTime * 0.25 + seed * 40.0));
        vWorldPosition = world;
      }`,
    fragmentGLSL: `
      precision highp float;
      uniform vec3 uCameraPosition;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vFade;
      varying vec3 vWorldPosition;
      void main(void) {
        float radius = dot(vUv, vUv);
        float distanceToCamera = max(length(uCameraPosition - vWorldPosition), 0.0001);
        float nearFade = smoothstep(0.035, 0.24, distanceToCamera);
        float farFade = 1.0 - smoothstep(14.0, 26.0, distanceToCamera);
        float discFade = 1.0 - smoothstep(0.82, 1.0, radius);
        float alpha = exp(-radius * 4.6) * discFade * vFade * uOpacity * nearFade * farFade;
        gl_FragColor = vec4(1.46, 0.95, 0.43, alpha);
      }`
  }));
  const right = new Float32Array([1, 0, 0]);
  const up = new Float32Array([0, 1, 0]);
  dustMaterial.setParameter('uRight', right);
  dustMaterial.setParameter('uUp', up);
  const dustEntity = new pc.Entity('220 airborne light motes');
  const dustInstance = new pc.MeshInstance(dustMesh, dustMaterial, dustEntity);
  dustInstance.castShadow = false;
  dustInstance.receiveShadow = false;
  dustInstance.cull = false;
  dustInstance.drawBucket = 190;
  dustInstance.drawOrder = 190;
  dustEntity.addComponent('render', { meshInstances: [dustInstance] });
  effectRoot.addChild(dustEntity);

  const materials = [windowMaterial, shaftMaterial, glintMaterial, dustMaterial];
  const dynamicMaterials = [windowMaterial, shaftMaterial, glintMaterial, dustMaterial];
  const initialCameraPosition = camera.getPosition();
  const cameraPosition = new Float32Array([
    initialCameraPosition.x,
    initialCameraPosition.y,
    initialCameraPosition.z
  ]);
  materials.forEach((material) => material.setParameter('uCameraPosition', cameraPosition));

  let enabled = true;
  let destroyed = false;
  let time = 0;
  let quality = 'standard';
  let effectEnvelope = 0;
  let effectTarget = 1;

  const profiles = {
    low: {
      bloom: 0.26, blur: 9, scale: 0.76,
      windowOpacity: 0.18, shaftOpacity: 0.36, glintOpacity: 0.52, dustOpacity: 0.46
    },
    standard: {
      bloom: 0.40, blur: 16, scale: 1,
      windowOpacity: 0.26, shaftOpacity: 0.48, glintOpacity: 0.72, dustOpacity: 0.72
    },
    high: {
      bloom: 0.52, blur: 20, scale: 1,
      windowOpacity: 0.34, shaftOpacity: 0.58, glintOpacity: 0.90, dustOpacity: 0.88
    }
  };

  const standardProfile = { ...profiles.standard };
  let qualityCurrent = { ...standardProfile };
  let qualityFrom = { ...standardProfile };
  let qualityTo = { ...standardProfile };
  let qualityProgress = 1;

  const fadeDuration = reducedMotion ? 0.28 : 1.2;
  const qualityDuration = reducedMotion ? 0.24 : 0.72;
  const frameGrade = {
    brightness: 1.045,
    contrast: 0.92,
    saturation: 1.13,
    tint: [1.045, 1.012, 0.965],
    fringing: 0.24,
    vignette: 0.13,
    colorEnhance: { shadows: -0.08, highlights: 0.2, vibrance: 0.16, midtones: 0.05, dehaze: -0.035 }
  };

  function setUniform(material, name, value) {
    material.setParameter(name, value);
  }

  const lerp = (from, to, amount) => from + (to - from) * amount;
  const smooth = (amount) => amount * amount * (3 - 2 * amount);

  function applyVisualState() {
    const profile = qualityCurrent;
    const amount = smooth(effectEnvelope);
    frame.bloom.intensity = profile.bloom * amount;
    frame.bloom.blurLevel = Math.max(1, Math.round(profile.blur));
    // The app already controls resolution; do not reallocate HDR targets every
    // frame while a quality profile eases between values.
    frame.rendering.renderTargetScale = 1;
    frame.grading.enabled = true;
    frame.grading.brightness = lerp(1, frameGrade.brightness, amount);
    frame.grading.contrast = lerp(1, frameGrade.contrast, amount);
    frame.grading.saturation = lerp(1, frameGrade.saturation, amount);
    frame.grading.tint.set(
      lerp(1, frameGrade.tint[0], amount),
      lerp(1, frameGrade.tint[1], amount),
      lerp(1, frameGrade.tint[2], amount)
    );
    frame.fringing.intensity = frameGrade.fringing * amount;
    frame.vignette.intensity = frameGrade.vignette * amount;
    frame.colorEnhance.enabled = true;
    frame.colorEnhance.shadows = frameGrade.colorEnhance.shadows * amount;
    frame.colorEnhance.highlights = frameGrade.colorEnhance.highlights * amount;
    frame.colorEnhance.vibrance = frameGrade.colorEnhance.vibrance * amount;
    frame.colorEnhance.midtones = frameGrade.colorEnhance.midtones * amount;
    frame.colorEnhance.dehaze = frameGrade.colorEnhance.dehaze * amount;
    setUniform(windowMaterial, 'uOpacity', profile.windowOpacity * amount);
    setUniform(shaftMaterial, 'uOpacity', profile.shaftOpacity * amount);
    setUniform(glintMaterial, 'uOpacity', profile.glintOpacity * amount);
    setUniform(dustMaterial, 'uOpacity', profile.dustOpacity * amount);
  }

  function advanceQuality(dt) {
    if (qualityProgress >= 1) return false;
    qualityProgress = Math.min(1, qualityProgress + dt / qualityDuration);
    const amount = smooth(qualityProgress);
    const fields = ['bloom', 'blur', 'scale', 'windowOpacity', 'shaftOpacity', 'glintOpacity', 'dustOpacity'];
    fields.forEach((field) => {
      qualityCurrent[field] = lerp(qualityFrom[field], qualityTo[field], amount);
    });
    return true;
  }

  function setQuality(value) {
    const nextQuality = profiles[value] ? value : 'standard';
    if (nextQuality === quality && qualityProgress >= 1) return;
    quality = nextQuality;
    qualityFrom = { ...qualityCurrent };
    qualityTo = { ...profiles[quality] };
    qualityProgress = 0;
    applyVisualState();
    if (frame.enabled) frame.update();
  }

  function setEnabled(value) {
    if (destroyed) return false;
    enabled = Boolean(value);
    effectTarget = enabled ? 1 : 0;
    if (enabled) {
      effectRoot.enabled = true;
      if (!frame.enabled) frame.enabled = true;
      applyVisualState();
      frame.update();
    }
    return enabled;
  }

  function update(dt) {
    if (destroyed) return;
    dt = Math.min(Math.max(dt, 0), 0.05);
    const envelopeBefore = effectEnvelope;
    const qualityBefore = qualityProgress;
    if (effectTarget > effectEnvelope) {
      effectEnvelope = Math.min(effectTarget, effectEnvelope + dt / fadeDuration);
    } else if (effectTarget < effectEnvelope) {
      effectEnvelope = Math.max(effectTarget, effectEnvelope - dt / fadeDuration);
    }
    const qualityChanged = advanceQuality(dt);
    if (effectEnvelope !== envelopeBefore || qualityChanged || qualityProgress !== qualityBefore) {
      applyVisualState();
      if (frame.enabled) frame.update();
    }

    // Keep the same HDR/ACES display path at zero effect strength. Dropping
    // CameraFrame here changes both tone mapping and custom-material gamma,
    // causing a final visible pop even after every light has faded to zero.
    // Bloom and all stylization fade to neutral; geometry can stop rendering.
    effectRoot.enabled = effectEnvelope > 0 || effectTarget > 0;

    if (effectEnvelope === 0 && effectTarget === 0) return;
    if (!reducedMotion) time += dt;
    const p = camera.getPosition();
    cameraPosition[0] = p.x; cameraPosition[1] = p.y; cameraPosition[2] = p.z;
    materials.forEach((material) => setUniform(material, 'uCameraPosition', cameraPosition));
    const r = camera.right;
    const u = camera.up;
    right[0] = r.x; right[1] = r.y; right[2] = r.z;
    up[0] = u.x; up[1] = u.y; up[2] = u.z;
    setUniform(dustMaterial, 'uRight', right);
    setUniform(dustMaterial, 'uUp', up);
    dynamicMaterials.forEach((material) => setUniform(material, 'uTime', time));
  }

  applyVisualState();
  frame.update();
  return {
    setEnabled,
    setQuality,
    update,
    get enabled() { return enabled; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      enabled = false;
      effectTarget = 0;
      effectEnvelope = 0;
      effectRoot.enabled = false;
      frame.enabled = false;
      frame.destroy();
      effectRoot.destroy();
      materials.forEach((material) => material.destroy());
    }
  };
}
