import { windowPanes } from './window-layout.js?v=20261027-windows';

/** Pane-sized opaque scenery occludes old exterior splats; glass is drawn
 * over it in its own stable transparent pass. Interior splats remain in front.
 * This is a scenic preview, not a reconstruction of the original exterior. */
export async function createWindows(pc, app, camera, { reducedMotion = false } = {}) {
  const asset = new pc.Asset('Scenic ocean and sky', 'texture',
    { url: './assets/ocean-sky-v1.jpg' }, { flipY: false, mipmaps: true });
  app.assets.add(asset);
  await new Promise((resolve, reject) => {
    asset.once('load', resolve); asset.once('error', reject); app.assets.load(asset);
  });
  const texture = asset.resource;
  texture.addressU = pc.ADDRESS_REPEAT;
  texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

  const root = new pc.Entity('Scenic ocean windows');
  app.root.addChild(root);
  // Keep both passes inside CameraFrame's scene range (which ends at the
  // Immediate layer). Appending after UI would bypass HDR/tone mapping.
  const layers = app.scene.layers;
  const immediateIndex = layers.layerList.findIndex(layer => layer.id === pc.LAYERID_IMMEDIATE);
  const insertIndex = immediateIndex < 0 ? layers.layerList.length : immediateIndex;
  const replacementLayer = new pc.Layer({ name: 'Empty pane exterior replacement' });
  layers.insertOpaque(replacementLayer, insertIndex);
  const glassLayer = new pc.Layer({ name: 'Window glass', transparentSortMode: pc.SORTMODE_MANUAL });
  layers.insertTransparent(glassLayer, insertIndex + 1);
  camera.camera.layers = [...camera.camera.layers, replacementLayer.id, glassLayer.id];

  const vertexGLSL = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv0;
    uniform mat4 matrix_viewProjection;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main(void) {
      vWorld = aPosition; vNormal = aNormal; vUv = aUv0;
      gl_Position = matrix_viewProjection * vec4(aPosition, 1.0);
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
      void main(void) {
        // One direction-based panorama, rather than one repeated picture per
        // pane. Translation preserves a level, effectively distant horizon.
        vec3 ray = normalize(vWorld - view_position);
        float elevation = atan(ray.y, length(ray.xz));
        vec2 uv = vec2(0.5 + atan(ray.x, -ray.z) / 6.2831853,
                       clamp(0.5 - elevation / 1.8, 0.02, 0.98));
        float sea = smoothstep(0.49, 0.56, uv.y);
        uv.x += sea * sin(uTime * 0.12 + uv.y * 58.0) * 0.00065;
        vec3 color = texture2D(uOcean, uv).rgb;
        // The generated photograph is not a seamless HDRI. Blend its two
        // edges at the rear wrap so adjacent panes never jump from blue to
        // gold at the atan seam.
        float seam = 1.0 - smoothstep(0.0, 0.14, min(uv.x, 1.0-uv.x));
        vec3 seamColor = 0.5 * (texture2D(uOcean, vec2(0.01,uv.y)).rgb +
                               texture2D(uOcean, vec2(0.99,uv.y)).rgb);
        color = mix(color, seamColor, seam);
        // ShaderMaterial outputs linear color into CameraFrame's HDR target.
        color = pow(color, vec3(2.2));
        float drift = 1.0 + sea * sin(uTime * 0.17 + vWorld.x * 2.8) * 0.018;
        gl_FragColor = vec4(color * drift * 1.06, 1.0);
      }`
  });
  scenery.setParameter('uOcean', texture);
  scenery.setParameter('uTime', 0);
  scenery.blendType = pc.BLEND_NONE;
  scenery.depthTest = true; scenery.depthWrite = true;
  scenery.cull = pc.CULLFACE_NONE;
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
  windowPanes.forEach((pane, index) => {
    for (const isGlass of [false, true]) {
      const entity = new pc.Entity(`${pane.name} ${isGlass ? 'glass' : 'ocean'}`);
      const instance = new pc.MeshInstance(makePaneMesh(pane, isGlass ? 0.006 : 0),
        isGlass ? glass : scenery, entity);
      instance.castShadow = false; instance.receiveShadow = false;
      instance.drawOrder = index;
      entity.addComponent('render', { meshInstances: [instance],
        layers: isGlass ? [glassLayer.id] : [pane.overlayExterior ? replacementLayer.id : pc.LAYERID_WORLD] });
      root.addChild(entity);
    }
  });
  let time = 0, destroyed = false;
  return {
    root,
    get enabled() { return root.enabled; },
    setEnabled(value) { root.enabled = Boolean(value); return root.enabled; },
    update(dt) {
      if (destroyed || !root.enabled || reducedMotion) return;
      time += Math.min(Math.max(dt, 0), 0.1);
      scenery.setParameter('uTime', time); glass.setParameter('uTime', time);
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      camera.camera.layers = camera.camera.layers.filter(id => id !== glassLayer.id && id !== replacementLayer.id);
      root.destroy(); app.scene.layers.remove(glassLayer); app.scene.layers.remove(replacementLayer);
      scenery.destroy(); glass.destroy(); meshes.forEach(mesh => mesh.destroy());
      app.assets.remove(asset); asset.unload();
    }
  };
}
