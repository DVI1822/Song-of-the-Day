import type { Weather } from "@/lib/weather";
import { PERSPECTIVE, camInv, camV, type Camera, type V3 } from "./math";
import { CELLS, TEX, atlas } from "./textures";

// The weather and the season, in the Globe's own 3D space, drawn on the GPU.
//
// Everything lives in camera space at zoom 1 (px, centred on the globe, y
// down, z toward you) and is projected with exactly the browser's own
// perspective for the globe, so it sits in the same world. Two canvases do
// the drawing: one under the songs for everything further away than the
// globe's middle, one over them for everything nearer. A third, under both,
// paints the clouds.
//
// What's in it: soft clouds that slowly change shape, fine motion-blurred
// rain that splashes on the songs, snow, low mist, lightning; and, by season,
// leaves blowing past now and then in autumn, petals in spring, seeds on
// summer days and fireflies on summer nights, with a few flowers on the
// ground under the globe in spring and summer. All of it sparse.
//
// The globe is a real thing in that air. The wind parts round it and the
// spinning sphere drags a thin skin of air along, so light things (snow,
// petals, seeds) swirl past it, and heavier ones (leaves) hit it, lie flat
// against it, ride the spin for a moment and slide off. A snowflake that
// lands on it melts away in a few seconds, and a raindrop runs down it.

export type Season = "spring" | "summer" | "autumn" | "winter";

export function seasonAt(date: Date, lat: number): Season {
  const north: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const s = north[date.getMonth()];
  if (lat >= 0) return s;
  return s === "winter" ? "summer" : s === "summer" ? "winter" : s === "spring" ? "autumn" : "spring";
}

export type SceneFrame = {
  zoom: number;
  show: number; // 0..1, fades it all out in song view and the core
  w: number;
  h: number;
  cx: number;
  cy: number;
  R: number; // where drops meet the songs
  floorY: number;
  dk: number; // 0 day .. 1 night
  day: number; // how much sunlight
  L: V3; // toward the sun, camera space
  yaw: number;
  cam: Camera; // the globe's turn, to carry what's resting on it
  season: Season;
  hour: number;
  temp: number | null;
};

// How the weather shows on the songs themselves (GlobeApp's lighting uses it).
export type Look = { overcast: number; wet: number; frost: number };

const P = PERSPECTIVE;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const NEAR = 320; // closest anything comes, so nothing big streaks across the songs
const FAR = -1700;
const F = 17; // floats per instance
const MAX = 4000;

// --------------------------------------------------------------------------
// Shaders
// --------------------------------------------------------------------------

const NOISE = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

const PART_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec3 aP;
layout(location=2) in vec3 aU;
layout(location=3) in vec3 aV;
layout(location=4) in vec4 aCol;
layout(location=5) in vec4 aPrm;
uniform vec2 res;
uniform vec2 ctr;
uniform float zoom;
uniform vec3 sunL;
uniform float day;
uniform float direct;
out vec2 vUV;
out vec4 vCol;
flat out int vKind;
out float vTex;
out float vAux;
out float vShade;
out float vSeed;
const float P = ${P}.0;
float kAt(float z){ return zoom * P / max(1.0, P - z * zoom); }
vec2 proj(vec3 q){ return ctr + q.xy * kAt(q.z); }
void main(){
  int kind = int(aPrm.x + 0.5);
  vec2 s;
  vUV = corner;
  vShade = 1.0;
  vTex = aPrm.y;
  vAux = 0.0;
  vSeed = aPrm.w;
  if (kind == 0 || kind == 4) {
    // a streak from p-u to p+u, aPrm.z px wide on screen
    vec2 a = proj(aP - aU), b = proj(aP + aU);
    vec2 d = b - a;
    float l = length(d);
    vec2 dir = l > 0.001 ? d / l : vec2(0.0, 1.0);
    vec2 n = vec2(-dir.y, dir.x);
    float hw = aPrm.z * 0.5 + 1.0;
    s = mix(a, b, corner.y * 0.5 + 0.5) + dir * corner.y + n * corner.x * hw;
    vTex = hw;
    vAux = aPrm.z * 0.5;
  } else if (kind == 2) {
    // a painted thing with a real orientation: lit by the sun from both sides
    vec3 q = aP + aU * corner.x + aV * corner.y;
    s = proj(q);
    vec3 nr = normalize(cross(aU, aV));
    float lam = abs(dot(nr, sunL));
    vShade = mix(0.3, 0.62, day) + 0.5 * day * direct * lam;
  } else {
    // facing the camera: a soft dot or a puff of mist
    float k = kAt(aP.z);
    s = ctr + aP.xy * k + corner * aU.xy * k;
  }
  vCol = aCol;
  vKind = kind;
  gl_Position = vec4(s.x / res.x * 2.0 - 1.0, 1.0 - s.y / res.y * 2.0, 0.0, 1.0);
}`;

const PART_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec4 vCol;
flat in int vKind;
in float vTex;
in float vAux;
in float vShade;
in float vSeed;
uniform sampler2D atlas;
uniform float time;
out vec4 o;
${NOISE}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.875; }
void main(){
  float a;
  if (vKind == 0 || vKind == 4) {
    float px = abs(vUV.x) * vTex;
    a = clamp(vAux + 0.5 - px, 0.0, 1.0);
    // rain: faint at the tail, a little brighter at the head
    if (vKind == 0) a *= smoothstep(-1.0, 0.6, vUV.y) * (1.0 - smoothstep(0.85, 1.0, vUV.y) * 0.5);
  } else if (vKind == 1) {
    float r2 = dot(vUV, vUV);
    a = exp(-r2 * 3.2) * clamp(1.0 - r2, 0.0, 1.0);
  } else if (vKind == 2) {
    float c = vTex;
    vec2 cell = vec2(mod(c, ${CELLS}.0), floor(c / ${CELLS}.0));
    vec2 l = clamp(vUV * 0.5 + 0.5, 0.01, 0.99);
    vec2 uv = vec2((cell.x + l.x) / ${CELLS}.0, 1.0 - (cell.y + 1.0 - l.y) / ${CELLS}.0);
    vec4 t = texture(atlas, uv);
    o = vec4(t.rgb * vShade * vCol.rgb, t.a) * vCol.a;
    return;
  } else {
    float r = length(vUV);
    float n = fbm(vUV * 1.7 + vec2(vSeed * 31.0 + time * 0.018, vSeed * 17.0 - time * 0.012));
    a = (1.0 - smoothstep(0.25, 1.0, r)) * smoothstep(0.32, 0.78, n);
  }
  a *= vCol.a;
  o = vec4(vCol.rgb * a, a);
}`;

