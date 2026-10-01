/**
 * Orbital Trajectory Sandbox — main simulation.
 * Requires three.js r128 (loaded as a global before this file).
 */
(function(){
"use strict";

/* ---------- design tokens (read from tokens.css so JSON stays the source of truth) ---------- */
const rootStyle = getComputedStyle(document.documentElement);
const token = (name, fallback) => (rootStyle.getPropertyValue(name).trim() || fallback);
const COLOR_ACCENT = token('--color-accent', '#ff4d4d');
const COLOR_WHITE  = token('--color-white',  '#ffffff');

/* ---------- textures ---------- */
// Relative to index.html, served from the repo by GitHub Pages (same origin, no CORS issues).
// If either image fails to load, the procedural textures below are used instead.
const EARTH_TEXTURE_URL = 'assets/img/earth-texture.png';
const MOON_TEXTURE_URL  = 'assets/img/moon-texture.png';

/* ---------- constants ---------- */
const MU = 398600.4418;      // km^3/s^2
const RE = 6378.137;         // km
const SCALE = 2.0/RE;        // render units per km (Earth radius -> 2)

/* ---------- scene setup ---------- */
const container = document.getElementById('canvas-container');
const overviewContainer = document.getElementById('overview-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
container.appendChild(renderer.domElement);

const camera2 = new THREE.PerspectiveCamera(55, 1, 0.01, 5000);
const renderer2 = new THREE.WebGLRenderer({antialias:true});
renderer2.setPixelRatio(Math.min(devicePixelRatio,2));
overviewContainer.appendChild(renderer2.domElement);

function sizeRenderer(rnd, cam, el){
  const w=Math.max(2,el.clientWidth), h=Math.max(2,el.clientHeight);
  rnd.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix();
}
function sizeAll(){
  sizeRenderer(renderer, camera, container);
  sizeRenderer(renderer2, camera2, overviewContainer);
}

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(8,4,6);
scene.add(sun);

// starfield
(function(){
  const N=1600, pos=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const r=200+Math.random()*300, th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
    pos[i*3]=r*Math.sin(ph)*Math.cos(th);
    pos[i*3+1]=r*Math.cos(ph);
    pos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({color:COLOR_WHITE,size:0.5,sizeAttenuation:true,transparent:true,opacity:0.75})));
})();

// earth — grayscale relief texture, grouped so its self-rotation carries the grid,
// ring, ground marker and the earth-locked overview camera along with it
const earthGroup = new THREE.Group();
scene.add(earthGroup);
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1.94, 48, 32),
  new THREE.MeshPhongMaterial({map:buildEarthTexture(), shininess:4})
);
earthGroup.add(earth);
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(2.05,48,48), new THREE.MeshBasicMaterial({color:COLOR_WHITE, transparent:true, opacity:0.04})));
// equatorial ring
(function(){
  const pts=[]; for(let i=0;i<=64;i++){const a=i/64*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*2.15,0,Math.sin(a)*2.15));}
  const g=new THREE.BufferGeometry().setFromPoints(pts);
  const ring=new THREE.LineLoop(g, new THREE.LineDashedMaterial({color:COLOR_WHITE, dashSize:0.08, gapSize:0.06, transparent:true, opacity:0.35}));
  ring.computeLineDistances();
  earthGroup.add(ring);
})();
// earth-locked overview camera: parented to the rotating group so it co-rotates with Earth
earthGroup.add(camera2);

// red sub-satellite marker + its trace, fixed to the rotating globe surface
function latLonToLocal(latDeg,lonDeg,r){
  const lat=latDeg*Math.PI/180, lon=lonDeg*Math.PI/180;
  return new THREE.Vector3(r*Math.cos(lat)*Math.cos(lon), r*Math.sin(lat), -r*Math.cos(lat)*Math.sin(lon));
}
const groundDot = new THREE.Mesh(new THREE.SphereGeometry(0.035,10,10), new THREE.MeshBasicMaterial({color:COLOR_ACCENT}));
earthGroup.add(groundDot);
const MAX_GTRAIL=2500;
const gtrailGeo=new THREE.BufferGeometry();
const groundTrail=new THREE.Line(gtrailGeo, new THREE.LineBasicMaterial({color:COLOR_ACCENT}));
earthGroup.add(groundTrail);
let gtrailPts=[]; // sliding window, rebuilt each push so the trace never freezes

