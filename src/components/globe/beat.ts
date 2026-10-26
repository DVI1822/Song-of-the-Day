// A song's beat, heard from its 30-second preview. Spotify doesn't share
// tempo or audio with apps any more, so the Globe listens for itself: the
// preview is fetched through our own server (so the browser may read it),
// decoded, and the sharp rises in its loudness show where the hits land.

export type Beat = {
  hop: number; // seconds per step
  pulse: Float32Array; // how hard the music is hitting at each step, 0..1
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
  // the hits: how sharply the loudness rises every ~12ms, listening mostly
  // to the low end (kick and bass), where a song's beat lives
  const win = Math.round(sr * 0.046),
    step = Math.round(sr * 0.0116);
  const n = Math.floor((data.length - win) / step);
  if (n < 200) return null;
  const hop = step / sr;
  const low = new Float32Array(data.length);
  const k = 1 - Math.exp((-2 * Math.PI * 160) / sr);
  for (let i = 0, y = 0; i < data.length; i++) low[i] = y += k * (data[i] - y);
  const onset = new Float32Array(n);
  let pl = 0,
    pa = 0;
  for (let i = 0; i < n; i++) {
    let el = 0,
      ea = 0;
    for (let j = i * step, end = j + win; j < end; j++) {
      el += low[j] * low[j];
      ea += data[j] * data[j];
    }
    const l = Math.log1p(1000 * Math.sqrt(el / win)),
      a = Math.log1p(1000 * Math.sqrt(ea / win));
    onset[i] = i ? 0.7 * Math.max(0, l - pl) + 0.3 * Math.max(0, a - pa) : 0;
    pl = l;
    pa = a;
  }

  // only the real hits count: anything below the song's usual murmur is
  // dropped, and the biggest hits reach full strength
  const sorted = Float32Array.from(onset).sort();
  const floor = sorted[Math.floor(n * 0.6)],
    top = sorted[Math.floor(n * 0.97)];
  if (top <= floor) return null;
  const hits = onset.map((o) => Math.min(1, Math.max(0, (o - floor) / (top - floor))));

  // the tempo: the beat length (70 to 180 a minute) at which the hits line up
  // best with themselves. When it's clear, hits on the beat count fully and
  // stray ones (a vocal, a fill) only a little.
  const lo = Math.round(60 / 180 / hop),
    hi = Math.round(60 / 70 / hop);
  let best = 0,
    lag = 0,
    sum = 0;
  for (let L = lo; L <= hi; L++) {
    let c = 0;
    for (let i = L; i < n; i++) c += hits[i] * hits[i - L];
    sum += c;
    if (c > best) {
      best = c;
      lag = L;
    }
  }
  if (lag > 0 && best > 1.6 * (sum / (hi - lo + 1))) {
    // a hit counts fully when another sits about a beat before or after it
    const heard = Float32Array.from(hits);
    for (let i = 0; i < n; i++) {
      let near = 0;
      for (let j = -2; j <= 2; j++) near = Math.max(near, heard[i - lag + j] ?? 0, heard[i + lag + j] ?? 0);
      hits[i] = heard[i] * (0.3 + 0.7 * Math.min(1, near * 1.5));
    }
  }

  // a hit flares at once and fades over a fifth of a second
  const pulse = new Float32Array(n);
  const fade = Math.exp(-hop / 0.2);
  for (let i = 0, p = 0; i < n; i++) pulse[i] = p = Math.max(hits[i], p * fade);
  return { hop, pulse };
}

// How hard the song is hitting at time t (0..1), on the preview's own clock.
export function pulseAt(b: Beat, t: number) {
  const i = Math.round(t / b.hop);
  return i >= 0 && i < b.pulse.length ? b.pulse[i] : 0;
}
