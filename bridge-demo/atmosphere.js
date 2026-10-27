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
    const uvs = [];
    const indices = [];
    specs.forEach((spec, quadIndex) => {
      spec.forEach((point) => {
        positions.push(point[0], point[1], point[2]);
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

  // The reference hotspot is [1.5, 1.8, -1.3]. Additional cards follow the
  // curved window run around z ~= -2.2 and the right-hand wall at x ~= 1.7.
  // They are intentionally close to the inferred openings so depth testing
  // lets foreground splats occlude the light instead of painting the screen.
  const windowCards = [];
  const addWindowCard = (x0, x1, z, y0 = 1.25, y1 = 2.24) => {
    windowCards.push([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);
  };
  addWindowCard(1.14, 1.84, -1.38);
  addWindowCard(-1.43, -0.75, -2.22);
  addWindowCard(-0.68, 0.04, -2.22);
  addWindowCard(0.10, 0.83, -2.22);
  addWindowCard(0.89, 1.63, -2.22);
  // Right-hand side panes are planes in the x-constant wall.
  windowCards.push(
    [[1.72, 1.25, -1.32], [1.72, 1.25, -0.61], [1.72, 2.24, -0.61], [1.72, 2.24, -1.32]]
  );

  const windowMaterial = materialDefaults(new pc.ShaderMaterial({
    uniqueName: 'LCS102CinematicWindowGlow',
    attributes: { aPosition: pc.SEMANTIC_POSITION, aUv0: pc.SEMANTIC_TEXCOORD0 },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec2 aUv0;
      uniform mat4 matrix_viewProjection;
      uniform float uTime;
      varying vec2 vUv;
      varying float vPhase;
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
      }`,
    fragmentGLSL: `
      precision highp float;
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uIntensity;
      varying vec2 vUv;
      varying float vPhase;
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
        float alpha = edge * cloud * center * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor * uIntensity * (0.82 + cloud * 0.48), alpha);
      }`
  }));
  windowMaterial.setParameter('uColor', new Float32Array([1.0, 0.51, 0.16]));
  const windowMesh = quadMesh(windowCards, 'LCS102 warm window cards');
  addMesh('Warm window openings', windowMesh, windowMaterial, 170);

  // Make tapered, world-space ribbons from the window run into the room. The
  // animated shader is a cheap cloud-shadow approximation: the bright bands
  // drift slowly even when reduced motion freezes the time parameter.
  const shaft = (farA, farB, nearA, nearB, y0 = 1.06, y1 = 2.28) => [[
    [nearA[0], y0, nearA[1]], [nearB[0], y0, nearB[1]],
    [farB[0], y1, farB[1]], [farA[0], y1, farA[1]]
  ]];
  const shafts = [
    ...shaft([1.10, -1.39], [1.86, -1.39], [0.06, -0.44], [0.78, -0.44], 0.98, 2.32),
    ...shaft([-1.45, -2.23], [-0.75, -2.23], [-0.10, -0.50], [0.40, -0.50], 1.02, 2.26),
    ...shaft([-0.68, -2.23], [0.06, -2.23], [0.06, -0.20], [0.59, -0.20], 1.12, 2.30),
    ...shaft([0.13, -2.23], [0.84, -2.23], [0.44, -0.12], [0.94, -0.12], 1.00, 2.22),
    ...shaft([0.90, -2.23], [1.64, -2.23], [0.80, 0.04], [1.22, 0.04], 1.08, 2.30),
    ...shaft([1.72, -1.30], [1.72, -0.58], [0.76, -0.18], [1.00, 0.31], 1.15, 2.25)
  ];
  const shaftMaterial = materialDefaults(new pc.ShaderMaterial({
    uniqueName: 'LCS102SlowWindowLightShafts',
    attributes: { aPosition: pc.SEMANTIC_POSITION, aUv0: pc.SEMANTIC_TEXCOORD0 },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec2 aUv0;
      uniform mat4 matrix_viewProjection;
      uniform float uTime;
      varying vec2 vUv;
      varying float vPhase;
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
      }`,
    fragmentGLSL: `
      precision highp float;
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uIntensity;
      varying vec2 vUv;
      varying float vPhase;
      void main(void) {
        float edge = smoothstep(0.0, 0.19, vUv.x) * (1.0 - smoothstep(0.81, 1.0, vUv.x));
        float fade = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
        float waveA = 0.5 + 0.5 * sin(uTime * 0.18 + vUv.y * 8.7 + vPhase * 6.2831);
        float waveB = 0.5 + 0.5 * sin(uTime * 0.11 - vUv.y * 4.3 + vUv.x * 6.0 + vPhase * 2.1);
        float cloud = 0.42 + 0.58 * smoothstep(0.18, 0.92, waveA * 0.62 + waveB * 0.38);
        float alpha = edge * fade * cloud * uOpacity;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(uColor * uIntensity * (0.68 + cloud * 0.62), alpha);
      }`
  }));
  shaftMaterial.setParameter('uColor', new Float32Array([1.0, 0.30, 0.075]));
  const shaftMesh = quadMesh(shafts, 'LCS102 tapered window light shafts');
  addMesh('Slow warm light shafts', shaftMesh, shaftMaterial, 175);

  // Window-centered lens glints make the bloom unmistakable without using a
  // fixed post-process overlay. Their movement is therefore tied to the
  // world-space panes as the viewer turns.
  const glintCenters = [
    [1.50, 1.73, -1.365],
    [-1.08, 1.74, -2.205], [-0.32, 1.74, -2.205], [0.47, 1.74, -2.205],
    [1.26, 1.74, -2.205], [1.735, 1.72, -0.98]
  ];
  const glintCards = glintCenters.map(([x, y, z], index) => {
    const width = index === 0 ? 0.95 : 0.74;
    const height = index === 0 ? 1.10 : 0.92;
    return [
      [x - width * 0.5, y - height * 0.5, z], [x + width * 0.5, y - height * 0.5, z],
      [x + width * 0.5, y + height * 0.5, z], [x - width * 0.5, y + height * 0.5, z]
    ];
  });
  // The right-wall glint needs an x-constant plane rather than the x/y plane
  // used by the forward window row.
  glintCards[glintCards.length - 1] = [
    [1.735, 1.27, -1.32], [1.735, 1.27, -0.64],
    [1.735, 2.17, -0.64], [1.735, 2.17, -1.32]
  ];
  const glintMaterial = materialDefaults(new pc.ShaderMaterial({
    uniqueName: 'LCS102WindowLensGlints',
    attributes: { aPosition: pc.SEMANTIC_POSITION, aUv0: pc.SEMANTIC_TEXCOORD0 },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec2 aUv0;
      uniform mat4 matrix_viewProjection;
      uniform float uTime;
      varying vec2 vUv;
      void main(void) {
        gl_Position = matrix_viewProjection * vec4(aPosition, 1.0);
        vUv = aUv0;
      }`,
    fragmentGLSL: `
      precision highp float;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uIntensity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main(void) {
        vec2 p = (vUv - 0.5) * vec2(2.0, 2.0);
        float radius = length(p);
        float core = exp(-radius * radius * 5.8);
        float crossX = exp(-abs(p.x) * 14.0) * exp(-abs(p.y) * 1.8);
        float crossY = exp(-abs(p.y) * 18.0) * exp(-abs(p.x) * 2.0);
        float flare = core * 0.78 + crossX * 0.26 + crossY * 0.20;
        float pulse = 0.80 + 0.20 * sin(uTime * 0.24 + p.x * 3.0 + p.y * 2.0);
        float alpha = flare * pulse * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor * uIntensity, alpha);
      }`
  }));
  glintMaterial.setParameter('uColor', new Float32Array([1.0, 0.62, 0.30]));
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
      }`,
    fragmentGLSL: `
      precision highp float;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vFade;
      void main(void) {
        float radius = dot(vUv, vUv);
        if (radius > 1.0) discard;
        float alpha = exp(-radius * 4.6) * vFade * uOpacity;
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
  dustInstance.drawOrder = 190;
  dustEntity.addComponent('render', { meshInstances: [dustInstance] });
  effectRoot.addChild(dustEntity);

  const materials = [windowMaterial, shaftMaterial, glintMaterial, dustMaterial];
  const dynamicMaterials = [windowMaterial, shaftMaterial, glintMaterial, dustMaterial];
  let enabled = true;
  let destroyed = false;
  let time = 0;
  let quality = 'standard';

  const profiles = {
    low: {
      bloom: 0.26, blur: 9, scale: 0.76,
      windowOpacity: 0.56, shaftOpacity: 0.45, glintOpacity: 0.62, dustOpacity: 0.46
    },
    standard: {
      bloom: 0.40, blur: 16, scale: 1,
      windowOpacity: 0.72, shaftOpacity: 0.60, glintOpacity: 0.92, dustOpacity: 0.72
    },
    high: {
      bloom: 0.52, blur: 20, scale: 1,
      windowOpacity: 0.82, shaftOpacity: 0.70, glintOpacity: 1.08, dustOpacity: 0.88
    }
  };

  function setUniform(material, name, value) {
    material.setParameter(name, value);
  }

  function setQuality(value) {
    quality = profiles[value] ? value : 'standard';
    const profile = profiles[quality];
    frame.bloom.intensity = profile.bloom;
    frame.bloom.blurLevel = profile.blur;
    frame.rendering.renderTargetScale = profile.scale;
    setUniform(windowMaterial, 'uOpacity', profile.windowOpacity);
    setUniform(shaftMaterial, 'uOpacity', profile.shaftOpacity);
    setUniform(glintMaterial, 'uOpacity', profile.glintOpacity);
    setUniform(dustMaterial, 'uOpacity', profile.dustOpacity);
    if (enabled) frame.update();
  }

  function setEnabled(value) {
    if (destroyed) return false;
    enabled = Boolean(value);
    effectRoot.enabled = enabled;
    frame.enabled = enabled;
    if (enabled) frame.update();
    return enabled;
  }

  function update(dt) {
    if (destroyed || !enabled) return;
    if (!reducedMotion) time += Math.min(dt, 0.05);
    const r = camera.right;
    const u = camera.up;
    right[0] = r.x; right[1] = r.y; right[2] = r.z;
    up[0] = u.x; up[1] = u.y; up[2] = u.z;
    setUniform(dustMaterial, 'uRight', right);
    setUniform(dustMaterial, 'uUp', up);
    dynamicMaterials.forEach((material) => setUniform(material, 'uTime', time));
  }

  setQuality('standard');
  return {
    setEnabled,
    setQuality,
    update,
    get enabled() { return enabled; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      enabled = false;
      effectRoot.enabled = false;
      frame.destroy();
      effectRoot.destroy();
      materials.forEach((material) => material.destroy());
    }
  };
}