// decorative moon (visual only, no gravity yet — hints at future multi-body slingshots)
const moonOrbitR = 14;
const moon = new THREE.Mesh(new THREE.SphereGeometry(0.5,24,24), new THREE.MeshPhongMaterial({map:buildMoonTexture()}));
scene.add(moon);

// swap in the stylized maps from assets/img once loaded; keep the procedural textures as fallback
let earthImgLoaded=false;
const earthImg=new Image();
earthImg.crossOrigin='anonymous';
earthImg.onload=()=>{
  earthImgLoaded=true;
  const tex=new THREE.Texture(earthImg); tex.needsUpdate=true;
  earth.material.map=tex; earth.material.needsUpdate=true;
};
earthImg.src=EARTH_TEXTURE_URL;
const moonImg=new Image();
moonImg.crossOrigin='anonymous';
moonImg.onload=()=>{
  const tex=new THREE.Texture(moonImg); tex.needsUpdate=true;
  moon.material.map=tex; moon.material.needsUpdate=true;
};
moonImg.src=MOON_TEXTURE_URL;

/* ---------- camera controls (custom orbit) ---------- */
const camState = {theta: Math.PI*0.3, phi: Math.PI*0.38, radius: 11};
function updateCamera(){
  camera.position.set(
    camState.radius*Math.sin(camState.phi)*Math.sin(camState.theta),
    camState.radius*Math.cos(camState.phi),
    camState.radius*Math.sin(camState.phi)*Math.cos(camState.theta)
  );
  camera.lookAt(0,0,0);
}
updateCamera();
let dragging=false, lastX=0, lastY=0;
renderer.domElement.addEventListener('pointerdown', e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;});
window.addEventListener('pointerup', ()=>dragging=false);
window.addEventListener('pointermove', e=>{
  if(!dragging) return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY;
  lastX=e.clientX; lastY=e.clientY;
  camState.theta -= dx*0.006;
  camState.phi = Math.min(Math.PI-0.08, Math.max(0.08, camState.phi - dy*0.006));
  updateCamera();
});
renderer.domElement.addEventListener('wheel', e=>{
  e.preventDefault();
  camState.radius = Math.min(80, Math.max(3.2, camState.radius*(1+e.deltaY*0.001)));
  updateCamera();
}, {passive:false});
window.addEventListener('resize', sizeAll);
sizeAll();

/* ---------- orbit mechanics ---------- */
function computeElements(r0, v0){
  const r0m = r0.length();
  const hvec = new THREE.Vector3().crossVectors(r0, v0);
  const h = hvec.length();
  if(h < 1e-3) return null; // near-radial, degenerate
  const evec = new THREE.Vector3().crossVectors(v0, hvec).divideScalar(MU).sub(r0.clone().divideScalar(r0m));
  const e = evec.length();
  const p = (h*h)/MU;
  const rPeri = p/(1+e);
  let a=null, rApo=null, period=null;
  if(e < 0.999){
    a = p/(1-e*e);
    rApo = a*(1+e);
    period = 2*Math.PI*Math.sqrt(Math.pow(a,3)/MU);
  } else if (Math.abs(e-1) < 0.001){
    a = null;
  } else {
    a = p/(1-e*e); // negative
  }
  const hHat = hvec.clone().normalize();
  const pHat = e>1e-5 ? evec.clone().normalize() : r0.clone().normalize();
  const wHat = new THREE.Vector3().crossVectors(hHat, pHat).normalize();
  let type, typeClass;
  if(rPeri < RE){ type='Suborbital / Impact path'; typeClass='type-crash'; }
  else if(e<0.01){ type='Circular'; typeClass='type-circular'; }
  else if(e<0.999){ type='Elliptical'; typeClass='type-elliptical'; }
  else { type='Escape (hyperbolic)'; typeClass='type-escape'; }
  return {h,e,p,a,rPeri,rApo,period,pHat,wHat,type,typeClass};
}
function pathPoints(el, segments){
  const pts=[];
  let thMin=-Math.PI, thMax=Math.PI;
  if(el.e >= 0.999){
    const thetaInf = el.e>1 ? Math.acos(-1/el.e) : Math.PI*0.92;
    thMin=-thetaInf*0.92; thMax=thetaInf*0.92;
  }
  for(let i=0;i<=segments;i++){
    const th = thMin + (thMax-thMin)*i/segments;
    const denom = 1+el.e*Math.cos(th);
    if(denom < 1e-3) continue;
    const r = el.p/denom;
    if(r > RE*40) continue;
    const pt = el.pHat.clone().multiplyScalar(r*Math.cos(th)).add(el.wHat.clone().multiplyScalar(r*Math.sin(th)));
    pts.push(pt.multiplyScalar(SCALE));
  }
  return pts;
}

