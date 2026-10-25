// A song's beat, heard from its 30-second preview. Spotify doesn't share
// tempo or audio with apps any more, so the Globe listens for itself: the
// preview is fetched through our own server (so the browser may read it),
// decoded, and its loudness swings give the tempo and where the beats fall.

export type Beat = {
  period: number; // seconds per beat
  phase: number; // seconds into the preview of the first beat
  hop: number; // seconds per envelope step
  env: Float32Array; // loudness through the preview, 0..1
};

const cache = new Map<string, Promise<Beat | null>>();

export function beatOf(previewUrl: string | null | undefined): Promise<Beat | null> {
  if (!previewUrl) return Promise.resolve(null);
  let b = cache.get(previewUrl);
  if (!b) {
    b = listen(previewUrl).catch(() => null);
    cache.set(previewUrl, b);
  }
  return b;
}

async function listen(url: string): Promise<Beat | null> {
  const res = await fetch(`/api/preview-audio?u=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const bytes = await res.arrayBuffer();
  const Ctx =
    window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctx) return null;
  const rate = 22050;
  const audio = await new Ctx(1, rate, rate).decodeAudioData(bytes);
  return analyze(audio.getChannelData(0), audio.sampleRate);
}

export function analyze(data: Float32Array, sr: number): Beat | null {
  // loudness every ~12ms, and how sharply it rises (where the hits are)
  const win = Math.round(sr * 0.046),
    step = Math.round(sr * 0.0116);
  const n = Math.floor((data.length - win) / step);
  if (n < 200) return null;
  const hop = step / sr;
  const env = new Float32Array(n),
    onset = new Float32Array(n);
  let prev = 0,
    peak = 1e-9;
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (let j = i * step, end = j + win; j < end; j++) e += data[j] * data[j];
    const l = Math.log1p(1000 * Math.sqrt(e / win));
    env[i] = l;
    onset[i] = Math.max(0, l - prev);
    prev = l;
    if (l > peak) peak = l;
  }
  for (let i = 0; i < n; i++) env[i] /= peak;

  // the tempo: the beat length (70 to 180 a minute) at which the hits line up
  // best with themselves, nudged towards a natural ~120, then refined between
  // steps so it holds over the whole song
  const lo = Math.round(60 / 180 / hop),
    hi = Math.round(60 / 70 / hop);
  const score = new Float32Array(hi + 2);
  for (let L = lo - 1; L <= hi + 1; L++) {
    let c = 0;
    for (let i = L; i < n; i++) c += onset[i] * onset[i - L];
    score[L] = c;
  }
  let best = 0,
    lag = 0;
  for (let L = lo; L <= hi; L++) {
    const bpm = 60 / (L * hop);
    const c = score[L] * Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    if (c > best) {
      best = c;
      lag = L;
    }
  }
  if (!lag) return null;
  // a beat that lines up just as well at half the length is the real one
  const h0 = Math.floor(lag / 2),
    h1 = Math.ceil(lag / 2),
    halfL = score[h0] >= score[h1] ? h0 : h1;
  if (halfL >= lo && score[halfL] >= 0.7 * score[lag]) lag = halfL;
  const [a, b, c] = [score[lag - 1], score[lag], score[lag + 1]];
  const P = lag + (a - c !== 0 && 2 * b - a - c > 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0);

  // where the beats fall: the offset whose every beat lands on a hit
  let bestO = 0,
    off = 0;
  for (let o = 0; o < P; o += 0.25) {
    let sum = 0;
    for (let x = o; x < n - 1; x += P) {
      const i = Math.floor(x),
        f = x - i;
      sum += onset[i] * (1 - f) + onset[i + 1] * f;
    }
    if (sum > bestO) {
      bestO = sum;
      off = o;
    }
  }
  return { period: P * hop, phase: off * hop, hop, env };
}

// How hard the beat is hitting at time t (0..1). With the preview itself
// playing, t is the preview's own clock and the pulse follows its loudness
// too; for a whole song the pulse keeps the tempo.
export function pulseAt(b: Beat, t: number, exact: boolean) {
  const u = (((t - b.phase) / b.period) % 1 + 1) % 1;
  const kick = Math.exp(-u * 5);
  if (!exact) return kick;
  const i = Math.min(b.env.length - 1, Math.max(0, Math.round(t / b.hop)));
  return 0.55 * kick + 0.45 * b.env[i] * b.env[i];
}
