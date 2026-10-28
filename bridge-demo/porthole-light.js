// World-space porthole sunlight. Coordinates are in the same ground-aligned
// frame as the bridge splat; no texture or external asset is required.
export const portholeLightConfig = Object.freeze({
  center: Object.freeze([-0.341, 1.37, -1.99]),
  sourceCenter: Object.freeze([-0.35, 1.37, -2.01]),
  inward: Object.freeze([0.462, 0, 0.887]),
  innerRadius: 0.12,
  outerRadius: 0.14,
  beamLength: 1.5
});

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, n) => [a[0] * n, a[1] * n, a[2] * n];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a) => {
  const n = length(a) || 1;
  return scale(a, 1 / n);
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];

const vertexGLSL = `
  attribute vec3 aPosition;
  attribute vec2 aUv0;
  uniform mat4 matrix_viewProjection;
  varying vec2 vUv;
  void main(void) {
    gl_Position = matrix_viewProjection * vec4(aPosition, 1.0);
    vUv = aUv0;
  }`;

function circleMesh(pc, device, center, axisX, axisY, radius, segments, name, meshes) {
  const positions = [center[0], center[1], center[2]];
  const uvs = [0, 0];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const c = Math.cos(theta), s = Math.sin(theta);
    const point = add(center, add(scale(axisX, c * radius), scale(axisY, s * radius)));
    positions.push(point[0], point[1], point[2]);
    uvs.push(c, s);
    const next = i + 1 === segments ? 1 : i + 2;
    indices.push(0, i + 1, next);
  }
  const mesh = new pc.Mesh(device);
  mesh.name = name;
  mesh.setPositions(positions); mesh.setUvs(0, uvs); mesh.setIndices(indices); mesh.update();
  meshes.push(mesh);
  return mesh;
}

function ribbonMesh(pc, device, center, normal, side, up, meshes) {
  const start = add(center, scale(normal, 0.01));
  const end = add(add(center, scale(normal, portholeLightConfig.beamLength)), [0, -0.22, 0]);
  const specs = [
    { sideOffset: -0.075, verticalOffset: 0.045, startWidth: 0.035, endWidth: 0.22 },
    { sideOffset: 0.055, verticalOffset: -0.025, startWidth: 0.028, endWidth: 0.17 },
    { sideOffset: 0.16, verticalOffset: 0.075, startWidth: 0.022, endWidth: 0.13 }
  ];
  const positions = [], uvs = [], indices = [];
  specs.forEach((spec, i) => {
    const startCenter = add(add(start, scale(side, spec.sideOffset)), scale(up, spec.verticalOffset));
    const endCenter = add(add(end, scale(side, spec.sideOffset * 1.45)), scale(up, spec.verticalOffset * 0.4));
    const points = [
      add(startCenter, scale(side, -spec.startWidth)),
      add(startCenter, scale(side, spec.startWidth)),
      add(endCenter, scale(side, spec.endWidth)),
      add(endCenter, scale(side, -spec.endWidth))
    ];
    points.forEach((point) => positions.push(point[0], point[1], point[2]));
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    const n = i * 4;
    indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
  });
  const mesh = new pc.Mesh(device);
  mesh.name = 'LCS102 porthole sunlight ribbons';
  mesh.setPositions(positions); mesh.setUvs(0, uvs); mesh.setIndices(indices); mesh.update();
  meshes.push(mesh);
  return mesh;
}

function configureMaterial(pc, material) {
  material.blendType = pc.BLEND_ADDITIVEALPHA;
  material.depthTest = true;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
  material.setParameter('uTime', 0);
  material.setParameter('uStrength', 0);
  material.setParameter('uIntensity', 1);
  material.setParameter('uOpacity', 1);
  material.update();
  return material;
}

function makeMaterial(pc, uniqueName, fragmentGLSL) {
  return configureMaterial(pc, new pc.ShaderMaterial({ uniqueName, attributes: {
    aPosition: pc.SEMANTIC_POSITION, aUv0: pc.SEMANTIC_TEXCOORD0
  }, vertexGLSL, fragmentGLSL }));
}