/* ---------- flight objects ---------- */
const orbitLineGeo = new THREE.BufferGeometry();
const orbitLine = new THREE.Line(orbitLineGeo, new THREE.LineDashedMaterial({color:COLOR_WHITE, dashSize:0.14, gapSize:0.09, transparent:true, opacity:0.85}));
scene.add(orbitLine);

const MAX_TRAIL=4000;
const trailPositions = new Float32Array(MAX_TRAIL*3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions,3));
trailGeo.setDrawRange(0,0);
const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({color:COLOR_WHITE}));
scene.add(trailLine);
let trailCount=0;

const sat = new THREE.Mesh(new THREE.SphereGeometry(0.09,12,12), new THREE.MeshBasicMaterial({color:COLOR_WHITE}));
scene.add(sat);
const satRing = new THREE.Mesh(new THREE.RingGeometry(0.15,0.17,24), new THREE.MeshBasicMaterial({color:COLOR_WHITE, side:THREE.DoubleSide, transparent:true, opacity:0.7}));
scene.add(satRing);

const velArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 1, COLOR_ACCENT);
scene.add(velArrow);

/* ---------- state ---------- */
const pos = new THREE.Vector3(), vel = new THREE.Vector3();
let running=false, launched=false, crashed=false;
let elapsed=0;
let launchElements=null;

const el = id=>document.getElementById(id);
const aSlider=el('aSlider'), eSlider=el('eSlider'), iSlider=el('iSlider'), omSlider=el('omSlider'), wSlider=el('wSlider'), nuSlider=el('nuSlider'), tsSlider=el('tsSlider');

function currentInputs(){
  return {
    a: parseFloat(aSlider.value),
    e: parseFloat(eSlider.value),
    i: parseFloat(iSlider.value),
    om: parseFloat(omSlider.value),
    w: parseFloat(wSlider.value),
    nu: parseFloat(nuSlider.value)
  };
}
// classical orbital elements -> position/velocity state vectors.
// The perifocal frame is rotated by (RAAN, inclination, arg-of-periapsis) into a
// standard equatorial (X,Y,Z-north) frame, then remapped into three.js's
// Y-up, right-handed scene axes: threeX=stdX, threeY=stdZ(north), threeZ=-stdY
function initialState(inputs){
  const D=Math.PI/180;
  const a=inputs.a, e=inputs.e, i=inputs.i*D, Om=inputs.om*D, w=inputs.w*D, nu=inputs.nu*D;
  const p = a*(1-e*e);
  const r = p/(1+e*Math.cos(nu));
  const rp=[r*Math.cos(nu), r*Math.sin(nu)];
  const vf = Math.sqrt(MU/p);
  const vp=[-vf*Math.sin(nu), vf*(e+Math.cos(nu))];
  const cO=Math.cos(Om), sO=Math.sin(Om), ci=Math.cos(i), si=Math.sin(i), cw=Math.cos(w), sw=Math.sin(w);
  const R11=cO*cw-sO*sw*ci, R12=-cO*sw-sO*cw*ci;
  const R21=sO*cw+cO*sw*ci, R22=-sO*sw+cO*cw*ci;
  const R31=sw*si,          R32=cw*si;
  const xs=R11*rp[0]+R12*rp[1], ys=R21*rp[0]+R22*rp[1], zs=R31*rp[0]+R32*rp[1];
  const vxs=R11*vp[0]+R12*vp[1], vys=R21*vp[0]+R22*vp[1], vzs=R31*vp[0]+R32*vp[1];
  const r0 = new THREE.Vector3(xs, zs, -ys);
  const v0 = new THREE.Vector3(vxs, vzs, -vys);
  return {r0,v0};
}

function fmt(n,d){ return n===null||n===undefined||isNaN(n) ? '—' : n.toFixed(d); }
function fmtTime(s){
  if(s<120) return s.toFixed(0)+'s';
  if(s<7200) return (s/60).toFixed(1)+'min';
  if(s<172800) return (s/3600).toFixed(2)+'h';
  return (s/86400).toFixed(2)+'d';
}