const SKY_VS = `#version 300 es
layout(location=0) in vec2 pos;
void main(){ gl_Position = vec4(pos, 0.0, 1.0); }`;

const SKY_FS = `#version 300 es
precision highp float;
uniform vec2 res;
uniform float time;
uniform float cover;
uniform vec2 off;
uniform vec2 sunDir;
uniform vec3 litC;
uniform vec3 shadeC;
uniform float alpha;
uniform vec3 flash;
out vec4 o;
${NOISE}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; } return s; }
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  float asp = res.x / res.y;
  // wider than tall, like clouds seen from the side
  vec2 p = vec2(uv.x * asp, uv.y * 2.1) * 1.5 + off;
  vec2 q = vec2(fbm(p + vec2(0.0, time * 0.011)), fbm(p + vec2(5.2, 1.3) - vec2(time * 0.009, 0.0)));
  vec2 w = p + 1.3 * q;
  float d = fbm(w);
  float lo = mix(0.74, 0.3, cover);
  float dens = smoothstep(lo, lo + 0.2, d);
  // thinning toward the lower sky, unless it's overcast
  dens *= mix(mix(0.25, 0.85, cover), 1.0, smoothstep(0.05, 0.8, uv.y));
  // light from the sun's side, and thick cloud darker in the middle
  float d2 = fbm(w + sunDir * 0.14);
  float lit = clamp(0.55 + (d - d2) * 4.0, 0.0, 1.0);
  float thick = smoothstep(lo, lo + 0.5, d);
  vec3 col = mix(litC, shadeC, clamp(thick * 0.55 + (1.0 - lit) * 0.5, 0.0, 1.0));
  vec2 fd = (uv - flash.xy) * vec2(asp, 1.0);
  col += flash.z * exp(-dot(fd, fd) * 5.0) * vec3(0.85, 0.9, 1.0) * (0.35 + thick);
  float a = dens * alpha;
  o = vec4(col * a, a);
}`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  return p;
}

function context(cv: HTMLCanvasElement) {
  const gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) throw new Error("no webgl2");
  return gl;
}

function fit(cv: HTMLCanvasElement, w: number, h: number, scale: number) {
  const W = Math.max(1, Math.round(w * scale)),
    H = Math.max(1, Math.round(h * scale));
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  return [W, H];
}

// One canvas of instanced quads.
class Particles {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private buf: WebGLBuffer;
  private vao: WebGLVertexArrayObject;
  private u: Record<string, WebGLUniformLocation | null> = {};
  data = new Float32Array(MAX * F);
  n = 0;

  constructor(private cv: HTMLCanvasElement) {
    const gl = (this.gl = context(cv));
    this.prog = compile(gl, PART_VS, PART_FS);
    for (const k of ["res", "ctr", "zoom", "sunL", "day", "direct", "atlas", "time"]) this.u[k] = gl.getUniformLocation(this.prog, k);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const sizes = [3, 3, 3, 4, 4];
    let off = 0;
    sizes.forEach((sz, i) => {
      gl.enableVertexAttribArray(i + 1);
      gl.vertexAttribPointer(i + 1, sz, gl.FLOAT, false, F * 4, off * 4);
      gl.vertexAttribDivisor(i + 1, 1);
      off += sz;
    });
    gl.bindVertexArray(null);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  push(p: V3, u: V3, v: V3, r: number, g: number, b: number, a: number, kind: number, tex: number, width: number, seed: number) {
    if (this.n >= MAX) return;
    const d = this.data,
      o = this.n++ * F;
    d[o] = p[0];
    d[o + 1] = p[1];
    d[o + 2] = p[2];
    d[o + 3] = u[0];
    d[o + 4] = u[1];
    d[o + 5] = u[2];
    d[o + 6] = v[0];
    d[o + 7] = v[1];
    d[o + 8] = v[2];
    d[o + 9] = r;
    d[o + 10] = g;
    d[o + 11] = b;
    d[o + 12] = a;
    d[o + 13] = kind;
    d[o + 14] = tex;
    d[o + 15] = width;
    d[o + 16] = seed;
  }

  draw(f: SceneFrame, t: number, direct: number) {
    const gl = this.gl;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const [W, H] = fit(this.cv, f.w, f.h, dpr);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.n) return;
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.res, f.w, f.h);
    gl.uniform2f(this.u.ctr, f.cx, f.cy);
    gl.uniform1f(this.u.zoom, f.zoom);
    gl.uniform3f(this.u.sunL, f.L[0], f.L[1], f.L[2]);
    gl.uniform1f(this.u.day, f.day);
    gl.uniform1f(this.u.direct, direct);
    gl.uniform1f(this.u.time, t);
    gl.uniform1i(this.u.atlas, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * F);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    gl.bindVertexArray(null);
  }
}

class Sky {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private u: Record<string, WebGLUniformLocation | null> = {};

  constructor(private cv: HTMLCanvasElement) {
    const gl = (this.gl = context(cv));
    this.prog = compile(gl, SKY_VS, SKY_FS);
    for (const k of ["res", "time", "cover", "off", "sunDir", "litC", "shadeC", "alpha", "flash"]) this.u[k] = gl.getUniformLocation(this.prog, k);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  draw(w: number, h: number, t: number, c: { cover: number; off: [number, number]; sun: [number, number]; lit: V3; shade: V3; alpha: number; flash: V3 }) {
    const gl = this.gl;
    const [W, H] = fit(this.cv, w, h, 0.4);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (c.cover <= 0.01 || c.alpha <= 0.01) return;
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.res, W, H);
    gl.uniform1f(this.u.time, t);
    gl.uniform1f(this.u.cover, c.cover);
    gl.uniform2f(this.u.off, c.off[0], c.off[1]);
    gl.uniform2f(this.u.sunDir, c.sun[0], c.sun[1]);
    gl.uniform3f(this.u.litC, ...c.lit);
    gl.uniform3f(this.u.shadeC, ...c.shade);
    gl.uniform1f(this.u.alpha, c.alpha);
    gl.uniform3f(this.u.flash, ...c.flash);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
}

// --------------------------------------------------------------------------
// The things in the world
// --------------------------------------------------------------------------

type Drop = { x: number; y: number; z: number; vy: number; len: number };
type Flake = { x: number; y: number; z: number; vx: number; vy: number; vz: number; fall: number; r: number; ph: number };
type Settled = { w: V3; r: number; age: number; life: number }; // snow resting on the globe, in its own frame
type Bead = { w: V3; v: V3; age: number }; // a raindrop running down the globe
type Spark = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number };
type Mote = {
  p: V3;
  v: V3;
  U: V3; // the gust carrying it
  e1: V3;
  e2: V3;
  w: V3;
  w0: V3; // its own tumble, back once it's free of the globe
  s: number;
  tex: number;
  kind: "leaf" | "petal" | "seed";
  dir: number;
  ph: number;
  age: number;
  touch: number; // how lately it touched the globe
  rest: V3 | null; // caught on the globe (its own frame), riding the spin
  restLeft: number;
  caught: boolean;
  gone: number; // fading where it came to rest on the ground
};
type Fly = { p: V3; v: V3; ph: number; period: number };
type Mist = { x: number; y: number; z: number; w: number; h: number; a: number; seed: number; age: number };
type Ground = { p: V3; u: V3; v: V3; tex: number; s: number; sway: number; ph: number; age: number };