export function createPortholeLight(pc, app, {layerId=pc.LAYERID_WORLD}={}) {
  if (!pc || !app?.root || !app.graphicsDevice) {
    throw new TypeError('createPortholeLight(pc, app) requires PlayCanvas and an application');
  }

  const root = new pc.Entity('Strong circular porthole sunlight');
  root.enabled = false;
  app.root.addChild(root);
  const meshes = [];
  const materials = [];
  const center = portholeLightConfig.center;
  const normal = normalize(portholeLightConfig.inward);
  const axisY = [0, 1, 0];
  const axisX = normalize(cross(axisY, normal));
  const beamMesh = ribbonMesh(pc, app.graphicsDevice, center, normal, axisX, axisY, meshes);
  const coreCenter = add(center, scale(normal, 0.002));
  const coreMesh = circleMesh(pc, app.graphicsDevice, coreCenter, axisX, axisY,
    portholeLightConfig.innerRadius, 40, 'LCS102 porthole white-hot core', meshes);
  const haloMesh = circleMesh(pc, app.graphicsDevice, add(center, scale(normal, 0.004)), axisX, axisY,
    portholeLightConfig.outerRadius * 2.6, 48, 'LCS102 porthole broad halo', meshes);
  const starMesh = circleMesh(pc, app.graphicsDevice, add(center, scale(normal, 0.006)), axisX, axisY,
    portholeLightConfig.outerRadius * 2.2, 40, 'LCS102 porthole lens star', meshes);

  const coreMaterial = makeMaterial(pc, 'LCS102PortholeWhiteHotCore', `
    precision highp float;
    uniform float uStrength;
    uniform float uIntensity;
    varying vec2 vUv;
    void main(void) {
      float r = length(vUv);
      float edge = 1.0 - smoothstep(0.74, 1.0, r);
      float center = 1.0 - 0.08 * smoothstep(0.0, 0.74, r);
      float alpha = edge * center * uStrength;
      vec3 color = mix(vec3(1.0, 1.0, 0.98), vec3(1.0, 0.74, 0.40), smoothstep(0.15, 1.0, r));
      gl_FragColor = vec4(color * uIntensity, alpha);
    }`);
  coreMaterial.setParameter('uColor', new Float32Array([1, 0.86, 0.58]));
  materials.push(coreMaterial);

  const haloMaterial = makeMaterial(pc, 'LCS102PortholeWarmHalo', `
    precision highp float;
    uniform float uStrength;
    uniform float uIntensity;
    uniform float uTime;
    varying vec2 vUv;
    void main(void) {
      float r = length(vUv);
      float disc = 1.0 - smoothstep(0.08, 1.0, r);
      float ring = (1.0 - smoothstep(0.24, 0.58, r)) * smoothstep(0.02, 0.18, r);
      float slow = 0.93 + 0.07 * sin(uTime * 0.18 + r * 4.0);
      float alpha = (disc * 0.18 + ring * 0.24) * uStrength * slow;
      gl_FragColor = vec4(vec3(1.0, 0.38, 0.08) * uIntensity, alpha);
    }`);
  materials.push(haloMaterial);

  const starMaterial = makeMaterial(pc, 'LCS102PortholeCenteredLensStar', `
    precision highp float;
    uniform float uStrength;
    uniform float uIntensity;
    uniform float uTime;
    varying vec2 vUv;
    void main(void) {
      vec2 p = vUv;
      float r = length(p);
      float core = exp(-r * r * 8.0);
      float rays = exp(-abs(p.x) * 19.0) * exp(-abs(p.y) * 2.2)
                 + exp(-abs(p.y) * 19.0) * exp(-abs(p.x) * 2.2);
      float slow = 0.94 + 0.06 * sin(uTime * 0.16 + 0.4);
      float alpha = (core * 0.52 + rays * 0.12) * uStrength * slow;
      gl_FragColor = vec4(vec3(1.0, 0.72, 0.40) * uIntensity, alpha);
    }`);
  materials.push(starMaterial);

  const ribbonMaterial = makeMaterial(pc, 'LCS102PortholeSunlightRibbons', `
    precision highp float;
    uniform float uStrength;
    uniform float uIntensity;
    uniform float uTime;
    uniform float uViewFade;
    varying vec2 vUv;
    void main(void) {
      float across = smoothstep(0.0, 0.20, vUv.x) * (1.0 - smoothstep(0.80, 1.0, vUv.x));
      float along = smoothstep(0.0, 0.07, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
      float drift = 0.88 + 0.12 * sin(uTime * 0.20 + vUv.y * 5.1 + vUv.x * 3.0);
      float alpha = across * along * drift * uStrength * uViewFade * 0.30;
      gl_FragColor = vec4(vec3(1.0, 0.42, 0.10) * uIntensity, alpha);
    }`);
  materials.push(ribbonMaterial);

  const addRender = (name, mesh, material, drawOrder) => {
    const entity = new pc.Entity(name);
    const instance = new pc.MeshInstance(mesh, material, entity);
    instance.castShadow = false; instance.receiveShadow = false; instance.drawOrder = drawOrder;
    instance.drawBucket = drawOrder;
    instance.cull = false;
    entity.addComponent('render', { meshInstances: [instance],layers:[layerId] });
    root.addChild(entity);
  };
  addRender('Porthole light ribbons', beamMesh, ribbonMaterial, 175);
  addRender('Porthole broad sunlight halo', haloMesh, haloMaterial, 180);
  addRender('Porthole centered lens star', starMesh, starMaterial, 185);
  addRender('Porthole white-hot aperture', coreMesh, coreMaterial, 190);

  const profiles = {
    low: { core: 5.5, halo: 1.55, star: 1.65, ribbon: 1.0 },
    standard: { core: 7.0, halo: 1.9, star: 2.0, ribbon: 1.2 },
    high: { core: 8.0, halo: 2.15, star: 2.25, ribbon: 1.35 }
  };
  let time = 0, destroyed = false, active = false;

  function update(dt, camera, strength, quality = 'standard') {
    if (destroyed) return;
    const amount = clamp01(strength);
    const profile = profiles[quality] || profiles.standard;
    time += Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
    const position = camera?.getPosition?.();
    const cameraPoint = position ? [position.x, position.y, position.z] : [0, 1.6626, 0];
    const toCamera = normalize([cameraPoint[0] - center[0], cameraPoint[1] - center[1], cameraPoint[2] - center[2]]);
    const distance = length([cameraPoint[0] - center[0], cameraPoint[1] - center[1], cameraPoint[2] - center[2]]);
    const distanceFade = clamp01((distance - 0.08) / 0.22);
    const planeNormal = normalize(cross(normal, axisX));
    const viewFade = clamp01((Math.abs(dot(toCamera, planeNormal)) - 0.03) / 0.22);
    // Keep the aperture itself white-hot in the intended review view. Only the
    // shallow ribbons need the angle fade; applying it to the core would make
    // the strongest source unexpectedly dim when the camera is near eye level.
    const envelope = amount * distanceFade * 0.5;
    active = envelope > 0.001;
    root.enabled = active;
    if (!active) return;
    coreMaterial.setParameter('uStrength', envelope); coreMaterial.setParameter('uIntensity', profile.core);
    haloMaterial.setParameter('uStrength', envelope); haloMaterial.setParameter('uIntensity', profile.halo);
    haloMaterial.setParameter('uTime', time);
    starMaterial.setParameter('uStrength', envelope); starMaterial.setParameter('uIntensity', profile.star);
    starMaterial.setParameter('uTime', time);
    ribbonMaterial.setParameter('uStrength', envelope); ribbonMaterial.setParameter('uIntensity', profile.ribbon);
    ribbonMaterial.setParameter('uTime', time); ribbonMaterial.setParameter('uViewFade', viewFade);
  }

  return {
    update,
    destroy() {
      if (destroyed) return;
      destroyed = true; active = false; root.enabled = false;
      root.destroy(); materials.forEach((material) => material.destroy()); meshes.forEach((mesh) => mesh.destroy());
    }
  };
}