function updateTelemetry(elements, curPos, curSpeed){
  const badge = el('orbitType');
  if(!elements){
    badge.textContent='Vertical drop'; badge.className='type-crash';
    el('teleApo').textContent='—'; el('telePeri').textContent='—';
    el('teleEcc').textContent='—'; el('teleSma').textContent='—'; el('telePeriod').textContent='—';
  } else {
    badge.textContent=elements.type; badge.className=elements.typeClass;
    el('teleApo').textContent = elements.rApo ? fmt(elements.rApo-RE,0)+' km' : '— (open)';
    el('telePeri').textContent = fmt(elements.rPeri-RE,0)+' km';
    el('teleEcc').textContent = fmt(elements.e,3);
    el('teleSma').textContent = elements.a ? fmt(elements.a,0)+' km' : '—';
    el('telePeriod').textContent = elements.period ? fmtTime(elements.period) : '— (escape)';
  }
  if(curPos){
    el('teleAlt').textContent = fmt(curPos.length()-RE,1)+' km';
    el('teleSpd').textContent = fmt(curSpeed,2)+' km/s';
  }
  el('teleElapsed').textContent = fmtTime(elapsed);
}

function refreshOrbitVisual(elements){
  updateOverviewRadius(elements);
  if(!el('toggleOrbit').checked || !elements || (elements.e>=0.999 && !elements.a && elements.h<1e-3)){
    orbitLineGeo.setFromPoints([]);
    orbitLine.visible=false;
    return;
  }
  orbitLine.visible=true;
  const pts = pathPoints(elements, 180);
  orbitLineGeo.setFromPoints(pts);
  orbitLine.computeLineDistances();
}

function previewFromSliders(){
  const inputs = currentInputs();
  el('periHint').textContent = (inputs.a*(1-inputs.e)-RE).toFixed(0);
  el('apoHint').textContent = (inputs.a*(1+inputs.e)-RE).toFixed(0);
  if(launched) return;
  const {r0, v0} = initialState(inputs);
  pos.copy(r0); vel.copy(v0);
  const elements = computeElements(r0, v0);
  refreshOrbitVisual(elements);
  positionSatellite();
  updateTelemetry(elements, pos, vel.length());
}

function positionSatellite(){
  const scaled = pos.clone().multiplyScalar(SCALE);
  sat.position.copy(scaled);
  satRing.position.copy(scaled);
  satRing.quaternion.copy(camera.quaternion);
  const dir = vel.clone().normalize();
  if(el('toggleVec').checked && vel.length()>0.01){
    velArrow.visible=true;
    velArrow.position.copy(scaled);
    velArrow.setDirection(dir);
    velArrow.setLength(0.9, 0.25, 0.12);
  } else velArrow.visible=false;
}

/* ---------- physics integration (RK4) ---------- */
function accel(r){
  const r3 = Math.pow(r.length(),3);
  return r.clone().multiplyScalar(-MU/r3);
}
function rk4(r,v,dt){
  const k1r=v.clone(), k1v=accel(r);
  const k2r=v.clone().addScaledVector(k1v,dt/2), k2v=accel(r.clone().addScaledVector(k1r,dt/2));
  const k3r=v.clone().addScaledVector(k2v,dt/2), k3v=accel(r.clone().addScaledVector(k2r,dt/2));
  const k4r=v.clone().addScaledVector(k3v,dt), k4v=accel(r.clone().addScaledVector(k3r,dt));
  r.add(k1r.multiplyScalar(dt/6)).add(k2r.multiplyScalar(dt/3)).add(k3r.multiplyScalar(dt/3)).add(k4r.multiplyScalar(dt/6));
  v.add(k1v.multiplyScalar(dt/6)).add(k2v.multiplyScalar(dt/3)).add(k3v.multiplyScalar(dt/3)).add(k4v.multiplyScalar(dt/6));
}

function pushTrail(){
  pushTrackPoint();
  if(!el('toggleTrail').checked) return;
  if(trailCount>=MAX_TRAIL) return;
  const p = pos.clone().multiplyScalar(SCALE);
  trailPositions[trailCount*3]=p.x; trailPositions[trailCount*3+1]=p.y; trailPositions[trailCount*3+2]=p.z;
  trailCount++;
  trailGeo.setDrawRange(0,trailCount);
  trailGeo.attributes.position.needsUpdate=true;
}

