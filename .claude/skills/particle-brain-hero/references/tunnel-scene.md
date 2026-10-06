# Recreate this Three.js scene: Tunnel

(Siddharth's prompt, saved verbatim. Source: getlayers.ai "Tunnel" scene, Free / commercial licence.)

You are an expert Three.js creative developer. Produce a **single self-contained `index.html`**
that renders the scene below **exactly** as specified — same geometry, shaders, colors, motion,
and postprocessing. Load Three.js **r0.143.0** via an ES-module importmap from unpkg; no build
step, no bundler, pure ES modules in one `<script type="module">`. Hardcode every value given
here as fixed constants.

## What it looks like
A glowing wormhole: a cylindrical tunnel of additive points whose walls ripple and swirl with
noise, lit in deep-indigo-to-electric-cyan with violet corner flames bleeding in from the edges.
The camera sits inside the tube and, as you scroll, warp-flies deeper down the throat while the
wall swirl intensifies; the cursor gently banks the flight toward it and parts the walls where it
points. Faint cyan motes drift past the camera.

## Page & boilerplate
- importmap: `three` → `https://unpkg.com/three@0.143.0/build/three.module.js`,
  `three/addons/` → `https://unpkg.com/three@0.143.0/examples/jsm/`.
- Imports: `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `ShaderPass` from
  `three/addons/postprocessing/…`; `GammaCorrectionShader`, `CopyShader` from
  `three/addons/shaders/…`.
- Black page (`html, body { margin:0; padding:0; background:#000 }`, `body { height:100% }`).
- A full-window pinned `<canvas id="scene">` (`position:fixed; inset:0; width:100vw; height:100vh; display:block`)
  and a tall scroll host `<div id="scroll-host" style="height:560vh"></div>` so the page scrolls
  (drives the warp-fly down the tube). Optional fixed `#scroll-hint` label reading `scroll ↓`
  (centered, bottom 18px, `rgba(255,255,255,.55)`, 11px uppercase, `pointer-events:none`).
- `THREE.WebGL1Renderer({ canvas, antialias:true })`, `setPixelRatio(window.devicePixelRatio)`,
  `shadowMap.enabled = true`, `shadowMap.type = THREE.VSMShadowMap`.
- Scene background `0x000000`, `fog = new THREE.Fog(0x000000, 0, 15)`.
- Camera `PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 400)` at `(0, 0, 20)`.
- **Layers:** `LAYERS = { NONE:0, TORUS_SCENE:1, BLOOM_SCENE:2, ENTIRE_SCENE:3 }`. Enable layers
  1, 2, 3 on the camera; add the camera to the scene. Both Points objects below enable layer
  `ENTIRE_SCENE` (3).
- Helpers:
  ```js
  const Lerp = (a, b, t) => a + (b - a) * t
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  function hexToVec3(hex) {
    const n = parseInt(hex.slice(1), 16)
    return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  }
  ```

## Fixed parameters (bake these in)
Use these literal constants directly wherever referenced (no config object, no persistence):

- Background color `bgColor = #0a0524`
- Corner-flame color A `flameColor = #2bf0ff`, color B `flameColor2 = #7a3cff`, amount `flameAmt = 0.2`
- Atmosphere motes: color `atmoColor = #8fe6ff`, count `atmoCount = 300`, size `atmoSize = 24`, speed `atmoSpeed = 1.0`
- Wall palette: `colorLow = #180a3a`, `colorHigh = #2bf0ff`
- Look: `opacity = 1.44`, `pointSize = 5`, `brightness = 0.4`
- Motion: `swirl = 0.39`, `spin = 0.065`, `scale = 0.17`
- Scroll: `scrollFly = 34`, `scrollSwirl = 1.5`, `scrollRoll = 0.05`
- Pointer/camera: `steer = 0.6`, `parallax = 0.12`, `pointerRadius = 2.4`, `pointerStrength = 0.8`

## Postprocessing
Three composers driven per-frame by switching `camera.layers`:

```js
const renderScene = new RenderPass(scene, camera)

// torus composer — renders the points + reduced bloom, off-screen
const torusComposer = new EffectComposer(renderer); torusComposer.renderToScreen = false
torusComposer.addPass(renderScene)
torusComposer.addPass(new ShaderPass(GammaCorrectionShader))
torusComposer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.2, 0))
torusComposer.addPass(new ShaderPass(CopyShader))

// bloom composer — stronger bloom, off-screen
const bloomComposer = new EffectComposer(renderer); bloomComposer.renderToScreen = false
bloomComposer.addPass(renderScene)
bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.6, 0))
bloomComposer.addPass(new ShaderPass(GammaCorrectionShader))

// final composer — composites everything to screen via FinalPass
const finalPass = new ShaderPass(FinalPass)
finalPass.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture
finalPass.uniforms.torusTexture.value = torusComposer.renderTarget1.texture
const finalComposer = new EffectComposer(renderer)
finalComposer.addPass(renderScene); finalComposer.addPass(finalPass)
```

`UnrealBloomPass` args are `(resolution, strength, radius, threshold)`: torus bloom
`strength 0.22, radius 0.2, threshold 0`; main bloom `strength 0.7, radius 0.6, threshold 0`.

On resize: `renderer.setPixelRatio(dpr)`, `renderer.setSize(w, h, false)`, update
`camera.aspect`/`updateProjectionMatrix()`, and for each of the three composers call
`setPixelRatio(dpr)` and `setSize(w, h)`.

### FinalPass — composite + dark complementary background + corner flames (verbatim)
`haloTexture` is never assigned and stays `null` (sampling a null sampler reads black — keep it as
written). `iTime` is advanced from the atmosphere `onBeforeRender` (see Animation). Uniforms:

```js
const FinalPass = {
  uniforms: {
    iTime: { value: 0 },
    tDiffuse: { value: null }, torusTexture: { value: null }, bloomTexture: { value: null }, haloTexture: { value: null },
    uBg: { value: hexToVec3('#0a0524') },
    uFlameA: { value: hexToVec3('#2bf0ff') },
    uFlameB: { value: hexToVec3('#7a3cff') },
    uFlameAmt: { value: 0.2 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `…see GLSL below…`
}
```

```glsl
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
}
```

## Shared GLSL (3D simplex noise)
Prepend this exact snippet into the tunnel vertex shader (where `${SNOISE}` is referenced):

```glsl
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
```

## Geometry — the tunnel points
One `THREE.Points` from `new THREE.SphereGeometry(4.2, 200, 600)` (widthSegments 200,
heightSegments 600 — the sphere's `position` attribute is reused purely as a parameter grid; the
vertex shader remaps every vertex into the cylindrical tunnel). Set `points.frustumCulled = false`,
enable layer `ENTIRE_SCENE`, and add it inside a `THREE.Group` (the group is barrel-rolled on
`rotation.z` each frame).

`ShaderMaterial` with `transparent:true, depthWrite:false, blending:THREE.AdditiveBlending`.
Uniforms (defaults baked):

```js
const uniforms = {
  uTime:       { value: 0 },
  uAppear:     { value: 0 },
  uColLow:     { value: hexToVec3('#180a3a') },
  uColHigh:    { value: hexToVec3('#2bf0ff') },
  uOpacity:    { value: 1.44 },
  uSize:       { value: 5 },
  uBrightness: { value: 0.4 },
  uSwirl:      { value: 0.39 },
  uScale:      { value: 0.17 },
  uCursor:        { value: new THREE.Vector3() },
  uRepelRadius:   { value: 2.4 },
  uRepelStrength: { value: 0.8 },
  uActivity:      { value: 0 }
}
```

## Material & shaders — tunnel (verbatim)

Vertex shader (with `${SNOISE}` from above injected at the marked point):

```glsl
uniform float uTime; uniform float uSize; uniform float uSwirl; uniform float uScale;
uniform vec3 uColLow; uniform vec3 uColHigh;
uniform vec3 uCursor; uniform float uRepelRadius; uniform float uRepelStrength; uniform float uActivity;
varying float vFade; varying vec3 vColor;
// >>> inject the shared 3D simplex noise (snoise) here <<<
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
}
```

Fragment shader:

```glsl
uniform float uOpacity; uniform float uBrightness; uniform float uAppear;
varying float vFade; varying vec3 vColor;
void main() {
  vec2 xy = gl_PointCoord - 0.5;
  float ll = length(xy);
  if (ll > 0.5) discard;
  float a = smoothstep(0.5, 0.1, ll);
  gl_FragColor = vec4(vColor * uBrightness, vFade * a * uOpacity * uAppear);
}
```

## Atmosphere — ambient drifting motes (verbatim)
A second `THREE.Points`, camera-attached, that drifts cyan motes past the lens. Build `N = 300`
points; per point a random position in `[-1,1]³`, a `size = 24 * (0.4 + random())`, and a random
`seed`:

```js
const N = 300
const positions = new Float32Array(N * 3), sizes = new Float32Array(N), seeds = new Float32Array(N)
for (let i = 0; i < N; i++) {
  positions[i*3] = 2*Math.random()-1; positions[i*3+1] = 2*Math.random()-1; positions[i*3+2] = 2*Math.random()-1
  sizes[i] = 24 * (0.4 + Math.random()); seeds[i] = Math.random()
}
const g = new THREE.BufferGeometry()
g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
g.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1))
g.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1))
```

`ShaderMaterial` with `transparent:true, blending:THREE.AdditiveBlending, depthWrite:false,
depthTest:false`. Uniforms:

```js
uniforms: {
  uTime: { value: 0 },
  uColor: { value: hexToVec3('#8fe6ff') },
  uRes: { value: new THREE.Vector2(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio) }
}
```

Vertex shader:

```glsl
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
}
```

Fragment shader:

```glsl
uniform vec3 uColor; varying float vA;
void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
  float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * 0.6); }
```

Set `points.frustumCulled = false`, enable layer `ENTIRE_SCENE`, add to the scene. Each frame
(via `onBeforeRender`): with `t = performance.now()/1000`, set
`uTime = t * atmoSpeed * 8.0` (atmoSpeed = 1.0, so `t * 8.0`), copy the camera position into the
points' position so the motes follow the lens, and set `finalPass.uniforms.iTime.value = t`.

## Animation & interaction

**Scroll (double-damped 0..1):** `scrollTarget = clamp(scrollY / (scrollHeight - innerHeight), 0, 1)`
on scroll/resize. Each frame: `scrollSmooth = Lerp(scrollSmooth, scrollTarget, 0.10)`, then
`scrollCurrent = Lerp(scrollCurrent, scrollSmooth, 0.06)`. Pass `scrollCurrent` to the scene.

**Pointer:** track `mouseTarget` in NDC from `mousemove`
(`x = clientX/innerWidth*2-1`, `y = -(clientY/innerHeight*2-1)`); mark `POINTER.active = true` and
record `POINTER.lastMove = performance.now()`; on `mouseout` set `POINTER.active = false`. Each
frame smooth `mouse.x = Lerp(mouse.x, mouseTarget.x, 0.06)`, `mouse.y = Lerp(mouse.y, mouseTarget.y, 0.06)`.

**Pointer → world void** (`updatePointerWorld`, called inside the scene's per-frame update):

```js
const _ndc = new THREE.Vector3(), _dir = new THREE.Vector3(), _tgt = new THREE.Vector3()
function updatePointerWorld() {
  _tgt.set(0, 0, 0)
  if (POINTER.active) {
    _ndc.set(mouse.x, mouse.y, 0.5).unproject(camera)
    _dir.copy(_ndc).sub(camera.position).normalize()
    const dn = _dir.z
    if (Math.abs(dn) > 1e-4) { const tt = -camera.position.z / dn; if (tt > 0 && Number.isFinite(tt)) _tgt.copy(camera.position).addScaledVector(_dir, tt) }
  }
  POINTER.world.lerp(_tgt, 0.12)
  const idle = (performance.now() - POINTER.lastMove) / 1000
  POINTER.activity += (((POINTER.active && idle < 3) ? 1 : 0) - POINTER.activity) * 0.06
}
```

**Per-frame scene update** (`render(scroll, m)` where `m = mouse`):

```js
const t = performance.now() / 1000
const dt = Math.min(0.05, t - this.t0); this.t0 = t   // this.t0 initialised to performance.now()/1000
uniforms.uTime.value = t

// warp-fly down the tube; bank the flight toward the cursor
camera.position.set(m.x * 0.12, m.y * 0.12, 20 - scroll * 34)            // parallax 0.12, scrollFly 34
camera.lookAt(m.x * 0.6, m.y * 0.6, camera.position.z - 12)             // steer 0.6
updatePointerWorld()

uniforms.uSwirl.value = 0.39 * (1 + scroll * 1.5)                       // swirl 0.39, scrollSwirl 1.5
this.rollPhase += dt * (0.065 + scroll * 0.05)                         // spin 0.065, scrollRoll 0.05
group.rotation.z = this.rollPhase                                      // rollPhase starts at 0

uniforms.uCursor.value.copy(POINTER.world)
uniforms.uActivity.value = POINTER.activity
const elapsed = (performance.now() - this.appearStart) / 1000          // appearStart = performance.now() at construction
uniforms.uAppear.value = Math.max(0, Math.min(1, (elapsed - 0.2) / 1.4))   // 0.2s delay, 1.4s fade-in
```

**Render loop** (drives the three composers by switching the camera layer):

```js
function render() {
  requestAnimationFrame(render)
  scrollSmooth = Lerp(scrollSmooth, scrollTarget, 0.10)
  scrollCurrent = Lerp(scrollCurrent, scrollSmooth, 0.06)
  mouse.x = Lerp(mouse.x, mouseTarget.x, 0.06)
  mouse.y = Lerp(mouse.y, mouseTarget.y, 0.06)
  sceneObj.render(scrollCurrent, mouse)
  camera.layers.set(LAYERS.TORUS_SCENE);  torusComposer.render()
  camera.layers.set(LAYERS.BLOOM_SCENE);  bloomComposer.render()
  camera.layers.set(LAYERS.ENTIRE_SCENE); finalComposer.render()
}
render()
```

## Assets
None — fully procedural.

Use exactly these parameter values — do not substitute your own:

Colours:
- atmoColor: #8fe6ff
- bgColor: #0a0524
- colorHigh: #2bf0ff
- colorLow: #180a3a
- flameColor: #2bf0ff
- flameColor2: #7a3cff

Settings:
- atmoCount: 300
- atmoSize: 24
- atmoSpeed: 1
- brightness: 0.4
- flameAmt: 0.2
- opacity: 1.44
- parallax: 0.12
- pointSize: 5
- pointerRadius: 2.4
- pointerStrength: 0.8
- scale: 0.17
- scrollFly: 34
- scrollRoll: 0.05
- scrollSwirl: 1.5
- spin: 0.065
- steer: 0.6
- swirl: 0.39