const LEAVES = [TEX.maple, TEX.maple, TEX.oak, TEX.aspen, TEX.aspen, TEX.elm];
const tint = (dk: number, day: V3, night: V3): V3 => [day[0] + (night[0] - day[0]) * dk, day[1] + (night[1] - day[1]) * dk, day[2] + (night[2] - day[2]) * dk];

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function normalize(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
// turn v about the unit axis k by angle a
function turn(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a),
    s = Math.sin(a);
  const kv = cross(k, v);
  const d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  return [v[0] * c + kv[0] * s + k[0] * d * (1 - c), v[1] * c + kv[1] * s + k[1] * d * (1 - c), v[2] * c + kv[2] * s + k[2] * d * (1 - c)];
}
// Bring a flat thing's frame round so it lies against the surface with normal n.
function lay(m: { e1: V3; e2: V3 }, n: V3, k: number) {
  const c = normalize(cross(m.e1, m.e2));
  const t: V3 = dot(c, n) < 0 ? [-n[0], -n[1], -n[2]] : n;
  const ax = cross(c, t);
  const sn = Math.hypot(ax[0], ax[1], ax[2]);
  if (sn < 1e-4) return;
  const a = Math.asin(Math.min(1, sn)) * k;
  const u: V3 = [ax[0] / sn, ax[1] / sn, ax[2] / sn];
  m.e1 = turn(m.e1, u, a);
  m.e2 = turn(m.e2, u, a);
}

// The air at p when the wind is U: it parts round a sphere of radius a
// (potential flow, so it slides along the surface and never into it), and
// the spinning globe (omega, rad/s) drags the air close to it along.
function airAt(p: V3, U: V3, a: number, omega: V3): V3 {
  const r = Math.hypot(p[0], p[1], p[2]);
  if (r > 3.2 * a || r < 1) return [U[0], U[1], U[2]];
  const n: V3 = [p[0] / r, p[1] / r, p[2] / r];
  const k = (a * a * a) / (2 * r * r * r);
  const un = 3 * dot(U, n);
  const d = Math.pow(a / Math.max(r, a), 4) * 0.8;
  const sp = cross(omega, p);
  return [U[0] + k * (U[0] - un * n[0]) + d * sp[0], U[1] + k * (U[1] - un * n[1]) + d * sp[1], U[2] + k * (U[2] - un * n[2]) + d * sp[2]];
}

