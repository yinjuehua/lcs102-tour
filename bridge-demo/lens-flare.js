import { windowPanes } from './window-layout.js?v=20261028-polish';
import { portholeLightConfig } from './porthole-light.js?v=20261028-polish';

// Optical ghosts live in the camera image, unlike the world-space sunbeams.
// Each group tracks an actual aperture and fades before it leaves the frame.
export function createLensFlare(pc, app, camera, { layerId }) {
  const panes = [windowPanes[0], windowPanes[2]];
  const sources = [portholeLightConfig.center, ...panes.map(pane =>
    pane.corners.reduce((sum, corner) => sum.map((v, i) => v + corner[i] / 4), [0, 0, 0]))];
  const normals = [portholeLightConfig.inward, ...panes.map(pane => pane.inward)];
  const uniforms = sources.map(() => new Float32Array([0, 0, 0]));
  const world = sources.map(p => new pc.Vec3(...p));
  const projected = new pc.Vec3();
  const material = new pc.ShaderMaterial({
    uniqueName: 'LCS102CameraLensGhosts',
    attributes: { aPosition: pc.SEMANTIC_POSITION },
    vertexGLSL: `
      attribute vec3 aPosition;
      varying vec2 vScreen;
      void main(void) {
        vScreen = aPosition.xy;
        gl_Position = vec4(aPosition.xy, 0.0, 1.0);
      }`,
    fragmentGLSL: `
      precision highp float;
      uniform vec3 uSource0;
      uniform vec3 uSource1;
      uniform vec3 uSource2;
      uniform float uAspect;
      uniform float uStrength;
      varying vec2 vScreen;
      float disc(vec2 center, float size) {
        vec2 p = (vScreen - center) * vec2(uAspect, 1.0) / size;
        float r = length(p);
        return exp(-r*r*3.4) * (1.0-smoothstep(0.72,1.0,r));
      }
      vec3 ghosts(vec3 source) {
        vec2 s = source.xy;
        // Reflections are aligned along light -> optical center.
        float warm = disc(s * -0.38, 0.105);
        float teal = disc(s * -0.82, 0.065);
        float amber = disc(s * 0.32, 0.042);
        vec2 d = (vScreen-s) * vec2(uAspect,1.0);
        float streak = exp(-abs(d.y)*230.0) * exp(-abs(d.x)*12.0);
        return source.z * (vec3(1.0,0.53,0.23)*warm*0.19 +
          vec3(0.22,0.63,0.59)*teal*0.11 +
          vec3(1.0,0.77,0.38)*amber*0.16 +
          vec3(1.0,0.76,0.44)*streak*0.28);
      }
      void main(void) {
        vec3 color = (ghosts(uSource0)+ghosts(uSource1)+ghosts(uSource2))*uStrength;
        gl_FragColor = vec4(color, 1.0);
      }`
  });
  material.blendType = pc.BLEND_ADDITIVE;
  material.depthTest = false; material.depthWrite = false; material.cull = pc.CULLFACE_NONE;
  uniforms.forEach((value, i) => material.setParameter(`uSource${i}`, value));
  material.setParameter('uAspect', 1); material.setParameter('uStrength', 0); material.update();
  const mesh = new pc.Mesh(app.graphicsDevice);
  mesh.setPositions([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]);
  mesh.setIndices([0,1,2, 0,2,3]); mesh.update();
  const root = new pc.Entity('Camera lens flare from visible apertures');
  const instance = new pc.MeshInstance(mesh, material, root);
  instance.cull = false; instance.castShadow = false; instance.receiveShadow = false;
  instance.drawOrder = 210;
  root.addComponent('render', {meshInstances:[instance], layers:[layerId]});
  app.root.addChild(root);
  const smooth = (a,b,x) => {const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t);};
  let destroyed = false;
  return {
    update(dt, strength) {
      if (destroyed) return;
      const device = app.graphicsDevice;
      const {width,height}=device.clientRect;
      const p = camera.getPosition(), forward = camera.forward;
      world.forEach((point, i) => {
        camera.camera.worldToScreen(point, projected);
        const x = projected.x / width * 2 - 1;
        const y = 1 - projected.y / height * 2;
        const dx=point.x-p.x, dy=point.y-p.y, dz=point.z-p.z;
        const distance=Math.hypot(dx,dy,dz) || 1;
        const inFront=(dx*forward.x+dy*forward.y+dz*forward.z)/distance;
        const n=normals[i];
        const facing=(-dx*n[0]-dy*n[1]-dz*n[2])/distance;
        const visibility=(1-smooth(0.75,1.12,Math.max(Math.abs(x),Math.abs(y)))) *
          smooth(0.4,0.75,inFront) * smooth(0.03,0.22,facing);
        const target=visibility*(i===0?1:0.45);
        const u=uniforms[i]; u[0]=x; u[1]=y;
        u[2]+=(target-u[2])*(1-Math.exp(-Math.min(Math.max(dt,0),0.1)*4));
        material.setParameter(`uSource${i}`,u);
      });
      material.setParameter('uAspect',width/height);
      material.setParameter('uStrength',strength);
      root.enabled=strength>0;
    },
    destroy() { if(destroyed)return; destroyed=true;root.destroy();material.destroy();mesh.destroy(); }
  };
}
