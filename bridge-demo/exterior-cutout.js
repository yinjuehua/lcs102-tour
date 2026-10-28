import { windowPanes } from './window-layout.js?v=20261027-sphere';

const capture = [0, 1.6626, 0];
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normal = a => { const n=Math.hypot(...a)||1;return a.map(v=>v/n); };
const vec = a => `vec3(${a.map(v=>Number(v).toFixed(8)).join(',')})`;

// Convex room perimeter, including the solid door/panel facets between glass.
// Exterior removal must work after translation, not just along capture rays.
function roomPlanes() {
  const points=windowPanes.flatMap(p=>p.corners.map(c=>[c[0],c[2]]));
  points.push([-1.418,-0.659],[-1.370,-1.093],[-1.114,-1.586],[-0.712,-1.794],[-0.194,-2.064]);
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const lower=[],upper=[];
  for(const p of points){while(lower.length>1&&turn(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of [...points].reverse()){while(upper.length>1&&turn(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  const hull=[...lower.slice(0,-1),...upper.slice(0,-1)];
  return hull.map((a,i)=>{
    const b=hull[(i+1)%hull.length];let n=normal([a[1]-b[1],0,b[0]-a[0]]);
    const p=[a[0],0,a[1]];
    if(dot(n,sub([0,0,0],p))<0)n=n.map(v=>-v);
    return {n,p};
  });
}

/** Clear captured exterior Gaussians instead of painting pictures in front
 * of the cabin. The source asset stays intact and the comparison toggle can
 * restore its opacity. Foreground points inside the glazing plane survive. */
export function installExteriorCutout(component) {
  const openings = windowPanes.map(pane => {
    const center = pane.corners.reduce((sum,c)=>sum.map((v,i)=>v+c[i]/4),[0,0,0]);
    const direction = sub(center,capture);
    const edges = pane.corners.map((corner,i)=> {
      let n=normal(cross(sub(corner,capture),sub(pane.corners[(i+1)%4],capture)));
      if(dot(n,direction)<0)n=n.map(v=>-v);
      return n;
    });
    const needsPaleCleanup = pane.name==='port-center';
    const prismEdges=pane.corners.map((c,i)=>{
      let n=normal(cross(sub(pane.corners[(i+1)%4],c),pane.inward));
      if(dot(n,sub(center,c))<0)n=n.map(v=>-v);
      return `dot(center-${vec(c)},${vec(n)})`;
    });
    const palePrism=needsPaleCleanup ? `{
      float prism=min(min(${prismEdges[0]},${prismEdges[1]}),min(${prismEdges[2]},${prismEdges[3]}));
      float depth=dot(center-${vec(center)},${vec(pane.inward)});
      float ghost=paleExterior*(1.0-greenFrame)*smoothstep(-0.035,0.01,prism)*
                  smoothstep(1.10,1.16,center.y)*(1.0-smoothstep(0.56,0.68,depth));
      removal=max(removal,ghost);
    }` : '';
    return `{
      float edge = min(min(dot(ray,${vec(edges[0])}),dot(ray,${vec(edges[1])})),
                       min(dot(ray,${vec(edges[2])}),dot(ray,${vec(edges[3])})));
      float aperture = smoothstep(-0.0012, 0.0015, edge);
      if(aperture>0.0) {
        float cabinDepth = dot(center-${vec(center)},${vec(pane.inward)});
        float exterior = 1.0-smoothstep(0.0,0.16,cabinDepth);
        // Keep painted frames near their physical plane. Exterior green
        // scenery farther outside the room is still removed.
        exterior *= 1.0-greenFrame*smoothstep(-0.20,-0.08,cabinDepth);
        removal=max(removal,aperture*exterior);
      }
    }${palePrism}`;
  }).join('\n');
  const perimeter=roomPlanes().map(p=>`outside=max(outside,-dot(center-${vec(p.p)},${vec(p.n)}));`).join('\n');
  const glsl = `
    uniform float uScenicExterior;
    void modifySplatCenter(inout vec3 center) {}
    void modifySplatRotationScale(vec3 originalCenter,vec3 modifiedCenter,inout vec4 rotation,inout vec3 scale) {}
    void modifySplatColor(vec3 center,inout vec4 color) {
      if(uScenicExterior<0.5) return;
      vec3 fromCapture=center-${vec(capture)};
      float captureDistance=length(fromCapture);
      if(captureDistance<0.35) return;
      vec3 ray=fromCapture/max(captureDistance,0.0001);
      float greenFrame=smoothstep(0.018,0.045,color.g-color.r)*
                       smoothstep(0.025,0.060,color.g-color.b);
      // Only cool, pale captured scenery may be removed inside the
      // distorted port-center opening. Dark equipment, warm seats, and painted
      // green cabin surfaces must never be cleared by that exception.
      float paleExterior=smoothstep(0.55,0.62,(color.r+color.g+color.b)/3.0)*
                         smoothstep(0.40,0.46,min(color.r,min(color.g,color.b)))*
                         smoothstep(-0.045,-0.010,color.b-color.r);
      float removal=0.0;
      float outside=0.0;
      ${perimeter}
      // Preserve the nearby roof/floor shell, but remove scenery farther
      // outside the room at every height. Around window height, color and
      // depth distinguish painted frames from captured exterior surfaces.
      float windowBand=smoothstep(0.85,1.02,center.y)*(1.0-smoothstep(1.90,2.04,center.y));
      float farOutside=smoothstep(0.24,0.36,outside);
      float nearOutside=smoothstep(0.015,0.065,outside)*windowBand*(1.0-greenFrame);
      removal=max(farOutside,nearOutside);
      ${openings}
      color.a*=1.0-removal;
    }`;
  component.setWorkBufferModifier({glsl});
  component.setParameter('uScenicExterior',1);
  return {
    setEnabled(value) { component.setParameter('uScenicExterior',value?1:0); },
    destroy() {
      component.setWorkBufferModifier(null);
      component.deleteParameter('uScenicExterior');
    }
  };
}