function randomFrame(): [V3, V3] {
  const a = normalize([rand(-1, 1), rand(-1, 1), rand(-1, 1)]);
  const b = normalize(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  return [b, cross(a, b)];
}

export class Scene {
  private back: Particles;
  private front: Particles;
  private sky: Sky;
  private drops: Drop[] = [];
  private flakes: Flake[] = [];
  private settled: Settled[] = [];
  private beads: Bead[] = [];
  private prevCam: Camera | null = null;
  private omega: V3 = [0, 0, 0];
  private sparks: Spark[] = [];
  private motes: Mote[] = [];
  private flies: Fly[] = [];
  private mists: Mist[] = [];
  private ground: Ground[] = [];
  private mistKey = "";
  private groundKey = "";
  private queue: { at: number; kind: Mote["kind"]; dir: number }[] = [];
  private bolt: V3[] = [];
  private t = 0;
  private flash = 0;
  private boltT = 0;
  private nextBolt = rand(3, 8);
  private nextGust: number;
  private calm: number;
  private cloud = { cover: 0, lit: [1, 1, 1] as V3, shade: [0.8, 0.84, 0.89] as V3, alpha: 0 };
  look: Look = { overcast: 0, wet: 0, frost: 0 };
  private winter = 0; // how frozen over winter and snowfall have left the songs

  constructor(
    skyCv: HTMLCanvasElement,
    backCv: HTMLCanvasElement,
    frontCv: HTMLCanvasElement,
    private flashEl: HTMLElement | null,
    private fast: boolean,
  ) {
    this.sky = new Sky(skyCv);
    this.back = new Particles(backCv);
    this.front = new Particles(frontCv);
    this.calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;
    this.nextGust = fast ? 2 : rand(8, 30);
  }

  step(dt: number, wx: Weather | null, f: SceneFrame) {
    this.t += dt;
    const kind = wx?.kind ?? "clear";
    const snow = kind === "snow";
    const storm = kind === "storm";
    const drizzle = kind === "drizzle";
    const intensity = wx?.intensity ?? 0;
    const wet = intensity > 0 && !snow;
    const wind = wx?.wind ?? 0;
    const temp = f.temp;
    const ez = (k: number) => 1 - Math.exp(-k * dt);

    // how fast the globe is turning, as a spin vector in camera space
    const cam = f.cam;
    if (this.prevCam && dt > 0) {
      const A = camV([0, 1, 0], cam);
      const q0 = camV([1, 0, 0], this.prevCam),
        q1 = camV([1, 0, 0], cam);
      const aq = cross(A, q1);
      const l2 = dot(aq, aq);
      const w = l2 > 0.01 ? Math.max(-1.5, Math.min(1.5, ((q1[0] - q0[0]) * aq[0] + (q1[1] - q0[1]) * aq[1] + (q1[2] - q0[2]) * aq[2]) / (l2 * dt))) : 0;
      this.omega = [A[0] * w, A[1] * w, A[2] * w];
    }
    this.prevCam = { ...cam };

    // ---------------------------------------------------- the look on the songs
    const L = this.look;
    const overcast = storm ? 1 : clamp01(((wx?.cloud ?? 0) - 0.3) / 0.6) * (kind === "partly" ? 0.4 : 1);
    L.overcast += (overcast - L.overcast) * ez(0.3);
    L.wet = clamp01(L.wet + (wet ? dt * (this.fast ? 0.3 : 0.03 + 0.08 * intensity) : -dt / 500));
    // frost: a light rime all winter, thicker while it snows, and whenever it's freezing
    const base = f.season === "winter" ? 0.45 : 0;
    if (snow) this.winter = Math.min(1, this.winter + dt * (this.fast ? 0.15 : 0.006 + 0.01 * intensity));
    else if (this.winter > base && (temp === null || temp > 2)) this.winter = Math.max(base, this.winter - dt / 900);
    if (this.winter < base) this.winter = Math.min(base, this.winter + dt * 0.2);
    const freezing = temp !== null && temp <= 2 && !wet ? 0.35 + 0.65 * clamp01((2 - temp) / 6) : 0;
    const frost = Math.max(freezing, this.winter);
    L.frost += (frost - L.frost) * ez(this.fast ? 1 : 0.08);

    // ------------------------------------------------------------- the clouds
    const dk = f.dk;
    const cover = kind === "clear" ? 0 : kind === "partly" ? Math.max(0.35, wx!.cloud * 0.8) : storm ? 1 : kind === "cloudy" ? 0.9 : 0.85;
    const goal = storm
      ? { lit: tint(dk, [0.68, 0.71, 0.75], [0.16, 0.18, 0.23]), shade: tint(dk, [0.4, 0.43, 0.48], [0.05, 0.06, 0.09]), alpha: 0.95 }
      : wet || snow || kind === "fog"
        ? { lit: tint(dk, [0.94, 0.95, 0.96], [0.22, 0.25, 0.31]), shade: tint(dk, [0.74, 0.77, 0.81], [0.08, 0.09, 0.13]), alpha: dk > 0.5 ? 0.85 : 0.88 }
        : kind === "cloudy"
          ? { lit: tint(dk, [0.98, 0.98, 0.99], [0.24, 0.27, 0.34]), shade: tint(dk, [0.78, 0.81, 0.85], [0.09, 0.1, 0.14]), alpha: dk > 0.5 ? 0.85 : 0.9 }
          : { lit: tint(dk, [1, 1, 1], [0.26, 0.29, 0.36]), shade: tint(dk, [0.8, 0.84, 0.89], [0.1, 0.11, 0.16]), alpha: dk > 0.5 ? 0.75 : 0.92 };
    const c = this.cloud;
    const k = ez(0.4);
    c.cover += (cover - c.cover) * k;
    c.alpha += (goal.alpha - c.alpha) * k;
    for (let i = 0; i < 3; i++) {
      c.lit[i] += (goal.lit[i] - c.lit[i]) * k;
      c.shade[i] += (goal.shade[i] - c.shade[i]) * k;
    }
    const sun = normalize([f.L[0], -f.L[1], 0]);
    const b0 = this.bolt[0];
    const flashAt: V3 = b0 ? [(f.cx + (b0[0] * f.zoom * P) / (P - b0[2] * f.zoom)) / f.w, 0.75, 1.4 * this.flash] : [0.5, 0.7, 0];
    this.sky.draw(f.w, f.h, this.t, {
      cover: c.cover,
      off: [f.yaw * 0.03 + this.t * (0.004 + wind * 0.0015), 0],
      sun: [sun[0], sun[1]],
      lit: c.lit,
      shade: c.shade,
      alpha: c.alpha,
      flash: flashAt,
    });

    const back = this.back,
      front = this.front;
    back.n = front.n = 0;
    const show = f.show;
    if (show <= 0) {
      back.draw(f, this.t, 1);
      front.draw(f, this.t, 1);
      this.flashOut(dt);
      return;
    }

    const zoom = f.zoom;
    const persp = (z: number) => (P - z * zoom) / (P * zoom);
    const kAt = (z: number) => (zoom * P) / (P - z * zoom);
    const halfW = (z: number) => (f.w / 2 + 80) * persp(z);
    const topY = (z: number) => -(f.cy + 80) * persp(z);
    const botY = (z: number) => (f.h - f.cy + 40) * persp(z);
    const area = clamp01((f.w * f.h) / (1440 * 900)) * 0.55 + 0.45;
    const R = f.R,
      R2 = R * R;
    const depth = (z: number) => 0.35 + 0.65 * clamp01((z - FAR) / (NEAR - FAR));
    const to = (z: number) => (z > 0 ? front : back);
    const direct = 1 - 0.7 * L.overcast;

    // ---------------------------------------------------------------- mist
    const morning = f.hour >= 5 && f.hour < 10.5;
    const cold = temp !== null ? temp < 9 : f.season === "autumn" || f.season === "winter";
    const mistKey = kind === "fog" ? "fog" : morning && cold ? "low" : wet ? "haze" : "";
    if (mistKey !== this.mistKey) {
      this.mistKey = mistKey;
      for (const m of this.mists) m.age = Math.min(m.age, -1); // the old ones fade out
      const n = mistKey === "fog" ? 11 : mistKey === "low" ? 7 : mistKey === "haze" ? 5 : 0;
      for (let i = 0; i < n; i++) {
        const z = mistKey === "haze" ? rand(-1650, -900) : rand(-1300, mistKey === "low" ? 260 : 200);
        const w = mistKey === "low" ? rand(380, 760) : rand(500, 1000);
        this.mists.push({
          x: rand(-1, 1) * halfW(z),
          y: mistKey === "low" ? f.floorY - rand(-20, 50) : mistKey === "haze" ? rand(topY(z) * 0.6, f.floorY) : f.floorY - rand(-30, 2.4 * R),
          z,
          w,
          h: w * (mistKey === "low" ? 0.2 : 0.32),
          a: mistKey === "fog" ? 0.34 : mistKey === "low" ? 0.3 : 0.14,
          seed: Math.random(),
          age: 0,
        });
      }
    }
    for (let i = this.mists.length - 1; i >= 0; i--) {
      const m = this.mists[i];
      // fading in counts up from 0; fading out counts down from -1
      m.age = m.age >= 0 ? m.age + dt : m.age - dt;
      const fade = m.age >= 0 ? clamp01(m.age / 6) : clamp01(1 + (m.age + 1) / 6);
      if (m.age < 0 && fade <= 0) {
        this.mists.splice(i, 1);
        continue;
      }
      m.x += (5 + wind * 3) * dt;
      if (m.x - m.w / 2 > halfW(m.z)) m.x = -halfW(m.z) - m.w / 2;
      const col = tint(dk, [1, 1, 1], [0.55, 0.6, 0.72]);
      to(m.z).push([m.x, m.y, m.z], [m.w / 2, m.h / 2, 0], [0, 0, 0], col[0], col[1], col[2], m.a * fade * (dk > 0.5 ? 0.55 : 1) * show, 3, 0, 0, m.seed);
    }

    // ------------------------------------------------------------- the ground
    const groundKey = f.season;
    if (groundKey !== this.groundKey) {
      this.groundKey = groundKey;
      for (const g of this.ground) g.age = Math.min(g.age, -1);
      const plan: [number, number][] =
        f.season === "spring"
          ? [[TEX.sprout, 6], [TEX.daisy, 4], [TEX.crocus, 4]]
          : f.season === "summer"
            ? [[TEX.daisy, 4]]
            : [];
      for (const [tex, n] of plan) for (let i = 0; i < n; i++) this.ground.push(this.groundItem(tex, f));
    }
    for (let i = 0; i < this.ground.length; i++) {
      const g = this.ground[i];
      g.age = g.age >= 0 ? g.age + dt : g.age - dt;
      const fade = g.age >= 0 ? clamp01(g.age / 4) : clamp01(1 + (g.age + 1) / 4);
      if (g.age < 0 && fade <= 0) {
        this.ground.splice(i--, 1);
        continue;
      }
      let v = g.v;
      if (g.sway) {
        // flowers lean with the wind and stir a little
        const lean = (0.08 + wind * 0.02) * g.sway + 0.06 * Math.sin(this.t * 1.3 + g.ph);
        v = [g.s * lean, -g.s, 0];
      }
      const p: V3 = g.sway ? [g.p[0], g.p[1] - g.s, g.p[2]] : g.p;
      to(g.p[2]).push(p, g.u, v, 1, 1, 1, fade * show, 2, g.tex, 0, 0);
    }

    // ---------------------------------------------------------------- rain
    const lean = storm
      ? Math.max(-0.7, Math.min(0.7, 0.18 + wind / 18 + 0.22 * Math.sin(this.t * 0.55) + 0.08 * Math.sin(this.t * 1.7)))
      : drizzle
        ? 0.04 + wind / 60
        : Math.min(0.25, wind / 40);
    const wantDrops = wet ? Math.round((storm ? 420 : drizzle ? 220 : 140 + 220 * intensity) * area * this.calm) : 0;
    while (this.drops.length < wantDrops) this.drops.push(this.dropSpot(kind, halfW, topY, true, R));
    if (this.drops.length > wantDrops) this.drops.length = Math.max(wantDrops, this.drops.length - Math.ceil(dt * 400));
    // by day rain shows as faint grey against the bright sky, by night it catches the light
    const rc = tint(dk, storm ? [0.84, 0.87, 0.92] : [0.42, 0.48, 0.55], [0.78, 0.84, 0.95]);
    const ra = (storm ? 0.3 : drizzle ? 0.2 : 0.26) * (storm || dk > 0.5 ? 1 : 1.25) * show;
    const rw = storm ? 1.05 : drizzle ? 0.65 : 0.85;
    for (const d of this.drops) {
      const py = d.y;
      d.y += d.vy * dt;
      d.x += d.vy * lean * dt;
      let done = false;
      if (d.x * d.x + d.z * d.z < R2) {
        const hit = -Math.sqrt(R2 - d.x * d.x - d.z * d.z);
        if (py < hit && d.y >= hit) {
          if (d.z > -R * 0.2 && Math.random() < 0.4) this.splash(d.x, hit, d.z, R);
          if (Math.random() < (drizzle ? 0.02 : 0.05) && this.beads.length < 18 * this.calm) this.beads.push({ w: camInv([d.x, hit, d.z], cam), v: [0, 0, 0], age: 0 });
          done = true;
        }
      }
      if (!done && d.y > f.floorY && Math.abs(d.x) < 1.5 * R && Math.abs(d.z) < 1.1 * R) {
        if (Math.random() < 0.12) this.splash(d.x, f.floorY, d.z, 0);
        done = true;
      }
      if (!done && d.y - d.len > botY(d.z)) done = true;
      if (done) Object.assign(d, this.dropSpot(kind, halfW, topY, false, R));
      const near = Math.max(0, d.z) / 170;
      const k2 = kAt(d.z);
      const behind = d.z < 0 && d.x * d.x + d.y * d.y < R2 ? 0.5 : 1;
      const hl = d.len / 2;
      to(d.z).push(
        [d.x - lean * hl, d.y - hl, d.z],
        [lean * hl, hl, 0],
        [0, 0, 0],
        rc[0],
        rc[1],
        rc[2],
        (ra * depth(d.z) * behind) / (1 + near * 1.6),
        0,
        0,
        rw * Math.max(0.5, Math.min(1.5, k2)) * (1 + near),
        0,
      );
    }

    // ---------------------------------------------------------------- snow
    // Flakes ride the air, so most part round the globe. The ones that meet
    // it near the top rest there a moment and melt.
    const wantFlakes = snow ? Math.round((110 + 150 * intensity) * area * this.calm) : 0;
    while (this.flakes.length < wantFlakes) this.flakes.push(this.flakeSpot(halfW, topY, true, R));
    if (this.flakes.length > wantFlakes) this.flakes.length = Math.max(wantFlakes, this.flakes.length - Math.ceil(dt * 200));
    const sc = tint(dk, [1, 1, 1], [0.86, 0.9, 0.98]);
    const om = this.omega;
    const keepSettled = Math.round(40 * this.calm);
    const kf = ez(2);
    for (const s of this.flakes) {
      // the breeze parts round the globe; the flake sinks through it all the same
      const U: V3 = [Math.sin(this.t * 0.9 + s.ph) * 18 + wind * 5, 0, Math.cos(this.t * 0.7 + s.ph * 1.3) * 8];
      const air = airAt([s.x, s.y, s.z], U, R * 1.05, om);
      s.vx += (air[0] - s.vx) * kf;
      s.vy += (air[1] + s.fall - s.vy) * kf;
      s.vz += (air[2] - s.vz) * kf;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      let done = false;
      const d = Math.hypot(s.x, s.y, s.z);
      if (d < R + s.r) {
        const n: V3 = [s.x / d, s.y / d, s.z / d];
        if (n[1] < -0.25 && this.settled.length < keepSettled) {
          // on the upper half (y is down): it rests, turning with the globe, and melts
          this.settled.push({ w: camInv([n[0] * (R + 0.5), n[1] * (R + 0.5), n[2] * (R + 0.5)], cam), r: s.r * rand(0.8, 1.1), age: 0, life: rand(2.5, 6) });
          done = true;
        } else {
          // lower down it can't hold on, and slips past
          s.x = n[0] * (R + s.r);
          s.y = n[1] * (R + s.r);
          s.z = n[2] * (R + s.r);
          const vn = s.vx * n[0] + s.vy * n[1] + s.vz * n[2];
          if (vn < 0) {
            s.vx -= vn * n[0];
            s.vy -= vn * n[1];
            s.vz -= vn * n[2];
          }
        }
      }
      if (!done && (s.y > f.floorY + 10 || s.y > botY(s.z))) done = true;
      if (done) Object.assign(s, this.flakeSpot(halfW, topY, false, R));
      const near = Math.max(0, s.z) / 150;
      const r = s.r * (1 + near * 1.2);
      const behind = s.z < 0 && s.x * s.x + s.y * s.y < R2 ? 0.45 : 1;
      const a = ((0.8 * depth(s.z) * behind) / (1 + near * 1.4)) * show;
      // a faint grey edge, so flakes still show against a bright sky
      if (dk < 0.5) to(s.z).push([s.x, s.y, s.z], [r * 1.5, r * 1.5, 0], [0, 0, 0], 0.4, 0.45, 0.52, a * 0.5 * (1 - dk * 2), 1, 0, 0, 0);
      to(s.z).push([s.x, s.y, s.z], [r, r, 0], [0, 0, 0], sc[0], sc[1], sc[2], a, 1, 0, 0, 0);
    }

    // snow resting on the globe: it turns with it a moment, and melts
    const warm = temp !== null && temp > 2;
    for (let i = this.settled.length - 1; i >= 0; i--) {
      const st = this.settled[i];
      st.age += dt * (warm ? 3 : snow ? 1 : 1.6);
      if (st.age > st.life) {
        this.settled.splice(i, 1);
        continue;
      }
      const q = camV(st.w, cam);
      const fade = clamp01(st.age / 0.3) * clamp01((st.life - st.age) / 2);
      // seen through the glass on the far side, only faintly
      const a = 0.85 * fade * (q[2] < 0 ? 0.3 : 1) * show;
      if (dk < 0.5) to(q[2]).push(q, [st.r * 1.4, st.r * 1.4, 0], [0, 0, 0], 0.5, 0.55, 0.62, a * 0.35 * (1 - dk * 2), 1, 0, 0, 0);
      to(q[2]).push(q, [st.r, st.r, 0], [0, 0, 0], sc[0], sc[1], sc[2], a, 1, 0, 0, 0);
    }

    // rain running down the globe: a drop clings a moment, then runs, and drips off underneath
    for (let i = this.beads.length - 1; i >= 0; i--) {
      const b = this.beads[i];
      b.age += dt;
      const q = camV(b.w, cam);
      const r = Math.hypot(q[0], q[1], q[2]);
      const n: V3 = [q[0] / r, q[1] / r, q[2] / r];
      const run = 70 * clamp01((b.age - 0.6) / 1.5);
      for (let j = 0; j < 3; j++) {
        const g = (j === 1 ? run : 0) - run * n[1] * n[j];
        b.v[j] += (g - b.v[j]) * ez(2);
        q[j] += b.v[j] * dt;
      }
      const r2 = Math.hypot(q[0], q[1], q[2]);
      for (let j = 0; j < 3; j++) q[j] *= R / r2;
      if (n[1] > 0.8 || b.age > 16) {
        if (q[2] > 0) this.splash(q[0], q[1], q[2], 0);
        this.beads.splice(i, 1);
        continue;
      }
      b.w = camInv(q, cam);
      const a = clamp01(b.age / 0.3) * (q[2] < 0 ? 0.35 : 1) * show;
      to(q[2]).push(q, [1.7, 2.1, 0], [0, 0, 0], rc[0], rc[1], rc[2], 0.45 * a, 1, 0, 0, 0);
      to(q[2]).push([q[0] - 0.4, q[1] - 0.5, q[2]], [0.7, 0.7, 0], [0, 0, 0], 1, 1, 1, 0.55 * a * (0.4 + 0.6 * f.day), 1, 0, 0, 0);
    }

    // ------------------------------------------------- splashes off the songs
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      if (s.age > s.life) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.vy += 900 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const a = (1 - s.age / s.life) * 0.5 * show;
      to(s.z).push([s.x, s.y, s.z], [1.1, 1.1, 0], [0, 0, 0], rc[0], rc[1], rc[2], a, 1, 0, 0, 0);
    }

    // ------------------------------------------------ leaves, petals, seeds
    const gustKind: Mote["kind"] | null =
      f.season === "autumn" ? "leaf" : f.season === "spring" ? "petal" : f.season === "summer" && f.day > 0.5 ? "seed" : null;
    this.nextGust -= dt;
    if (this.nextGust <= 0) {
      this.nextGust = this.fast ? rand(9, 15) : gustKind === "seed" ? rand(60, 130) : rand(45, 110);
      if (gustKind && !storm) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const n = gustKind === "leaf" ? 2 + Math.floor(Math.random() * 3) : gustKind === "petal" ? 3 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) this.queue.push({ at: this.t + i * rand(0.25, 1.1), kind: gustKind, dir });
      }
    }
    for (let i = this.queue.length - 1; i >= 0; i--)
      if (this.queue[i].at <= this.t) {
        this.motes.push(this.newMote(this.queue[i].kind, this.queue[i].dir, halfW, topY, f));
        this.queue.splice(i, 1);
      }
    const drawn: Mote[] = [];
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.age += dt;
      m.touch = Math.max(0, m.touch - dt);
      const p = m.p,
        v = m.v;
      if (m.gone > 0) {
        m.gone += dt;
        if (m.gone > 1.2) {
          this.motes.splice(i, 1);
          continue;
        }
        drawn.push(m);
        continue;
      }
      if (m.rest) {
        // caught on the globe: it rides the spin a moment, then the wind takes it again
        const q = camV(m.rest, cam);
        const n = normalize(q);
        m.restLeft -= dt;
        if (m.restLeft <= 0 || n[1] > -0.12) {
          m.rest = null;
          const sv = cross(om, q);
          for (let j = 0; j < 3; j++) v[j] = sv[j] + m.U[j] * 0.35 + n[j] * 25;
        }
        p[0] = q[0];
        p[1] = q[1];
        p[2] = q[2];
      } else {
        const air = airAt(p, m.U, R * 1.08, om);
        if (m.kind === "seed") air[1] += Math.sin(this.t * 0.8 + m.ph) * 14;
        else {
          // flutter: the air pushes it about, and it slowly sinks
          air[1] += (m.kind === "leaf" ? 26 : 12) + Math.sin(this.t * 2.2 + m.ph) * 55;
          air[2] += Math.cos(this.t * 1.4 + m.ph) * 30;
        }
        const k = ez(m.kind === "leaf" ? 1.5 : m.kind === "petal" ? 2.4 : 3.2);
        for (let j = 0; j < 3; j++) v[j] += (air[j] - v[j]) * k;
        p[0] += v[0] * dt;
        p[1] += v[1] * dt;
        p[2] += v[2] * dt;
        p[2] = Math.max(FAR * 0.6, Math.min(NEAR - 20, p[2]));
        // it meets the globe: a little bounce, then it rubs along the turning surface
        const d = Math.hypot(p[0], p[1], p[2]),
          keep = R + (m.kind === "seed" ? 14 : m.s * 0.45);
        if (d < keep) {
          const n: V3 = [p[0] / d, p[1] / d, p[2] / d];
          for (let j = 0; j < 3; j++) p[j] = n[j] * keep;
          const sv = cross(om, p);
          const rel: V3 = [v[0] - sv[0], v[1] - sv[1], v[2] - sv[2]];
          const vn = dot(rel, n);
          const bounce = m.kind === "leaf" ? 0.25 : m.kind === "petal" ? 0.12 : 0.05;
          const rub = 1 - Math.min(1, dt * (m.kind === "leaf" ? 2.2 : 1.2));
          for (let j = 0; j < 3; j++) {
            const nj = vn * n[j];
            v[j] = sv[j] + (rel[j] - nj) * rub + (vn < 0 ? -bounce * nj : nj);
          }
          m.touch = 0.5;
          // landing on the upper side, slowly enough, a leaf or petal can catch there for a moment
          if (!m.caught && m.kind !== "seed" && n[1] < -0.3 && Math.hypot(rel[0], rel[1], rel[2]) < 150 && Math.random() < 0.6) {
            m.caught = true;
            m.rest = camInv(p, cam);
            m.restLeft = rand(1.5, 5);
          }
        }
      }
      // against the globe it lies flat and stops tumbling; free of it, the tumble comes back
      if (m.touch > 0 || m.rest) {
        lay(m, normalize(p), ez(m.rest ? 6 : 4));
        for (let j = 0; j < 3; j++) m.w[j] *= 1 - Math.min(1, dt * 4);
      } else for (let j = 0; j < 3; j++) m.w[j] += (m.w0[j] - m.w[j]) * ez(0.8);
      const spin = Math.hypot(m.w[0], m.w[1], m.w[2]);
      if (spin > 0.01) {
        const ax: V3 = [m.w[0] / spin, m.w[1] / spin, m.w[2] / spin];
        m.e1 = turn(m.e1, ax, spin * dt);
        m.e2 = turn(m.e2, ax, spin * dt);
      }
      // down on the ground it lies still a moment and fades: no heaps
      if (p[1] >= f.floorY - 2) {
        p[1] = f.floorY - 2;
        lay(m, [0, -1, 0], 1);
        m.gone = 1e-3;
      }
      if ((m.dir > 0 ? p[0] > halfW(p[2]) + 60 : p[0] < -halfW(p[2]) - 60) || m.age > 90) {
        this.motes.splice(i, 1);
        continue;
      }
      drawn.push(m);
    }
    drawn.sort((a, b) => a.p[2] - b.p[2]);
    for (const m of drawn) {
      const fade = clamp01(m.age / 0.6) * (1 - clamp01(m.gone / 1.2));
      const nightDim = 1 - 0.35 * dk;
      to(m.p[2]).push(
        m.p,
        [m.e1[0] * m.s, m.e1[1] * m.s, m.e1[2] * m.s],
        [m.e2[0] * m.s, m.e2[1] * m.s, m.e2[2] * m.s],
        nightDim,
        nightDim,
        nightDim,
        fade * show * (m.kind === "seed" ? 0.85 : 1),
        2,
        m.tex,
        0,
        0,
      );
    }

    // ------------------------------------------------------------- fireflies
    const wantFlies = f.season === "summer" && dk > 0.6 && (temp === null || temp > 12) && !wet ? 12 : 0;
    while (this.flies.length < wantFlies) {
      let p: V3;
      do p = [rand(-1.8, 1.8) * R, rand(-0.3 * R, f.floorY - 8), rand(-1.4, 1) * R];
      while (Math.hypot(p[0], p[1], p[2]) < R + 30);
      this.flies.push({ p, v: [0, 0, 0], ph: rand(0, 20), period: rand(3.5, 7) });
    }
    if (this.flies.length > wantFlies) this.flies.length = wantFlies;
    for (const fl of this.flies) {
      for (let i = 0; i < 3; i++) fl.v[i] = (fl.v[i] + rand(-40, 40) * dt) * (1 - dt * 0.5);
      fl.v[1] += (fl.p[1] > f.floorY - 10 ? -20 : 0) * dt;
      for (let i = 0; i < 3; i++) fl.p[i] += fl.v[i] * dt;
      const d = Math.hypot(fl.p[0], fl.p[1], fl.p[2]);
      if (d < R + 24) for (let i = 0; i < 3; i++) fl.p[i] *= (R + 24) / d;
      const glow = Math.pow(Math.max(0, Math.sin(((this.t + fl.ph) / fl.period) * Math.PI * 2)), 6);
      if (glow < 0.01) continue;
      to(fl.p[2]).push(fl.p, [9, 9, 0], [0, 0, 0], 0.85, 0.95, 0.45, 0.6 * glow * show, 1, 0, 0, 0);
      to(fl.p[2]).push(fl.p, [1.8, 1.8, 0], [0, 0, 0], 1, 1, 0.8, 0.95 * glow * show, 1, 0, 0, 0);
    }

    // ------------------------------------------------------------- lightning
    if (storm) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = rand(6, 16);
        this.flash = 1;
        this.boltT = 0.42;
        this.strike(halfW, topY, f.floorY);
      }
    }
    if (this.boltT > 0) {
      this.boltT = Math.max(0, this.boltT - dt);
      const k = this.boltT;
      // a strike flickers: on, off, on again, gone
      const a = (k > 0.34 ? 1 : k > 0.27 ? 0.15 : k > 0.12 ? 0.85 : k / 0.12) * show;
      for (let i = 1; i < this.bolt.length; i++) {
        const p0 = this.bolt[i - 1],
          p1 = this.bolt[i];
        const mid: V3 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2];
        const u: V3 = [(p1[0] - p0[0]) / 2, (p1[1] - p0[1]) / 2, 0];
        back.push(mid, u, [0, 0, 0], 0.7, 0.78, 1, 0.16 * a, 4, 0, 9, 0);
        back.push(mid, u, [0, 0, 0], 0.97, 0.98, 1, a, 4, 0, 1.3, 0);
      }
    } else this.bolt.length = 0;

    back.draw(f, this.t, direct);
    front.draw(f, this.t, direct);
    this.flashOut(dt);
  }

  private flashOut(dt: number) {
    this.flash = Math.max(0, this.flash - dt * 1.8);
    if (this.flashEl) this.flashEl.style.opacity = (0.12 * this.flash * this.flash).toFixed(3);
  }

  // --------------------------------------------------------------------------

  // Rain and snow are sparse, so a share of it comes down right over the
  // globe, where you can see it meet it.
  private dropSpot(kind: string, halfW: (z: number) => number, topY: (z: number) => number, scatter: boolean, R: number): Drop {
    const over = Math.random() < 0.2;
    const z = over ? rand(-0.9, 0.9) * R : rand(FAR, NEAR);
    const vy = kind === "storm" ? rand(1500, 1900) : kind === "drizzle" ? rand(480, 620) : rand(1050, 1300);
    return {
      z,
      x: over ? rand(-1.1, 1.1) * R : rand(-1.25, 1) * halfW(z),
      y: topY(z) - (scatter ? rand(-1.8, 0.1) * Math.abs(topY(z)) : rand(0, 150)),
      vy,
      // motion blur: how far it falls while the eye takes it in
      len: vy * (kind === "drizzle" ? 0.014 : 0.02),
    };
  }

  private flakeSpot(halfW: (z: number) => number, topY: (z: number) => number, scatter: boolean, R: number): Flake {
    const over = Math.random() < 0.3;
    const z = over ? rand(-1, 1) * R : rand(FAR, NEAR);
    const fall = rand(38, 80);
    return { z, x: over ? rand(-1.2, 1.2) * R : rand(-1.1, 1.1) * halfW(z), y: topY(z) - (scatter ? rand(-1.8, 0.1) * Math.abs(topY(z)) : rand(0, 120)), vx: 0, vy: fall, vz: 0, fall, r: rand(1.6, 3.4), ph: rand(0, 6.3) };
  }

  private splash(x: number, y: number, z: number, R: number) {
    if (this.sparks.length > 220) return;
    const n: V3 = R ? [x / R, y / R, z / R] : [0, -1, 0];
    for (let i = 0; i < 2; i++) {
      const s = rand(50, 110);
      this.sparks.push({ x, y, z, vx: n[0] * s + rand(-40, 40), vy: n[1] * s - rand(60, 120), vz: n[2] * s + rand(-30, 30), age: 0, life: rand(0.18, 0.32) });
    }
  }

  private newMote(kind: Mote["kind"], dir: number, halfW: (z: number) => number, topY: (z: number) => number, f: SceneFrame): Mote {
    // about half blow straight at the globe; the rest pass out past it, in
    // the background, now and then nearer
    const R = f.R;
    const aim = Math.random() < (kind === "seed" ? 0.35 : 0.55);
    const z = aim ? rand(-0.55, 0.45) * R : Math.random() < 0.75 ? rand(-700, -60) : rand(-60, 220);
    const y = aim ? rand(-1, 0.15) * R : rand(topY(z) * 0.75, f.floorY - 70);
    const [e1, e2] = kind === "seed" ? ([[1, 0, 0], [0, -1, 0]] as [V3, V3]) : randomFrame();
    const speed = kind === "leaf" ? rand(120, 220) : kind === "petal" ? rand(70, 140) : rand(28, 60);
    const spin = kind === "leaf" ? rand(1.6, 4.2) : kind === "petal" ? rand(1.2, 3) : 0;
    const axis = normalize([rand(-1, 1), rand(-1, 1), rand(-1, 1)]);
    const U: V3 = [dir * speed, 0, rand(-15, 15)];
    const w: V3 = [axis[0] * spin, axis[1] * spin, axis[2] * spin];
    return {
      p: [-dir * (halfW(z) + 40), y, z],
      v: [U[0], U[1], U[2]],
      U,
      e1,
      e2,
      w,
      w0: [w[0], w[1], w[2]],
      touch: 0,
      rest: null,
      restLeft: 0,
      caught: false,
      gone: 0,
      s: kind === "leaf" ? rand(10, 14) : kind === "petal" ? rand(4.5, 6.5) : rand(9, 12),
      tex: kind === "leaf" ? LEAVES[Math.floor(Math.random() * LEAVES.length)] : kind === "petal" ? (Math.random() < 0.7 ? TEX.petal : TEX.petalWhite) : TEX.seed,
      kind,
      dir,
      ph: rand(0, 20),
      age: 0,
    };
  }

  // A flower or tuft on the ground under the globe: a small patch round the
  // spot the globe stands on, thinning outward.
  private groundItem(tex: number, f: SceneFrame): Ground {
    const R = f.R;
    const a = rand(0, Math.PI * 2),
      r = Math.sqrt(Math.random()) * 1.15;
    const x = Math.cos(a) * r * R,
      z = Math.sin(a) * r * R * 0.42;
    const s = rand(7, 10);
    const b = rand(-0.6, 0.6);
    return { p: [x, f.floorY, z], u: [Math.cos(b) * s, 0, Math.sin(b) * s], v: [0, -s, 0], tex, s, sway: rand(0.6, 1.2), ph: rand(0, 20), age: 0 };
  }

  private strike(halfW: (z: number) => number, topY: (z: number) => number, floorY: number) {
    const z = rand(-1500, -1000);
    const top = topY(z) * 0.95;
    const x0 = rand(-0.6, 0.6) * halfW(z);
    const pts: V3[] = [];
    let x = x0;
    const n = 16;
    for (let i = 0; i <= n; i++) {
      pts.push([x, top + ((floorY - top) * i) / n, z]);
      x += rand(-34, 34);
    }
    this.bolt = pts;
  }
}