/* ---------- overview camera radius ---------- */
let overviewRadius=14;
function updateOverviewRadius(elements){
  const apoRender = elements && elements.rApo ? elements.rApo*SCALE : pos.length()*SCALE;
  overviewRadius = Math.min(70, Math.max(8, apoRender*1.8));
}

/* ---------- ground track ---------- */
function subPoint(r){
  const rn = r.clone().normalize();
  const lat = Math.asin(Math.max(-1,Math.min(1,rn.y)))*180/Math.PI;
  const lonInertial = Math.atan2(-rn.z, rn.x)*180/Math.PI;
  let lon = lonInertial - (earthGroup.rotation.y*180/Math.PI);
  lon = ((lon+180)%360+360)%360-180;
  return {lat,lon};
}
let trackPoints=[];
const MAX_TRACK=1500;
function pushTrackPoint(){
  const sp = subPoint(pos);
  trackPoints.push(sp);
  if(trackPoints.length>MAX_TRACK) trackPoints.shift();
  gtrailPts.push(latLonToLocal(sp.lat, sp.lon, 1.965));
  if(gtrailPts.length>MAX_GTRAIL) gtrailPts.shift();
  gtrailGeo.setFromPoints(gtrailPts);
}
function updateGroundDot(){
  const sp = subPoint(pos);
  groundDot.position.copy(latLonToLocal(sp.lat, sp.lon, 1.97));
}

