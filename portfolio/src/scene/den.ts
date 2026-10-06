// "The Den": the living background of the portfolio.
//
// Layer 1 is the Tunnel scene ported from its spec (geometry, shaders, colours, motion and the
// FinalPass composite are the spec's, value for value; see .claude/skills/particle-brain-hero).
// Layer 2 is Jarvis's head: ~22k particles that fly in from the tunnel and assemble into a brain,
// lean toward the cursor, part around it, pulse with "neural" waves and ripple while Jarvis talks.
//
// Two deliberate, output-neutral changes from the spec, both for a page that has to stay fast:
//  - devicePixelRatio is capped (2 on desktop, 1.25 on phones) and the tunnel grid is thinner on phones.
//  - The spec's torus composer renders camera layer 1, which nothing in the spec is on, so its texture
//    is always black. It is kept as a uniform (black) but not rendered. The bloom composer is rendered
//    and is where the brain lives, so only the brain blooms.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GammaCorrectionShader } from "three/examples/jsm/shaders/GammaCorrectionShader.js";

const Lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function hexToVec3(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const LAYERS = { NONE: 0, TORUS_SCENE: 1, BLOOM_SCENE: 2, ENTIRE_SCENE: 3 };

// ---------------------------------------------------------------- shared GLSL (verbatim)
const SNOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

// ---------------------------------------------------------------- FinalPass (verbatim)
const FinalPass = {
  uniforms: {
    iTime: { value: 0 },
    tDiffuse: { value: null },
    torusTexture: { value: null },
    bloomTexture: { value: null },
    haloTexture: { value: null },
    uBg: { value: hexToVec3("#0a0524") },
    uFlameA: { value: hexToVec3("#2bf0ff") },
    uFlameB: { value: hexToVec3("#7a3cff") },
    uFlameAmt: { value: 0.2 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
uniform float iTime; uniform sampler2D tDiffuse; uniform sampler2D bloomTexture; uniform sampler2D torusTexture; uniform sampler2D haloTexture;
uniform vec3 uBg; uniform vec3 uFlameA; uniform vec3 uFlameB; uniform float uFlameAmt;
varying vec2 vUv;
vec3 warp3d(vec3 pos, float t){ float curv=.8,a=1.9,b=0.7; pos*=2.;
  pos.x+=curv*sin(t+a*pos.y)+t*b; pos.y+=curv*cos(t+a*pos.x);
  pos.y+=curv*sin(t+a*pos.z)+t*b; pos.z+=curv*cos(t+a*pos.y);
  pos.z+=curv*sin(t+a*pos.x)+t*b; pos.x+=curv*cos(t+a*pos.z);
  return 0.5+0.5*cos(pos.xyz+vec3(1,2,4)); }
void main(){
  vec2 uv = 2.*vUv - 1.;
  vec3 w = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime*1.5), vec3(1.5));
  vec3 flame = 1.5*uFlameA*w.x; flame*=w.y; flame += uFlameB*w.z;
  flame *= smoothstep(0.25, 1., abs(uv.y));
  float md = smoothstep(-0.7, 1., -uv.y*uv.x); flame *= md*md;
  vec3 bg = uBg * (1.0 - 0.4 * length(uv));
  vec3 halo = texture2D(haloTexture, vUv).xyz;
  gl_FragColor = vec4(bg + flame*uFlameAmt + texture2D(bloomTexture, vUv).xyz + texture2D(torusTexture, vUv).xyz + texture2D(tDiffuse, vUv).xyz + halo, 1.);
}`,
};

// ---------------------------------------------------------------- brain geometry

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Particles on a brain's surface: two folded hemispheres, a ridged cerebellum and a brainstem. */
export function brainCloud(n: number) {
  const r = mulberry(29);
  const pos = new Float32Array(n * 3);
  const start = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const part = new Float32Array(n);
  const dir = () => {
    const u = r() * 2 - 1;
    const t = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return [s * Math.cos(t), u, s * Math.sin(t)] as const;
  };
  const gyri = (x: number, y: number, z: number) =>
    Math.sin(7.3 * x + 2.1 * Math.sin(3.1 * z)) * Math.sin(6.1 * y + 1.7 * Math.cos(4.3 * x)) * Math.sin(5.7 * z + 1.9 * Math.sin(2.9 * y));
  let i = 0;
  let guard = 0;
  while (i < n && guard++ < n * 20) {
    const pick = r();
    let x = 0;
    let y = 0;
    let z = 0;
    let kind = 0;
    if (pick < 0.8) {
      // cerebrum: one hemisphere, folded
      const side = r() < 0.5 ? -1 : 1;
      const [dx, dy, dz] = dir();
      if (dx * side < -0.25) continue; // the inner wall faces the fissure
      const g = gyri(dx * 1.3, dy * 1.3, dz * 1.3);
      if (r() > 0.32 + 0.68 * Math.max(0, Math.min(1, (g + 0.25) / 0.85))) continue; // density follows the folds
      const shell = 0.93 + 0.07 * Math.pow(r(), 0.4);
      const fold = 1 + 0.075 * g;
      x = side * 0.47 + dx * 0.62 * shell * fold * (1 - 0.08 * Math.max(0, dz));
      y = 0.12 + dy * 0.78 * shell * fold;
      z = dz * 1.18 * shell * fold;
      if (y < -0.22) y = -0.22 + (y + 0.22) * 0.55; // flatter underside
      if (dz > 0.05 && dz < 0.75 && dy < 0.05) x += side * 0.07; // temporal lobes
    } else if (pick < 0.94) {
      // cerebellum, finely ridged
      kind = 1;
      const [dx, dy, dz] = dir();
      if (Math.abs(Math.sin(dy * 34)) < 0.35 && r() < 0.75) continue;
      x = dx * 0.6;
      y = -0.5 + dy * 0.3;
      z = -0.8 + dz * 0.38;
    } else {
      // brainstem
      kind = 2;
      const t = r();
      const a = r() * Math.PI * 2;
      const rad = 0.13 * (1 - 0.35 * t);
      x = Math.cos(a) * rad;
      y = -0.45 - t * 0.8;
      z = -0.32 + t * 0.12 + Math.sin(a) * rad;
    }
    pos.set([x, y, z], i * 3);
    // start: scattered through the tunnel, so the brain "assembles" out of it
    const [sx, sy, sz] = dir();
    const R = 4 + r() * 7;
    start.set([sx * R, sy * R * 0.7, sz * R - 2], i * 3);
    seed[i] = r();
    part[i] = kind;
    i++;
  }
  return { pos: pos.subarray(0, i * 3), start: start.subarray(0, i * 3), seed: seed.subarray(0, i), part: part.subarray(0, i), count: i };
}

// ---------------------------------------------------------------- the scene

export interface DenOptions {
  canvas: HTMLCanvasElement;
  mobile: boolean;
  reduced: boolean;
  /** called after every resize with the brain's on-screen centre and radius, in CSS px */
  onLayout?: (x: number, y: number, r: number) => void;
}

export class Den {
  private renderer: THREE.WebGL1Renderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private group = new THREE.Group();
  private brain = new THREE.Group();
  private pupil!: THREE.Mesh;
  private uniforms: Record<string, THREE.IUniform>;
  private brainU: Record<string, THREE.IUniform>;
  private atmo: THREE.Points;
  private bloomComposer: EffectComposer;
  private finalComposer: EffectComposer;
  private finalPass: ShaderPass;
  private raf = 0;
  private t0 = performance.now() / 1000;
  private appearStart = performance.now();
  private rollPhase = 0;
  private scrollTarget = 0;
  private scrollSmooth = 0;
  private scrollCurrent = 0;
  private mouse = { x: 0, y: 0 };
  private mouseTarget = { x: 0, y: 0 };
  private POINTER = { active: false, lastMove: 0, world: new THREE.Vector3(), activity: 0 };
  private talk = 0;
  private talking = false;
  private yaw = -1.2;
  private pitch = 0.12;
  private brainBase = new THREE.Vector3();
  private brainScale = 1.3;
  private look = { x: 0, y: 0 }; // aims the tunnel's throat behind the brain on the opening station
  private opts: DenOptions;
  private disposers: (() => void)[] = [];
  private _ndc = new THREE.Vector3();
  private _dir = new THREE.Vector3();
  private _tgt = new THREE.Vector3();
  private _v = new THREE.Vector3();

  constructor(opts: DenOptions) {
    this.opts = opts;
    const { canvas, mobile } = opts;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);
    this.renderer = new THREE.WebGL1Renderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;

    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 0, 15);
    this.camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
    this.camera.position.set(0, 0, 20);
    this.camera.layers.enable(LAYERS.TORUS_SCENE);
    this.camera.layers.enable(LAYERS.BLOOM_SCENE);
    this.camera.layers.enable(LAYERS.ENTIRE_SCENE);
    this.scene.add(this.camera);

    // ---------------- tunnel (verbatim; thinner grid on phones)
    this.uniforms = {
      uTime: { value: 0 },
      uAppear: { value: 0 },
      uColLow: { value: hexToVec3("#180a3a") },
      uColHigh: { value: hexToVec3("#2bf0ff") },
      uOpacity: { value: 1.44 },
      uSize: { value: 5 },
      uBrightness: { value: 0.4 },
      uSwirl: { value: 0.39 },
      uScale: { value: 0.17 },
      uCursor: { value: new THREE.Vector3() },
      uRepelRadius: { value: 2.4 },
      uRepelStrength: { value: 0.8 },
      uActivity: { value: 0 },
    };
    const tunnelGeo = mobile ? new THREE.SphereGeometry(4.2, 100, 300) : new THREE.SphereGeometry(4.2, 200, 600);
    const tunnelMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
uniform float uTime; uniform float uSize; uniform float uSwirl; uniform float uScale;
uniform vec3 uColLow; uniform vec3 uColHigh;
uniform vec3 uCursor; uniform float uRepelRadius; uniform float uRepelStrength; uniform float uActivity;
varying float vFade; varying vec3 vColor;
${SNOISE}
void main() {
  vec3 wp = vec3(position.x * 7.0, 0.0, position.z * 25.0);
  wp.x += position.y * 6.0;
  float wn = snoise(vec3(wp.x * 0.08, wp.z * 0.08, uTime * 0.15)) * 2.0;
  wn += snoise(vec3(wp.x * 0.16, wp.z * 0.16, uTime * 0.3)) * 0.8;

  float tunnelR = 12.0;
  float currentSliceRadius = sqrt(max(0.0, 17.64 - position.z * position.z));
  float maxSliceWidth = 9.2195 * currentSliceRadius;
  float normalizedX = wp.x / (maxSliceWidth + 0.001);
  float tunnelAngle = normalizedX * 3.14159265;

  float jitterAngle = snoise(vec3(position.x * 15.0, position.y * 15.0, uTime * 0.1)) * 0.35;
  float jitterZ = snoise(vec3(position.y * 15.0, position.z * 15.0, uTime * 0.1)) * 4.0;
  float ambientSwirl = snoise(vec3(position.x * 5.0, position.y * 5.0, uTime * 0.2)) * 3.0;
  tunnelAngle += jitterAngle + ambientSwirl * uSwirl;

  float dynamicR = tunnelR - wn;
  vec3 tunnelPos = vec3(dynamicR * sin(tunnelAngle), -dynamicR * cos(tunnelAngle), wp.z + jitterZ);

  vec3 finalPos = tunnelPos * uScale;
  vec4 modelPosition = modelMatrix * vec4(finalPos, 1.0);
  vec3 toP = modelPosition.xyz - uCursor;
  float cd = length(toP);
  float fall = smoothstep(uRepelRadius, 0.0, cd);
  modelPosition.xyz += normalize(toP + vec3(0.0001)) * fall * uRepelStrength * uActivity;
  vec4 mvPosition = viewMatrix * modelPosition;

  float colMix = smoothstep(-3.0, 3.0, position.y + position.x * 0.5);
  vColor = mix(uColLow, uColHigh, clamp(colMix, 0.0, 1.0));
  vFade = 1.0;

  gl_PointSize = uSize * (10.0 / -mvPosition.z);
  gl_PointSize = max(gl_PointSize, 1.5);
  gl_Position = projectionMatrix * mvPosition;
}`,
      fragmentShader: `
uniform float uOpacity; uniform float uBrightness; uniform float uAppear;
varying float vFade; varying vec3 vColor;
void main() {
  vec2 xy = gl_PointCoord - 0.5;
  float ll = length(xy);
  if (ll > 0.5) discard;
  float a = smoothstep(0.5, 0.1, ll);
  gl_FragColor = vec4(vColor * uBrightness, vFade * a * uOpacity * uAppear);
}`,
    });
    const tunnel = new THREE.Points(tunnelGeo, tunnelMat);
    tunnel.frustumCulled = false;
    tunnel.layers.enable(LAYERS.ENTIRE_SCENE);
    this.group.add(tunnel);
    this.scene.add(this.group);

    // ---------------- atmosphere motes (verbatim)
    const N = 300;
    const positions = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      positions[i * 3] = 2 * Math.random() - 1;
      positions[i * 3 + 1] = 2 * Math.random() - 1;
      positions[i * 3 + 2] = 2 * Math.random() - 1;
      sizes[i] = 24 * (0.4 + Math.random());
      seeds[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    g.setAttribute("seed", new THREE.Float32BufferAttribute(seeds, 1));
    const atmoMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: hexToVec3("#8fe6ff") },
        uRes: { value: new THREE.Vector2(innerWidth * dpr, innerHeight * dpr) },
      },
      vertexShader: `
attribute float size; attribute float seed; uniform float uTime; uniform vec2 uRes;
varying float vA;
vec3 warp(vec3 p, float t){ float c=0.9,a=1.9,b=0.02,s=0.05; p*=2.;
  p.x+=c*sin(s*t+a*p.y)+t*b; p.y+=c*cos(s*t+a*p.x); p.y+=c*sin(s*t+a*p.z)+t*b;
  p.z+=c*cos(s*t+a*p.y); p.z+=c*sin(s*t+a*p.x)+t*b; p.x+=c*cos(s*t+a*p.z);
  return cos(p+vec3(1,2,4)); }
void main(){
  vec3 v = position*4.0 + warp(position, uTime)*1.2;
  vec4 mv = modelViewMatrix * vec4(v, 1.0);
  float r = length(v); float farF = 1.0 - smoothstep(5.0, 6.5, r); float nearF = smoothstep(0.0, 0.5, -mv.z);
  vA = farF * nearF;
  gl_PointSize = size * uRes.y / 900.0 / -mv.z; gl_PointSize = max(gl_PointSize, 1.0);
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `
uniform vec3 uColor; varying float vA;
void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
  float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * 0.6); }`,
    });
    this.atmo = new THREE.Points(g, atmoMat);
    this.atmo.frustumCulled = false;
    this.atmo.layers.enable(LAYERS.ENTIRE_SCENE);
    this.atmo.onBeforeRender = () => {
      const t = performance.now() / 1000;
      atmoMat.uniforms.uTime!.value = t * 1.0 * 8.0;
      this.atmo.position.copy(this.camera.position);
      this.finalPass.uniforms.iTime!.value = t;
    };
    this.scene.add(this.atmo);

    // ---------------- the brain (Jarvis's head)
    const cloud = brainCloud(mobile ? 9000 : 22000);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(cloud.pos, 3));
    bg.setAttribute("aStart", new THREE.BufferAttribute(cloud.start, 3));
    bg.setAttribute("aSeed", new THREE.BufferAttribute(cloud.seed, 1));
    bg.setAttribute("aPart", new THREE.BufferAttribute(cloud.part, 1));
    this.brainU = {
      uTime: { value: 0 },
      uForm: { value: opts.reduced ? 1 : 0 },
      uTalk: { value: 0 },
      uCursor: { value: new THREE.Vector3(99, 99, 99) },
      uActivity: { value: 0 },
      uOpacity: { value: 1 },
      uSize: { value: mobile ? 1.5 : 1.55 },
      uPixel: { value: (innerHeight * dpr) / 900 },
      uA: { value: hexToVec3("#2bf0ff") },
      uB: { value: hexToVec3("#7a3cff") },
      uLow: { value: hexToVec3("#180a3a") },
    };
    const brainMat = new THREE.ShaderMaterial({
      uniforms: this.brainU,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
attribute vec3 aStart; attribute float aSeed; attribute float aPart;
uniform float uTime; uniform float uForm; uniform float uTalk; uniform vec3 uCursor; uniform float uActivity;
uniform float uSize; uniform float uPixel; uniform vec3 uA; uniform vec3 uB; uniform vec3 uLow;
varying vec3 vColor; varying float vA;
${SNOISE}
void main(){
  float d = clamp(uForm * 1.6 - aSeed * 0.6, 0.0, 1.0);
  float e = d * d * (3.0 - 2.0 * d);
  vec3 swirl = vec3(cos(uTime * 0.4 + aSeed * 6.28), sin(uTime * 0.4 + aSeed * 6.28), 0.0) * (1.0 - e) * 1.5;
  vec3 p = mix(aStart + swirl, position, e);
  p += normalize(position + 1e-4) * sin(uTime * 1.3 + aSeed * 6.2832) * 0.008;
  p += vec3(snoise(position * 2.0 + uTime * 0.15), snoise(position * 2.0 + 11.0 + uTime * 0.15), snoise(position * 2.0 + 23.0 + uTime * 0.15)) * 0.018 * (1.0 + uTalk * 2.5);
  float r = length(position);
  p += normalize(position + 1e-4) * uTalk * 0.07 * sin(r * 9.0 - uTime * 9.0);
  vec3 toP = p - uCursor;
  float fall = smoothstep(0.85, 0.0, length(toP));
  p += normalize(toP + 1e-4) * fall * 0.32 * uActivity;

  float wave = fract(position.z * 0.33 - uTime * 0.21 + position.y * 0.08);
  float pulse = smoothstep(0.0, 0.05, wave) * smoothstep(0.14, 0.05, wave);
  float spark = step(0.993, fract(aSeed * 91.7 + floor(uTime * 2.5 + aSeed * 7.0) * 0.37));
  vec3 c = mix(uLow, uA, 0.35 + 0.65 * smoothstep(-0.8, 1.0, position.y + position.z * 0.2));
  c = mix(c, uB, aPart > 0.5 ? 0.7 : 0.18 * (1.0 - smoothstep(-0.2, 0.9, position.y)));
  vColor = c * (0.42 + pulse * 1.25 + spark * 2.2 + uTalk * 0.55);
  vA = 0.2 + 0.8 * e;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (1.0 + spark * 1.6 + pulse * 0.7 + uTalk * 0.3) * uPixel * 10.0 / -mv.z;
  gl_PointSize = max(gl_PointSize, 1.0);
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `
uniform float uOpacity; varying vec3 vColor; varying float vA;
void main(){ vec2 q = gl_PointCoord - 0.5; float l = length(q); if (l > 0.5) discard;
  float a = smoothstep(0.5, 0.05, l); gl_FragColor = vec4(vColor * a, a * vA * uOpacity); }`,
    });
    const brainPts = new THREE.Points(bg, brainMat);
    brainPts.frustumCulled = false;
    brainPts.layers.enable(LAYERS.BLOOM_SCENE);
    brainPts.layers.enable(LAYERS.ENTIRE_SCENE);
    this.brain.add(brainPts);
    this.camera.add(this.brain);
    brainPts.renderOrder = 2;
    tunnel.renderOrder = 0;

    // a dark pupil behind the head: the wormhole's throat, so the brain reads on black and the walls swirl round it
    const pupilMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: hexToVec3("#04020c") }, uAlpha: { value: 0.94 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
void main(){ float d = length(vUv * 2.0 - 1.0); gl_FragColor = vec4(uColor, uAlpha * smoothstep(1.0, 0.6, d)); }`,
    });
    this.pupil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pupilMat);
    this.pupil.renderOrder = 1;
    this.pupil.frustumCulled = false;
    this.pupil.layers.enable(LAYERS.ENTIRE_SCENE);
    this.camera.add(this.pupil);

    // ---------------- postprocessing (the spec's composers; see header for the torus one)
    const renderScene = new RenderPass(this.scene, this.camera);
    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(renderScene);
    this.bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.6, 0));
    this.bloomComposer.addPass(new ShaderPass(GammaCorrectionShader));
    this.finalPass = new ShaderPass(FinalPass);
    this.finalPass.uniforms.bloomTexture!.value = this.bloomComposer.renderTarget1.texture;
    this.finalComposer = new EffectComposer(this.renderer);
    this.finalComposer.addPass(renderScene);
    this.finalComposer.addPass(this.finalPass);

    // ---------------- input
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      this.scrollTarget = clamp(h > 0 ? scrollY / h : 0, 0, 1);
    };
    const onMove = (e: PointerEvent) => {
      this.mouseTarget.x = (e.clientX / innerWidth) * 2 - 1;
      this.mouseTarget.y = -((e.clientY / innerHeight) * 2 - 1);
      this.POINTER.active = true;
      this.POINTER.lastMove = performance.now();
    };
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) this.POINTER.active = false;
    };
    const onResize = () => this.resize();
    const onVis = () => (document.hidden ? this.stop() : this.start());
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseout", onOut);
    addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    this.disposers.push(() => {
      removeEventListener("scroll", onScroll);
      removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseout", onOut);
      removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    });
    onScroll();
    this.resize();
  }

  /** Jarvis is speaking: the brain ripples and brightens. */
  setTalking(on: boolean) {
    this.talking = on;
  }

  private layoutBrain() {
    const aspect = innerWidth / innerHeight;
    const depth = 9;
    const halfH = depth * Math.tan(THREE.MathUtils.degToRad(22.5));
    const halfW = halfH * aspect;
    const narrow = aspect < 0.85;
    this.brainScale = narrow ? Math.min(1.25, halfW * 0.78) : Math.min(1.4, halfH * 0.33);
    this.brainBase.set(narrow ? halfW * 0.22 : halfW * 0.5, narrow ? halfH * 0.5 : halfH * 0.04, -depth);
    const px = (x: number, y: number): [number, number] => [((x / halfW) * 0.5 + 0.5) * innerWidth, (0.5 - (y / halfH) * 0.5) * innerHeight];
    const [cx, cy] = px(this.brainBase.x, this.brainBase.y);
    const radius = ((this.brainScale * 1.25) / halfH) * 0.5 * innerHeight;
    // the camera looks 12 units ahead; turning it away from the brain puts the throat behind it
    const tan = Math.tan(THREE.MathUtils.degToRad(22.5));
    this.look.x = -12 * (this.brainBase.x / depth);
    this.look.y = -12 * (this.brainBase.y / depth) * (tan / tan);
    this.opts.onLayout?.(cx, cy, radius);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.mobile ? 1.25 : 2);
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const c of [this.bloomComposer, this.finalComposer]) {
      c.setPixelRatio(dpr);
      c.setSize(w, h);
    }
    (this.atmo.material as THREE.ShaderMaterial).uniforms.uRes!.value.set(w * dpr, h * dpr);
    this.brainU.uPixel!.value = (h * dpr) / 900;
    this.layoutBrain();
    if (this.opts.reduced) this.frame();
  }

  private updatePointerWorld() {
    const { _ndc, _dir, _tgt, POINTER, camera, mouse } = this;
    _tgt.set(0, 0, 0);
    if (POINTER.active) {
      _ndc.set(mouse.x, mouse.y, 0.5).unproject(camera);
      _dir.copy(_ndc).sub(camera.position).normalize();
      const dn = _dir.z;
      if (Math.abs(dn) > 1e-4) {
        const tt = -camera.position.z / dn;
        if (tt > 0 && Number.isFinite(tt)) _tgt.copy(camera.position).addScaledVector(_dir, tt);
      }
    }
    POINTER.world.lerp(_tgt, 0.12);
    const idle = (performance.now() - POINTER.lastMove) / 1000;
    POINTER.activity += ((POINTER.active && idle < 3 ? 1 : 0) - POINTER.activity) * 0.06;
  }

  private frame = () => {
    this.scrollSmooth = Lerp(this.scrollSmooth, this.scrollTarget, 0.1);
    this.scrollCurrent = Lerp(this.scrollCurrent, this.scrollSmooth, 0.06);
    this.mouse.x = Lerp(this.mouse.x, this.mouseTarget.x, 0.06);
    this.mouse.y = Lerp(this.mouse.y, this.mouseTarget.y, 0.06);
    const scroll = this.scrollCurrent;
    const m = this.mouse;

    // ---- the spec's per-frame update
    const t = performance.now() / 1000;
    const dt = Math.min(0.05, t - this.t0);
    this.t0 = t;
    const u = this.uniforms;
    u.uTime!.value = t;
    this.camera.position.set(m.x * 0.12, m.y * 0.12, 20 - scroll * 34);
    const lead = 1 - clamp((scroll - 0.015) / 0.08, 0, 1);
    this.camera.lookAt(m.x * 0.6 + this.look.x * lead, m.y * 0.6 + this.look.y * lead, this.camera.position.z - 12);
    this.updatePointerWorld();
    u.uSwirl!.value = 0.39 * (1 + scroll * 1.5);
    this.rollPhase += dt * (0.065 + scroll * 0.05);
    this.group.rotation.z = this.rollPhase;
    (u.uCursor!.value as THREE.Vector3).copy(this.POINTER.world);
    u.uActivity!.value = this.POINTER.activity;
    const elapsed = (performance.now() - this.appearStart) / 1000;
    u.uAppear!.value = this.opts.reduced ? 1 : Math.max(0, Math.min(1, (elapsed - 0.2) / 1.4));

    // ---- the brain
    const b = this.brainU;
    b.uTime!.value = t;
    if (!this.opts.reduced) b.uForm!.value = Math.min(1, Math.max(0, (elapsed - 0.5) / 3.2));
    this.talk += ((this.talking ? 1 : 0) - this.talk) * 0.08;
    b.uTalk!.value = this.talk;
    // leans toward the cursor; steps back and dims once you scroll past the opening station
    const away = clamp((scroll - 0.015) / 0.08, 0, 1);
    this.yaw = Lerp(this.yaw, -1.2 + m.x * 0.55 + Math.sin(t * 0.25) * 0.12, 0.05);
    this.pitch = Lerp(this.pitch, 0.12 - m.y * 0.3 + Math.sin(t * 0.31) * 0.05, 0.05);
    this.brain.rotation.set(this.pitch, this.yaw, 0);
    this.brain.position.copy(this.brainBase);
    this.brain.position.y += Math.sin(t * 0.8) * 0.06;
    this.brain.scale.setScalar(this.brainScale * (1 - 0.18 * away) * (1 + this.talk * 0.03));
    b.uOpacity!.value = 1 - 0.62 * away;
    this.pupil.position.set(this.brainBase.x, this.brainBase.y, this.brainBase.z - 0.8);
    this.pupil.scale.setScalar(this.brainScale * 1.25 * 1.25);
    ((this.pupil.material as THREE.ShaderMaterial).uniforms.uAlpha!).value = 0.94 * (1 - away);
    // cursor in the brain's own space, at the brain's depth
    const aspect = innerWidth / innerHeight;
    const halfH = 9 * Math.tan(THREE.MathUtils.degToRad(22.5));
    this._v.set(m.x * halfH * aspect, m.y * halfH, -9);
    this.camera.updateMatrixWorld();
    this.camera.localToWorld(this._v);
    this.brain.worldToLocal(this._v);
    (b.uCursor!.value as THREE.Vector3).copy(this._v);
    b.uActivity!.value = this.POINTER.activity;

    // ---- the spec's render: bloom composer (layer 2), then the final composite (layer 3)
    this.camera.layers.set(LAYERS.BLOOM_SCENE);
    this.bloomComposer.render();
    this.camera.layers.set(LAYERS.ENTIRE_SCENE);
    this.finalComposer.render();

    if (!this.opts.reduced) this.raf = requestAnimationFrame(this.frame);
  };

  start() {
    if (this.raf || this.opts.reduced) return this.opts.reduced && this.frame();
    this.t0 = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    this.stop();
    this.disposers.forEach((d) => d());
    this.renderer.dispose();
  }
}
