/**
 * Optional, conservative geometry repairs for the bridge Gaussian splat.
 *
 * This file deliberately does not import PlayCanvas. The parent application
 * owns the engine import and passes its `pc` namespace here, which keeps this
 * optional experiment out of the normal scene path when it is disabled.
 *
 * All positions below are already in the ground-aligned world coordinate
 * system. Do not parent this root under the transformed splat entity and do
 * not apply `sceneTransform` a second time.
 */

const freezeSpec = (spec) => Object.freeze({
  ...spec,
  position: Object.freeze([...spec.position]),
  scale: Object.freeze([...spec.scale]),
  geometry: Object.freeze({ ...spec.geometry })
});

/**
 * Shared inferred geometry configuration. The exporter imports this exact
 * list so the editable GLB cannot drift from the runtime repair layer.
 * Dimensions are deliberately conservative guesses, not measurements.
 */
export const repairSpecs = Object.freeze([
  freezeSpec({
    id: 'central-shell',
    name: 'LCS-102 inferred backing / NOT MEASURED — shell',
    primitive: 'sphere',
    position: [0.29, 1.18, -0.54],
    scale: [0.56, 0.62, 0.54],
    geometry: { radius: 0.5, latitudeBands: 12, longitudeBands: 16 }
  }),
  freezeSpec({
    id: 'central-lower-body',
    name: 'LCS-102 inferred backing / NOT MEASURED — lower body',
    primitive: 'cylinder',
    position: [0.29, 0.70, -0.54],
    scale: [0.38, 0.34, 0.38],
    geometry: { radius: 0.5, height: 1, heightSegments: 2, capSegments: 16 }
  })
]);

/** Shared display intent for the runtime material and editable GLB. */
export const repairMaterialSpec = Object.freeze({
  diffuse: Object.freeze([0.012, 0.014, 0.014]),
  emissive: Object.freeze([0.018, 0.020, 0.019]),
  metalness: 0,
  gloss: 0.06,
  depthTest: true,
  depthWrite: false,
  cull: 'front'
});

/**
 * Build the optional inferred repair shell.
 *
 * The shape is a deliberately small proxy for the large, dark central
 * equipment visible in the source panorama. It is not a reconstruction of
 * the object's true back, controls, fittings, or surface texture.
 *
 * @param {object} pc PlayCanvas namespace supplied by the parent app.
 * @param {object} app PlayCanvas Application instance.
 * @returns {{root: object, setEnabled: (enabled: boolean) => boolean, destroy: () => void, parts: object[]}}
 */
export function createRepairs(pc, app) {
  if (!pc || !app?.root || !app.graphicsDevice) {
    throw new TypeError('createRepairs(pc, app) requires a PlayCanvas namespace and Application');
  }

  const root = new pc.Entity('Inferred geometry repairs (optional)');
  // The root is attached directly to app.root so its children use world
  // coordinates. It is intentionally identity-transformed.
  root.setLocalPosition(0, 0, 0);
  root.setLocalEulerAngles(0, 0, 0);
  root.setLocalScale(1, 1, 1);
  root.enabled = false;
  app.root.addChild(root);

  // A single unlit, rough material keeps the proxy visually subordinate to
  // captured splat colors. Front-face culling means an outside camera sees
  // only the far side of this closed shell; existing splats in front win the
  // depth test. depthWrite=false prevents the proxy from occluding later
  // scene content when a hole is not present.
  const material = new pc.StandardMaterial();
  material.diffuse = new pc.Color(...repairMaterialSpec.diffuse);
  material.emissive = new pc.Color(...repairMaterialSpec.emissive);
  material.useLighting = false;
  material.metalness = repairMaterialSpec.metalness;
  material.gloss = repairMaterialSpec.gloss;
  material.specular = new pc.Color(0, 0, 0);
  material.cull = repairMaterialSpec.cull === 'front' ? pc.CULLFACE_FRONT : pc.CULLFACE_BACK;
  material.depthTest = repairMaterialSpec.depthTest;
  material.depthWrite = repairMaterialSpec.depthWrite;
  material.update();

  const parts = [];

  function addPart(name, mesh, position, scale) {
    const part = new pc.Entity(name);
    // Use local coordinates only after the identity root is established.
    // These values are world coordinates in the same frame as the camera.
    part.setLocalPosition(...position);
    part.setLocalScale(...scale);
    const meshInstance = new pc.MeshInstance(mesh, material, part);
    meshInstance.castShadow = false;
    meshInstance.receiveShadow = false;
    // Keep a conservative manual order if the active layer honors it. The
    // depth test above remains the primary protection against overdraw.
    meshInstance.drawOrder = 100;
    part.addComponent('render', { meshInstances: [meshInstance] });
    root.addChild(part);
    parts.push(part);
    return part;
  }

  // Inferred from the dense central cluster in bridge.ply. The proxy is
  // intentionally inset versus the broad alpha>=0.03 envelope so that it
  // fills side/rear holes without claiming the visible front silhouette.
  repairSpecs.forEach((spec) => {
    const mesh = spec.primitive === 'sphere'
      ? pc.createSphere(app.graphicsDevice, spec.geometry)
      : pc.createCylinder(app.graphicsDevice, spec.geometry);
    addPart(spec.name, mesh, spec.position, spec.scale);
  });

  let destroyed = false;
  function setEnabled(enabled) {
    if (destroyed) return false;
    root.enabled = Boolean(enabled);
    return root.enabled;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    root.enabled = false;
    if (root.parent) root.parent.removeChild(root);
    root.destroy();
    // RenderComponent.destroy releases each MeshInstance (and its mesh).
    // Avoid destroying those meshes a second time here.
    material.destroy();
  }

  return { root, setEnabled, destroy, parts };
}