/* ---------- procedural fallback textures ---------- */
function buildEarthTexture(){
  const c=document.createElement('canvas'); c.width=1024;c.height=512;
  const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,512);
  g.addColorStop(0,'#060606'); g.addColorStop(0.5,'#151515'); g.addColorStop(1,'#060606');
  ctx.fillStyle=g; ctx.fillRect(0,0,1024,512);
  ctx.globalAlpha=0.5;
  for(let i=0;i<200;i++){
    const x=Math.random()*1024, y=Math.random()*512, r=8+Math.random()*36, gr=Math.floor(10+Math.random()*18);
    ctx.fillStyle='rgb('+gr+','+gr+','+gr+')';
    ctx.beginPath(); ctx.ellipse(x,y,r,r*0.5,Math.random()*Math.PI,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  const sx=1024/720, sy=512/360;
  const land=[[140,90,120,58],[240,222,48,66],[392,178,70,72],[398,58,58,28],[575,112,148,84],[627,235,42,34]];
  land.forEach(([cx0,cy0,rx0,ry0])=>{
    const cx=cx0*sx, cy=cy0*sy, rx=rx0*sx, ry=ry0*sy;
    ctx.beginPath();
    for(let a=0;a<=Math.PI*2+0.01;a+=0.22){
      const rr=0.7+0.3*Math.sin(a*3.2+cx*0.05);
      const px=cx+Math.cos(a)*rx*rr, py=cy+Math.sin(a)*ry*rr;
      a===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.closePath();
    ctx.fillStyle='#d8d8d8'; ctx.fill();
    ctx.save(); ctx.clip();
    for(let i=0;i<24;i++){
      const bx=cx+(Math.random()-0.5)*rx*1.6, by=cy+(Math.random()-0.5)*ry*1.6, br=6+Math.random()*24;
      const gr=Math.floor(150+Math.random()*105);
      ctx.fillStyle='rgb('+gr+','+gr+','+gr+')'; ctx.globalAlpha=0.45;
      ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1; ctx.restore();
  });
  ctx.fillStyle='#c2c2c2'; ctx.fillRect(0,452,1024,60);
  ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1;
  for(let x=0;x<=1024;x+=1024/12){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,512); ctx.stroke(); }
  for(let y=0;y<=512;y+=512/8){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1024,y); ctx.stroke(); }
  return new THREE.CanvasTexture(c);
}
function buildWorldMap(){
  const c=document.createElement('canvas'); c.width=720;c.height=360;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#000'; ctx.fillRect(0,0,720,360);
  ctx.fillStyle='#fff';
  // roughly-positioned continent silhouettes (cx,cy,rx,ry), equirectangular 720x360
  const land=[[140,90,120,58],[240,222,48,66],[392,178,70,72],[398,58,58,28],[575,112,148,84],[627,235,42,34]];
  land.forEach(([cx,cy,rx,ry])=>{
    ctx.beginPath();
    for(let a=0;a<=Math.PI*2+0.01;a+=0.28){
      const rr=0.7+0.3*Math.sin(a*3.2+cx*0.08);
      const px=cx+Math.cos(a)*rx*rr, py=cy+Math.sin(a)*ry*rr;
      a===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.closePath(); ctx.fill();
  });
  ctx.fillRect(0,320,720,40); // Antarctica
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
  for(let x=0;x<=720;x+=60){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,360); ctx.stroke(); }
  for(let y=0;y<=360;y+=45){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(720,y); ctx.stroke(); }
  ctx.strokeStyle='rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.moveTo(0,180); ctx.lineTo(720,180); ctx.stroke();
  return c;
}
function buildMoonTexture(){
  const c=document.createElement('canvas'); c.width=256;c.height=128;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#cacaca'; ctx.fillRect(0,0,256,128);
  ctx.fillStyle='#4a4a4a';
  [[60,50,22],[140,70,26],[190,42,15],[92,92,13]].forEach(([x,y,r])=>{
    ctx.beginPath(); ctx.ellipse(x,y,r,r*0.7,0,0,Math.PI*2); ctx.fill();
  });
  for(let i=0;i<55;i++){
    const x=Math.random()*256, y=Math.random()*128, r=1+Math.random()*6;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x-r*0.3,y-r*0.3,r*0.5,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}
const worldMap = buildWorldMap();
function drawGroundTrack(){
  const canvas = el('groundTrackCanvas');
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio,2);
  const cw = Math.round(rect.width*dpr), ch = Math.round(rect.height*dpr);
  if(canvas.width!==cw || canvas.height!==ch){ canvas.width=cw; canvas.height=ch; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const W=rect.width, H=rect.height;
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(earthImgLoaded ? earthImg : worldMap, 0,0,W,H);
  const toXY=(lon,lat)=>[(lon+180)/360*W, (90-lat)/180*H];
  const strokePath=(color,width)=>{
    ctx.strokeStyle=color; ctx.lineWidth=width; ctx.beginPath();
    let prev=null;
    trackPoints.forEach(pt=>{
      const [x,y]=toXY(pt.lon,pt.lat);
      if(prev && Math.abs(x-prev[0])>W*0.6){ ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); }
      else if(!prev){ ctx.moveTo(x,y); } else { ctx.lineTo(x,y); }
      prev=[x,y];
    });
    ctx.stroke();
  };
  if(trackPoints.length>1){
    strokePath('rgba(255,255,255,0.9)', 3);
    strokePath(COLOR_ACCENT, 1.4);
  }
  const cur = subPoint(pos);
  const [cx,cy] = toXY(cur.lon,cur.lat);
  ctx.fillStyle=COLOR_WHITE; ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=COLOR_ACCENT; ctx.beginPath(); ctx.arc(cx,cy,2.6,0,Math.PI*2); ctx.fill();
}

function showBanner(msg){
  const b=el('banner'); b.textContent=msg; b.style.display='block';
  clearTimeout(showBanner._t);
  showBanner._t=setTimeout(()=>b.style.display='none', 4200);
}

/* ---------- simulation control ---------- */
function launch(){
  const inputs = currentInputs();
  const {r0,v0} = initialState(inputs);
  pos.copy(r0); vel.copy(v0);
  launchElements = computeElements(r0,v0);
  running=true; launched=true; crashed=false; elapsed=0;
  trailCount=0; trailGeo.setDrawRange(0,0); trackPoints=[];
  gtrailPts=[]; gtrailGeo.setFromPoints([]);
  refreshOrbitVisual(launchElements);
  el('btnLaunch').textContent='⏸ Pause';
  showBanner(launchElements ? ('Launched: '+launchElements.type) : 'Launched: vertical trajectory');
}
function togglePause(){
  if(!launched){ launch(); return; }
  running=!running;
  el('btnLaunch').textContent = running ? '⏸ Pause' : '▶ Play';
}
function resetSim(){
  running=false; launched=false; crashed=false; elapsed=0;
  trailCount=0; trailGeo.setDrawRange(0,0); trackPoints=[];
  gtrailPts=[]; gtrailGeo.setFromPoints([]);
  el('btnLaunch').textContent='▶ Play';
  sat.material.color.set(COLOR_WHITE);
  satRing.material.color.set(COLOR_WHITE);
  previewFromSliders();
}

const PRESETS={
  leo:     {a:6778,  e:0.001, i:51.6, om:0,  w:0,   nu:0},
  gto:     {a:24371, e:0.73,  i:23,   om:0,  w:0,   nu:0},
  molniya: {a:26600, e:0.72,  i:63.4, om:0,  w:270, nu:0},
  geo:     {a:42164, e:0.001, i:0,    om:0,  w:0,   nu:0},
  polar:   {a:7200,  e:0.05,  i:90,   om:40, w:0,   nu:0},
  sub:     {a:7000,  e:0.15,  i:20,   om:0,  w:0,   nu:180}
};
function applyPreset(p){
  const c=PRESETS[p]; if(!c) return;
  aSlider.value=c.a; eSlider.value=c.e; iSlider.value=c.i;
  omSlider.value=c.om; wSlider.value=c.w; nuSlider.value=c.nu;
  syncLabels();
  resetSim();
  launch();
}

function syncLabels(){
  el('aVal').textContent=parseFloat(aSlider.value).toFixed(0);
  el('eVal').textContent=parseFloat(eSlider.value).toFixed(2);
  el('iVal').textContent=parseFloat(iSlider.value).toFixed(0);
  el('omVal').textContent=parseFloat(omSlider.value).toFixed(0);
  el('wVal').textContent=parseFloat(wSlider.value).toFixed(0);
  el('nuVal').textContent=parseFloat(nuSlider.value).toFixed(0);
  el('tsVal').textContent=parseFloat(tsSlider.value).toFixed(0);
}

/* ---------- wire up UI ---------- */
[aSlider,eSlider,iSlider,omSlider,wSlider,nuSlider].forEach(s=>s.addEventListener('input', ()=>{ syncLabels(); previewFromSliders(); }));
tsSlider.addEventListener('input', syncLabels);
el('btnLaunch').addEventListener('click', togglePause);
el('btnReset').addEventListener('click', resetSim);
el('btnCircularize').addEventListener('click', ()=>{
  eSlider.value=0.001; syncLabels(); previewFromSliders();
});
el('btnPeriapsis').addEventListener('click', ()=>{
  nuSlider.value=0; syncLabels(); previewFromSliders();
});
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click', ()=>applyPreset(b.dataset.p)));
el('toggleOrbit').addEventListener('change', ()=>{
  if(launched){ refreshOrbitVisual(launchElements); return; }
  const s=initialState(currentInputs());
  refreshOrbitVisual(computeElements(s.r0, s.v0));
});
el('toggleTrail').addEventListener('change', e=>{ if(!e.target.checked){ trailCount=0; trailGeo.setDrawRange(0,0);} });

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  earthGroup.rotation.y += delta*0.03;
  const mt = performance.now()*0.00006;
  moon.position.set(Math.cos(mt)*moonOrbitR, Math.sin(mt*0.4)*1.5, Math.sin(mt)*moonOrbitR);

  if(running && launched && !crashed){
    const timeScale = parseFloat(tsSlider.value);
    const simSeconds = delta*timeScale;
    const substeps = Math.min(60, Math.max(4, Math.ceil(simSeconds/2)));
    const dt = simSeconds/substeps;
    for(let i=0;i<substeps;i++){
      rk4(pos, vel, dt);
      if(pos.length() <= RE){ crashed=true; break; }
    }
    elapsed += simSeconds;
    pushTrail();
    positionSatellite();
    updateTelemetry(launchElements, pos, vel.length());
    if(crashed){
      running=false;
      sat.material.color.set(COLOR_ACCENT);
      satRing.material.color.set(COLOR_ACCENT);
      el('btnLaunch').textContent='▶ Play';
      showBanner('💥 Impact — trajectory intersected Earth\'s surface.');
    }
  }
  updateGroundDot();
  drawGroundTrack();
  // earth-locked overview camera: fixed local offset, parent (earthGroup) rotation carries it
  camera2.position.set(0, overviewRadius*0.55, overviewRadius);
  camera2.lookAt(0,0,0);
  renderer.render(scene, camera);
  renderer2.render(scene, camera2);
}

previewFromSliders();
syncLabels();
animate();

})();
