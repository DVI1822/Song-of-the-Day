"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { todayIn } from "@/lib/day";
import type { Activity, AddedMe, Friend, Post, Profile } from "@/lib/types";
import { serverApi, type GlobeApi } from "./api";
import { Ambient } from "./Ambient";
import { WeatherSky, seasonOverride, tempOverride, override as weatherOverride, useWeather } from "./Weather";
import { Shuffle } from "./Shuffle";
import { Scene, seasonAt, type Look, type Season } from "./scene";
import { frostTexture } from "./textures";
import { Compose } from "./Compose";
import { Chat } from "./Chat";
import { HelpButton, Welcome, enablePush, useWelcomeSeen } from "./Welcome";
import { CoreView } from "./CoreView";
import { Feature } from "./Feature";
import { type CoreLook, alpha, drift, useCoreLook, useCoverColors } from "./coreLook";
import { Magma, MagmaFilters } from "./Magma";
import { FindPanel, FriendsPanel, SongsPanel } from "./Panels";
import { usePreview } from "./Preview";
import { beatOf, pulseAt, type Beat } from "./beat";
import { BackIcon, coverRadius, glass } from "./ui";
import {
  PERSPECTIVE,
  TILT,
  TileSim,
  aim,
  camInv,
  camV,
  coverBackground,
  guessGeo,
  latLon,
  starField,
  sunLight,
  type Camera,
  type Sun,
} from "./math";

type Props = {
  me: Profile;
  myPost: Post | null;
  friends: Friend[];
  mySongs: Post[];
  redoUsed: boolean;
  addedMe?: AddedMe[];
  activity?: Activity[]; // feels and notes on your song today
  spotifyLinked?: boolean;
  api?: GlobeApi;
};

export function GlobeApp(props: Props) {
  const spotify = (props.api ?? serverApi).spotify;
  const linked = Boolean(props.spotifyLinked);
  const connect = useMemo(() => (spotify ? { ...spotify, linked } : null), [spotify, linked]);
  // the player lives in the root layout and stays with you after you leave
  const { setConnect } = usePreview();
  useEffect(() => setConnect(connect), [connect, setConnect]);
  return <Globe {...props} />;
}

const ME = 99; // your own tile's slot; friends take 0..89
type PanelName = "friends" | "find" | "songs";
// frame: the colours around a real album cover, so the whole square shows
// inside the tile's rounded corners
type TileInfo = { k: number; wait: boolean; art: string; frame: string | null; label: string };
type TileEls = {
  box: HTMLDivElement | null;
  facets: (HTMLDivElement | null)[];
  shades: (HTMLDivElement | null)[];
  coats: (HTMLDivElement | null)[]; // frost on the cover
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// When you last looked at who added you, so the My friends tab can show a
// badge for anyone new. Kept on this device only.
const SEEN_KEY = "sotd-added-seen";
const seenListeners = new Set<() => void>();
const seenStore = {
  subscribe(f: () => void) {
    seenListeners.add(f);
    return () => void seenListeners.delete(f);
  },
  get() {
    try {
      return localStorage.getItem(SEEN_KEY) ?? "";
    } catch {
      return "";
    }
  },
  server: () => "~", // sorts after every date: no badge until we're in the browser
  set(at: string) {
    try {
      localStorage.setItem(SEEN_KEY, at);
    } catch {}
    seenListeners.forEach((f) => f());
  },
};

// Per-frame easing written for 60fps, made frame-rate independent.
const ease = (k: number, dt: number) => 1 - Math.pow(1 - k, dt * 60);

function layoutFor(w: number, h: number) {
  const R = Math.round(Math.min(w * 0.41, h * 0.24, 300));
  const s = R / 160;
  const cx = w / 2,
    cy = Math.round(h * 0.462);
  const cover = Math.round(Math.min(350, w - 40, h * 0.42));
  return { w, h, R, s, cx, cy, cover };
}

type Live = {
  keys: number[];
  half: number;
  Rb: number;
  L: ReturnType<typeof layoutFor>;
  zFeat: number;
  friends: Friend[];
  beam: Beam;
  look: CoreLook | null;
};
// what's playing, for the energy streak: its tile, and how to find its beat
type Beam = { k: number; paused: boolean; beat: Beat | null; clipTime: () => number | null } | null;
type Motion = ReturnType<typeof newMotion>;
type Els = ReturnType<typeof newEls>;

function newMotion(posted: boolean) {
  return {
    yaw: 0.5,
    pitch: -0.3,
    zoom: 1,
    vel: 0.0008,
    t: 0,
    mt: 0,
    last: 0,
    wxShow: 0,
    look: { overcast: 0, wet: 0, frost: 0 } as Look,
    cam: { yaw: 0, pitch: 0, roll: 0 } as Camera,
    target: null as null | { yaw: number; pitch: number },
    zoomTarget: null as null | number,
    featFly: null as null | number,
    featOn: false,
    featOpen: false,
    fp: 0,
    lens: null as null | number,
    rollHold: 0,
    pendingCore: false,
    coreOn: false,
    profP: 0,
    dk: 0,
    darkOn: false,
    launch: null as null | number,
    myLanded: posted,
    myLock: null as null | number,
    born: new Map<number, number>(),
    drag: null as null | { x: number; y: number; lx: number; yaw: number; pitch: number },
    pointers: new Map<number, { x: number; y: number }>(),
    // two fingers down: no spinning, and no zooming either
    pinch: false,
    moved: false,
    // recenter: posted songs gather at the front until this time
    gather: 0,
    sun: null as null | Sun,
    sunAt: 0,
    geo: { lat: 40, lon: -90 },
    beamA: 0,
    beamLvl: 0,
    beamSwells: [] as { u: number; a: number }[],
    beamK: -1,
  };
}

function newEls() {
  return {
    stage: null as HTMLDivElement | null,
    world: null as HTMLDivElement | null,
    core: null as HTMLButtonElement | null,
    space: null as HTMLDivElement | null,
    stars: null as HTMLDivElement | null,
    starsB: null as HTMLDivElement | null,
    day: null as HTMLDivElement | null,
    sunShadow: null as HTMLDivElement | null,
    wxSky: null as HTMLCanvasElement | null,
    wxBack: null as HTMLCanvasElement | null,
    wxFront: null as HTMLCanvasElement | null,
    wxFlash: null as HTMLDivElement | null,
    floor: null as HTMLDivElement | null,
    sphere: null as HTMLDivElement | null,
    beam: null as HTMLCanvasElement | null,
    chrome: [] as (HTMLElement | null)[],
    feat: null as HTMLDivElement | null,
    featBack: null as HTMLDivElement | null,
    featCard: null as HTMLDivElement | null,
    prof: null as HTMLDivElement | null,
    profSheet: null as HTMLDivElement | null,
    launch: null as HTMLDivElement | null,
  };
}

function Globe({
  me,
  myPost: initialPost,
  friends: initialFriends,
  mySongs: initialSongs,
  redoUsed: initialRedo,
  addedMe: initialAddedMe = [],
  activity: initialActivity = [],
  api = serverApi,
}: Props) {
  // Songs keep playing as you move around; only pausing or starting another stops them.
  const pv = usePreview();
  const shuffleNow = pv.shuffle?.now ?? null;
  const [friends, setFriends] = useState(initialFriends);
  const [addedMe, setAddedMe] = useState(initialAddedMe);
  const [activity, setActivity] = useState(initialActivity);
  const seen = useSyncExternalStore(seenStore.subscribe, seenStore.get, seenStore.server);
  // what's new since you last opened My friends: people who added you or
  // added you back, new songs, and feels and notes on your song
  const seenAt = seen === "~" ? Infinity : Date.parse(seen) || 0;
  const [seenBefore, setSeenBefore] = useState(seenAt);
  const afterFeat = useRef<(() => void) | null>(null); // runs once the song view has closed
  const fresh = (at: string | null | undefined) => Boolean(at) && Date.parse(at!) > seenAt;
  const newCount =
    addedMe.filter((p) => fresh(p.added_at)).length +
    activity.filter((a) => fresh(a.at)).length +
    friends.filter((f) => fresh(f.followed_back_at) || (!f.hidden && fresh(f.post?.created_at))).length;
  const [myPost, setMyPost] = useState(initialPost);
  const [mySongs, setMySongs] = useState(initialSongs);
  const [redoUsed, setRedoUsed] = useState(initialRedo);
  const [landed, setLanded] = useState(Boolean(initialPost)); // your tile shows your song
  const [launching, setLaunching] = useState(false);
  const [panel, setPanel] = useState<PanelName | null>(null);
  const [panelOn, setPanelOn] = useState(false);
  const [chatOn, setChatOn] = useState(false);
  const welcomeSeen = useWelcomeSeen();
  const [help, setHelp] = useState(false);
  // a browser that already allowed nudges keeps its subscription fresh
  useEffect(() => void enablePush(api, false), [api]);
  const [dmWith, setDmWith] = useState<{ p: Profile; n: number } | null>(null);
  const [feat, setFeat] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [compose, setCompose] = useState(false);
  // whose core we're in (null: yours), and their tile if they're on the globe
  const [coreFor, setCoreFor] = useState<{ who: Profile | null; k: number | null } | null>(null);
  const [coreOpen, setCoreOpen] = useState(false);
  const [friendCore, setFriendCore] = useState<{ id: string; profile: Profile; posts: Post[] } | null>(null);
  const [darkOn, setDarkOn] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const L = layoutFor(size?.w ?? 390, size?.h ?? 844);
  const keys = useMemo(() => [...friends.flatMap((f, i) => (f.hidden ? [] : [i])), ME], [friends]);
  // Tiles share the globe: a few songs get big tiles (up to 140px on a phone)
  // so it never feels empty, shrinking as more arrive, down to 64px, and only
  // past ~30 songs smaller still.
  const roomy = Math.min(140 * L.s, (64 * L.s * 16) / keys.length);
  const packed = Math.max(38 * L.s, Math.min(64 * L.s, L.R * Math.sqrt((4 * Math.PI) / Math.max(keys.length, 12)) * 0.6));
  const half = Math.round(Math.max(roomy, packed)) / 2;
  const Rb = L.R + 6;
  const zFeat = (() => {
    const zf = L.cover / (2 * half);
    return (zf * PERSPECTIVE) / (PERSPECTIVE + zf * Rb);
  })();

  // Motion lives in a ref and is written straight to the DOM every frame, so
  // React only re-renders when the UI itself changes.
  const m = useRef(newMotion(Boolean(initialPost)));
  const sim = useRef(new TileSim());
  const els = useRef(new Map<number, TileEls>());
  const R = useRef(newEls());
  const weather = useWeather((lat, lon) => {
    m.current.geo = { lat, lon };
    m.current.sunAt = 0;
  });
  const wx = useRef({ weather, dark: false, scene: null as Scene | null, failed: false, season: "autumn" as Season, seasonAt: -Infinity });
  useLayoutEffect(() => {
    wx.current.weather = weather;
    wx.current.dark = darkOn;
  });

  // The song that's playing gets a stream of magma from the core. It pulses
  // on the song's hits only while the site can hear it (its preview; see
  // beat.ts); a whole song on Spotify can't be heard, so it just flows.
  const playingPost = pv.shuffle?.now ?? pv.track?.post ?? null;
  const playingPaused = pv.shuffle ? pv.shuffle.paused : Boolean(pv.track?.paused);
  const [beat, setBeat] = useState<{ url: string; b: Beat | null } | null>(null);
  const beatUrl = playingPost?.preview_url ?? null;
  useEffect(() => {
    if (!beatUrl) return;
    let live = true;
    beatOf(beatUrl).then((b) => live && setBeat({ url: beatUrl, b }));
    return () => {
      live = false;
    };
  }, [beatUrl]);
  const beamK = !playingPost ? -1 : playingPost.id === myPost?.id ? ME : friends.findIndex((f) => !f.hidden && f.post?.id === playingPost.id);
  const beam: Beam =
    beamK === -1
      ? null
      : { k: beamK, paused: playingPaused, beat: beat?.url === beatUrl ? beat.b : null, clipTime: pv.clipTime };

  // your core grows from your songs; the stream to what's playing matches it
  const look = useCoreLook(mySongs, me.timezone);

  // Everything the frame loop needs from the latest render.
  const live = useRef<Live>({ keys, half, Rb, L, zFeat, friends, beam, look });
  useLayoutEffect(() => {
    live.current = { keys, half, Rb, L, zFeat, friends, beam, look };
  });

  // -------------------------------------------------------------------------
  // Setup: size, location, clock
  // -------------------------------------------------------------------------

  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    // a guess from the timezone until the weather says where you are
    m.current.geo = guessGeo();
    return () => window.removeEventListener("resize", measure);
  }, []);

  // -------------------------------------------------------------------------
  // Camera moves
  // -------------------------------------------------------------------------

  const closePanel = useCallback(() => setPanelOn(false), []);

  const spinTo = useCallback(
    (k: number) => {
      const s = m.current;
      if (s.moved) return;
      s.vel = 0;
      s.target = aim(sim.current.pos(k), s.yaw);
      setFocus(k);
      closePanel();
    },
    [closePanel],
  );

  // Turn the song to face you, then fly in until it's as big as the card.
  const fly = useCallback(
    (k: number) => {
      const s = m.current;
      s.vel = 0;
      s.target = aim(sim.current.pos(k), s.yaw, true);
      s.zoomTarget = live.current.zFeat;
      s.featFly = k;
      s.lens = k;
      s.coreOn = false;
      s.pendingCore = false;
      setCoreOpen(false);
      setCoreFor(null);
      setFocus(null);
      setFlipped(false);
      closePanel();
    },
    [closePanel],
  );

  // Fly through the near side of the globe into someone's core.
  // Anyone's core: yours (null), a friend's tile, or anyone else's.
  const openCore = useCallback(
    (k: number | null, person?: Profile) => {
      let who = person ?? (k === null || k === ME ? null : friends[k] ?? null);
      if (who?.id === me.id) who = null;
      if (person) {
        const i = friends.findIndex((f) => f.id === person.id && !f.hidden);
        k = i >= 0 ? i : null;
      }
      const s = m.current;
      s.vel = 0;
      s.zoomTarget = 6.8;
      s.pendingCore = true;
      s.lens = null;
      s.featFly = null;
      s.featOpen = false;
      s.target = null;
      setCoreFor({ who, k: k === ME ? null : k });
      setFocus(null);
      closePanel();
    },
    [closePanel, friends, me.id],
  );

  const closeCore = useCallback(() => {
    const s = m.current;
    s.coreOn = false;
    s.pendingCore = false;
    s.zoomTarget = 1;
    setCoreOpen(false);
    setCoreFor(null);
  }, []);

  const closeFeat = useCallback(() => {
    m.current.featOpen = false;
    m.current.zoomTarget = 1;
    setFlipped(false);
  }, []);

  const openCompose = useCallback(() => {
    if (m.current.launch !== null) return;
    setCompose(true);
    closePanel();
  }, [closePanel]);

  const pick = useCallback(
    (k: number, wait: boolean) => {
      if (m.current.moved) return;
      if (k === ME && wait) openCompose();
      else if (wait) spinTo(k);
      else {
        // it dips into the water first, then the camera flies in
        sim.current.dip(k);
        setTimeout(() => fly(k), 220);
      }
    },
    [fly, openCompose, spinTo],
  );

  // Load the archive of whoever's core we're flying into.
  const coreWho = coreFor?.who ?? null;
  useEffect(() => {
    if (!coreWho) return;
    let on = true;
    api.loadCore(coreWho.id).then((c) => on && c && setFriendCore({ id: coreWho.id, profile: c.profile, posts: c.posts }));
    return () => {
      on = false;
    };
  }, [coreWho, api]);
  const coreData = !coreFor
    ? null
    : coreWho
      ? friendCore?.id === coreWho.id
        ? friendCore
        : { profile: coreWho, posts: null }
      : { profile: me, posts: mySongs };
  const coreAdded = !coreWho || friends.some((f) => f.id === coreWho.id);
  // flying into someone else's core, the core in the middle becomes theirs
  const theirSongs = coreWho && friendCore?.id === coreWho.id ? friendCore.posts : null;
  const theirLook = useCoreLook(theirSongs, coreWho?.timezone ?? "UTC");

  // Add someone from inside their core; their tile joins the globe behind.
  const addFromCore = async () => {
    if (!coreWho) return null;
    if (friends.length >= 90) return "Your globe is full.";
    const r = await api.follow(coreWho.id);
    if (!r.friend) return r.error ?? "Couldn't add them. Try again.";
    m.current.born.set(friends.length, m.current.t);
    setFriends((list) => [...list, r.friend!]);
    setAddedMe((list) => list.filter((x) => x.id !== coreWho.id));
    setCoreFor((c) => c && { ...c, k: friends.length });
    return null;
  };

  // Panels slide away before they unmount.
  useEffect(() => {
    if (panelOn) return;
    const t = setTimeout(() => setPanel(null), 260);
    return () => clearTimeout(t);
  }, [panelOn]);

  // Phones: a pinch zooms nothing, neither the Globe nor the page (iOS
  // ignores the viewport's no-zoom, so its gestures are stopped here).
  useEffect(() => {
    // Touch events, not pointer events: iOS Safari is only reliable with these.
    const stop = (e: Event) => e.preventDefault();
    const start = (e: TouchEvent) => {
      const s = m.current;
      if (e.touches.length !== 2) return;
      s.pinch = true;
      s.drag = null;
      s.moved = true;
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) m.current.pinch = false;
    };
    const opts = { passive: false } as const;
    for (const g of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(g, stop, opts);
    document.addEventListener("touchstart", start, opts);
    document.addEventListener("touchmove", move, opts);
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);
    return () => {
      for (const g of ["gesturestart", "gesturechange", "gestureend"]) document.removeEventListener(g, stop);
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (compose) setCompose(false);
      else if (m.current.featOpen) closeFeat();
      else if (m.current.coreOn) closeCore();
      else {
        closePanel();
        setChatOn(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compose, closeFeat, closeCore, closePanel]);

  // -------------------------------------------------------------------------
  // The frame loop
  // -------------------------------------------------------------------------

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const s = m.current;
      const { keys, half, Rb } = live.current;
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0;
      s.last = now;
      s.t += dt;
      s.mt += dt;

      // the sun moves slowly; work it out once a second
      if (!s.sun || now - s.sunAt > 1000) {
        s.sun = sunLight(new Date(), s.geo);
        s.sunAt = now;
      }
      // the sky follows the real time of day: space at night, light blue by
      // day.
      const dGoal = 1 - s.sun.day;
      s.dk = s.t === 0 || Math.abs(dGoal - s.dk) < 0.01 ? dGoal : s.dk + (dGoal - s.dk) * Math.min(1, dt * 5);
      if (s.dk > 0.5 !== s.darkOn) {
        s.darkOn = s.dk > 0.5;
        setDarkOn(s.darkOn);
      }
      s.profP = s.coreOn ? Math.min(1, s.profP + dt * 1.6) : 0;

      if (s.featOn) {
        const goal = s.featOpen ? 1 : 0;
        const nf = s.fp + (goal - s.fp) * ease(0.12, dt);
        s.fp = Math.abs(goal - nf) < 0.01 ? goal : nf;
        if (!s.featOpen && s.fp === 0) {
          s.featOn = false;
          setFeat(null);
          afterFeat.current?.();
          afterFeat.current = null;
        }
      }
      if (s.launch !== null) {
        s.launch += dt / 1.25;
        if (s.launch >= 1) {
          s.launch = null;
          s.myLanded = true;
          s.myLock = s.t;
          setLanded(true);
          setLaunching(false);
        }
      }

      const t = s.target;
      if (!s.drag && t) {
        const dy = t.yaw - s.yaw,
          dp = t.pitch - s.pitch;
        if (Math.abs(dy) + Math.abs(dp) > 0.001) {
          const f = ease(0.1, dt);
          s.yaw += dy * f;
          s.pitch += dp * f;
        } else if (s.featFly === null && s.launch === null) s.target = null; // arrived: let the spin carry on
      } else if (!s.drag && !s.pinch) {
        s.vel += ((0.14 * dt) / Math.sqrt(Math.max(1, s.zoom)) - s.vel) * ease(0.05, dt);
        s.yaw += s.vel;
      }
      if (s.zoomTarget !== null) {
        const dz = s.zoomTarget - s.zoom;
        // the core's sheet starts rising while the camera settles, not after
        if (s.pendingCore && Math.abs(dz) < 0.9) {
          s.pendingCore = false;
          s.coreOn = true;
          setCoreOpen(true);
        }
        if (Math.abs(dz) > 0.01) s.zoom += dz * ease(0.07, dt);
        else {
          s.zoom = s.zoomTarget;
          s.zoomTarget = null;
          if (s.featFly !== null) {
            s.featOn = true;
            s.featOpen = true;
            setFeat(s.featFly);
            s.featFly = null;
          }
        }
      }
      if (s.lens !== null && !s.featOn && s.featFly === null && s.zoomTarget === null && s.zoom < 1.03) s.lens = null;
      if (s.gather > s.t && s.featFly === null) {
        // the spot on the globe facing you, in the globe's own frame
        const f = camInv([0, 0, 1], { yaw: s.yaw, pitch: s.pitch, roll: 0 });
        const fr = live.current.friends;
        const posted = keys.filter((k) => (k === ME ? s.myLanded : !!fr[k]?.post));
        sim.current.pull(posted, [f[0], -f[1], f[2]], dt);
      } else if (s.featFly === null && s.lens === null && !s.coreOn) {
        // the stream holds the playing song at the front while the rest spin,
        // a little below the core so you can see it reach out
        const b = live.current.beam;
        if (b && !b.paused) {
          const f = camInv([0, 0.42, 0.91], { yaw: s.yaw, pitch: s.pitch, roll: 0 });
          sim.current.pull([b.k], [f[0], -f[1], f[2]], dt);
        }
      }
      sim.current.step(keys, half, Rb, s.featFly !== null ? 0 : dt);
      sim.current.water(keys, Math.min(dt, 0.1));
      draw(s, R.current, els.current, sim.current, live.current);
      drawBeam(s, R.current.beam, sim.current, live.current, dt);
      const w = wx.current,
        el = R.current;
      if (!w.scene && !w.failed && el.wxSky && el.wxBack && el.wxFront)
        try {
          w.scene = new Scene(el.wxSky, el.wxBack, el.wxFront, el.wxFlash, weatherOverride() !== null || seasonOverride() !== null);
        } catch {
          w.failed = true; // no WebGL here: the globe just goes without
        }
      if (w.scene) {
        const { L: Lw } = live.current;
        const hide = s.lens !== null || s.coreOn || s.featOn;
        s.wxShow += ((hide ? 0 : clamp01(1 - (s.zoom - 1) * 2.5)) - s.wxShow) * ease(0.1, dt);
        if (now - w.seasonAt > 60_000) {
          w.season = seasonOverride() ?? seasonAt(new Date(), s.geo.lat);
          w.seasonAt = now;
        }
        const d = new Date();
        const show = s.wxShow < 0.02 ? 0 : s.wxShow;
        w.scene.step(dt, w.weather, {
          zoom: s.zoom,
          show,
          w: Lw.w,
          h: Lw.h,
          cx: Lw.cx,
          cy: Lw.cy,
          R: Rb + 2,
          floorY: 216 * Lw.s,
          dk: s.dk,
          day: s.sun.day,
          L: s.sun.L,
          yaw: s.yaw,
          cam: s.cam,
          season: w.season,
          hour: d.getHours() + d.getMinutes() / 60,
          temp: tempOverride() ?? w.weather?.temp ?? null,
        });
        if (el.wxBack) el.wxBack.style.opacity = show.toFixed(3);
        if (el.wxFront) el.wxFront.style.opacity = show.toFixed(3);
        s.look = w.scene.look;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const w = wx.current;
    return () => {
      cancelAnimationFrame(raf);
      w.scene = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Dragging the globe
  // -------------------------------------------------------------------------

  const onDown = (e: React.PointerEvent) => {
    const s = m.current;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pinch || s.pointers.size > 1) {
      s.drag = null;
      return;
    }
    s.drag = { x: e.clientX, y: e.clientY, lx: e.clientX, yaw: s.yaw, pitch: s.pitch };
    s.moved = false;
    s.gather = 0;
    if (s.featFly !== null) {
      s.featFly = null;
      s.zoomTarget = 1;
    }
    if (s.target) {
      s.vel = 0;
      s.target = null;
      setFocus(null);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const s = m.current;
    if (!s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pinch) return;
    const d = s.drag;
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) s.moved = true;
    s.vel = Math.max(-0.08, Math.min(0.08, (e.clientX - d.lx) * 0.01));
    d.lx = e.clientX;
    s.yaw = d.yaw + dx * 0.01;
    s.pitch = Math.max(-1.3, Math.min(1.3, d.pitch - dy * 0.01));
  };
  const onUp = (e: React.PointerEvent) => {
    const s = m.current;
    s.pointers.delete(e.pointerId);
    if (!s.pointers.size) s.drag = null;
  };


  // -------------------------------------------------------------------------
  // Posting, redo, following
  // -------------------------------------------------------------------------

  const onPosted = (post: Post) => {
    const s = m.current;
    setCompose(false);
    setMyPost(post);
    setMySongs((list) => [post, ...list.filter((p) => p.id !== post.id)]);
    s.vel = 0;
    s.launch = 0;
    s.target = aim(sim.current.pos(ME), s.yaw);
    setFocus(null);
    setLaunching(true);
  };

  const onRedo = async (post: Post) => {
    const r = await api.deleteTodayPost(post.id);
    if (r?.error) return r.error;
    m.current.myLanded = false;
    m.current.myLock = null;
    setLanded(false);
    setMyPost(null);
    setMySongs((list) => list.filter((p) => p.id !== post.id));
    setRedoUsed(true);
    closePanel();
    setCompose(true);
  };

  const onFollowed = (f: Friend) => {
    const s = m.current;
    const k = friends.length;
    if (k >= 90) return;
    s.born.set(k, s.t);
    setFriends((list) => [...list, f]);
    s.vel = 0;
    s.target = aim(sim.current.pos(k), s.yaw);
    setFocus(k);
    closePanel();
  };

  const onAddBack = async (p: AddedMe) => {
    if (friends.length >= 90) return "Your globe is full.";
    const r = await api.follow(p.id);
    if (!r.friend) return r.error ?? "Couldn't add them back. Try again.";
    setAddedMe((list) => list.filter((x) => x.id !== p.id));
    onFollowed(r.friend);
    return null;
  };

  // Every couple of minutes, and whenever you come back to the app, check for
  // new songs and people, so the My friends count stays current.
  useEffect(() => {
    const news = api.news;
    if (!news) return;
    let last = Date.now();
    const check = () => {
      if (document.hidden) return;
      last = Date.now();
      news().then((n) => {
        if (!n) return;
        const byUser = new Map(n.posts.map((p) => [p.user_id, p]));
        setFriends((list) =>
          list.map((f) => ({ ...f, post: byUser.get(f.id) ?? f.post, followed_back_at: n.backAt[f.id] ?? f.followed_back_at })),
        );
        setAddedMe(n.addedMe);
        setActivity(n.activity);
      });
    };
    const t = setInterval(check, 120_000);
    const back = () => !document.hidden && Date.now() - last > 30_000 && check();
    document.addEventListener("visibilitychange", back);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", back);
    };
  }, [api]);

  // Hide someone's songs from your globe (their tile leaves once the song
  // view has closed), or bring them back.
  const setHidden = async (f: Friend, hide: boolean) => {
    const r = await api.hideSongs(f.id, hide);
    if (r.error) return r.error;
    const k = friends.findIndex((x) => x.id === f.id);
    const apply = () => setFriends((list) => list.map((x) => (x.id === f.id ? { ...x, hidden: hide } : x)));
    if (hide && m.current.featOn) {
      afterFeat.current = apply;
      closeFeat();
    } else {
      if (!hide) m.current.born.set(k, m.current.t);
      apply();
    }
    return null;
  };

  const openTab = (name: PanelName) => {
    if (panel === name && panelOn) return closePanel();
    setChatOn(false);
    if (name === "friends") {
      setSeenBefore(seenAt);
      seenStore.set(new Date().toISOString());
    }
    setPanel(name);
    setPanelOn(true);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const onGlobe = useMemo(
    () => [...(myPost ? [myPost] : []), ...friends.flatMap((f) => (f.post ? [f.post] : []))],
    [friends, myPost],
  );
  const coverColors = useCoverColors(onGlobe);
  const tiles = useMemo<TileInfo[]>(() => {
    const frame = (post: Post | null | undefined) => {
      const url = post?.artwork_url;
      if (!url) return null;
      // a soft glassy frame until the cover's colours are read
      const c = coverColors[url] ?? ["#C9D6E2", "#8FA3B5"];
      // two layers: a sheen over the cover's colours
      return `radial-gradient(circle at 28% 18%, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(145deg, ${drift([c[0]], 0, 0.12)}, ${drift([c[c.length - 1]], 0, 0)})`;
    };
    return keys.map((k) => {
      if (k === ME) {
        const wait = !landed || !myPost;
        return {
          k,
          wait,
          art: myPost ? coverBackground(myPost.artwork_url, myPost.title) : "",
          frame: frame(myPost),
          label: wait ? "Your spot. Add today's song" : `Your song, ${myPost!.title}. Open`,
        };
      }
      const f = friends[k];
      return {
        k,
        wait: !f.post,
        art: f.post ? coverBackground(f.post.artwork_url, f.post.title) : "",
        frame: frame(f.post),
        label: f.post ? `${f.display_name}, ${f.post.title}. Open` : `${f.display_name} hasn't posted yet`,
      };
    });
  }, [keys, friends, myPost, landed, coverColors]);

  const featPost = feat === null ? null : feat === ME ? myPost : friends[feat]?.post ?? null;
  const featWho = feat === ME ? "You" : feat !== null ? friends[feat]?.display_name ?? "" : "";
  const featTz = feat === ME ? me.timezone : feat !== null ? friends[feat]?.timezone ?? "UTC" : "UTC";
  const posted = landed && !!myPost;
  const shuffleSongs = useMemo(
    () => [...friends.flatMap((f) => (f.post && !f.hidden ? [f.post] : [])), ...(myPost && landed ? [myPost] : [])],
    [friends, myPost, landed],
  );
  // the Globe turns to whichever song shuffle is playing
  const shuffleK = !shuffleNow ? null : shuffleNow.id === myPost?.id ? ME : friends.findIndex((f) => f.post?.id === shuffleNow.id);
  useEffect(() => {
    const s = m.current;
    if (shuffleK === null || shuffleK < 0 || s.featOn || s.coreOn || s.lens !== null) return;
    s.vel = 0;
    s.target = aim(sim.current.pos(shuffleK), s.yaw);
    setFocus(shuffleK);
  }, [shuffleK]);
  const ink = darkOn ? "#EEF3F8" : "#0D2A3F";
  const muted = darkOn ? "#93A6B8" : "#6A818C";
  const tabTop = Math.max(100, L.cy - 240);
  const panelW = Math.min(296, L.w - 58);
  // The star field turns with the globe, so it covers the screen's diagonal.
  const starBox = Math.ceil(Math.hypot(L.w, L.h) / 100) * 100 + 100;
  const stars = useMemo(() => {
    const k = (starBox / 1000) ** 2;
    return {
      a: starField(Math.round(320 * k), 7, 0.4, 0.9, starBox),
      b: starField(Math.round(60 * k), 99, 0.3, 1, starBox),
    };
  }, [starBox]);
  const activeTab = (name: PanelName) =>
    panel === name && panelOn
      ? { background: "#FFFFFF", boxShadow: "inset 3px 0 0 #D7262B, 0 8px 30px -14px rgba(13,42,63,0.3)" }
      : {};

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-white text-card-ink"
      style={{ opacity: size ? 1 : 0, transition: "opacity .4s" }}
    >
      <MagmaFilters />

      <div
        ref={(el) => void (R.current.chrome[0] = el)}
        className="pointer-events-none absolute inset-x-0 top-[max(26px,env(safe-area-inset-top))] z-[5] flex flex-col items-center gap-[3px]"
      >
        <h1 className="display text-[26px] leading-[1.1] transition-colors duration-500" style={{ color: ink }}>
          Song of the Day
        </h1>
        <Clock color={muted} />
      </div>

      {/* the stage */}
      <div
        ref={(el) => void (R.current.stage = el)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        className="absolute inset-0 cursor-grab touch-none overflow-hidden"
      >
        {/* everything in 3D shares one perspective */}
        <div
          className="absolute inset-0 origin-top-left"
          style={{ perspective: PERSPECTIVE, perspectiveOrigin: `${L.cx}px ${L.cy}px` }}
        >
        <div
          ref={(el) => void (R.current.day = el)}
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, #CCE3F6 0%, #E4F0FA 40%, #F6FAFD 75%, #FFFFFF 100%)" }}
        />
        <div
          ref={(el) => void (R.current.space = el)}
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0, background: "radial-gradient(ellipse 120% 90% at 50% 46%, #121A3A 0%, #070B1E 45%, #020309 100%)" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 40% at 18% 22%, rgba(120,90,200,0.16), rgba(120,90,200,0) 70%), radial-gradient(ellipse 55% 35% at 85% 78%, rgba(60,160,190,0.13), rgba(60,160,190,0) 70%)",
            }}
          />
          <div
            ref={(el) => void (R.current.stars = el)}
            className="absolute"
            style={{ left: L.cx - starBox / 2, top: L.cy - starBox / 2, width: starBox, height: starBox }}
          >
            <div className="absolute left-0 top-0 h-px w-px rounded-full" style={{ boxShadow: stars.a }} />
            <div
              ref={(el) => void (R.current.starsB = el)}
              className="absolute left-0 top-0 h-0.5 w-0.5 rounded-full"
              style={{ boxShadow: stars.b }}
            />
          </div>
        </div>
        <WeatherSky weather={weather} dark={darkOn} />
        {/* the little sky moments only on clear-ish days */}
        {size && (!weather || weather.kind === "clear" || weather.kind === "partly") && <Ambient dark={darkOn} w={L.w} h={L.h} />}
        {/* clouds, then the weather and seasons further away than the globe's middle */}
        <canvas ref={(el) => void (R.current.wxSky = el)} className="pointer-events-none absolute inset-0 h-full w-full" />
        <canvas ref={(el) => void (R.current.wxBack = el)} className="pointer-events-none absolute inset-0 h-full w-full" />
        <div ref={(el) => void (R.current.sunShadow = el)} className="pointer-events-none absolute rounded-full" />
        <div
          ref={(el) => void (R.current.sphere = el)}
          className="pointer-events-none absolute rounded-full"
          style={{ left: L.cx - L.R - 8, top: L.cy - L.R - 8, width: 2 * (L.R + 8), height: 2 * (L.R + 8) }}
        />
        <div
          ref={(el) => void (R.current.floor = el)}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: L.cx - 80 * L.s,
            top: L.cy + 202 * L.s,
            width: 160 * L.s,
            height: 28 * L.s,
            background: "radial-gradient(closest-side, rgba(13,42,63,0.16), rgba(13,42,63,0))",
            filter: "blur(3px)",
          }}
        />
        <canvas ref={(el) => void (R.current.beam = el)} className="pointer-events-none absolute inset-0 h-full w-full" />
        <div
          ref={(el) => void (R.current.world = el)}
          className="preserve-3d absolute z-[1] h-0 w-0"
          style={{ left: L.cx, top: L.cy }}
        >
          <TileLayer tiles={tiles} half={half} Rb={Rb} focus={focus} els={els} onPick={pick} />
          <button
            ref={(el) => void (R.current.core = el)}
            type="button"
            onClick={() => !m.current.moved && openCore(null)}
            aria-label="Your core. Open profile"
            className="absolute -left-[60px] -top-[60px] h-[120px] w-[120px]"
          >
            <Magma full look={coreWho ? theirLook : look} className="h-full w-full" />
          </button>
        </div>
        {/* the weather and seasons nearer than the globe's middle */}
        <canvas ref={(el) => void (R.current.wxFront = el)} className="pointer-events-none absolute inset-0 z-[2] h-full w-full" />
        </div>
      </div>

      {/* lightning lights up everything */}
      <div ref={(el) => void (R.current.wxFlash = el)} className="pointer-events-none absolute inset-0 z-[5] bg-white opacity-0" />

      {/* + until you've posted, then the countdown to midnight, with shuffle all just above */}
      <div
        ref={(el) => void (R.current.chrome[1] = el)}
        className="absolute inset-x-0 bottom-[calc(46px+env(safe-area-inset-bottom))] z-[6] flex h-[90px] items-center justify-center"
      >
        <div className="absolute inset-x-0 bottom-full flex justify-center pb-1">
          <Shuffle songs={shuffleSongs} />
        </div>
        {!posted && !launching && (
          <button
            type="button"
            onClick={openCompose}
            aria-label="Add today's song"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white"
            style={{ boxShadow: "0 0 0 6px rgba(215,38,43,0.12), 0 12px 28px -8px rgba(215,38,43,0.55)" }}
          >
            <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
        {posted && !launching && <Countdown dark={darkOn} timeZone={me.timezone} />}
      </div>

      {/* recenter: bring every posted song round to the front for a while */}
      <button
        ref={(el) => void (R.current.chrome[4] = el)}
        type="button"
        onClick={() => {
          const s = m.current;
          s.gather = s.t + 10;
          setFocus(null);
        }}
        aria-label="Bring the songs to the front"
        title="Bring the songs to the front"
        className="absolute z-[6] flex h-10 w-10 items-center justify-center rounded-full"
        style={{ left: L.cx + L.R * 0.8 - 20, top: L.cy + L.R * 0.8 - 20, ...glass(darkOn) }}
      >
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="6.5" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
        </svg>
      </button>

      {/* what this is, any time */}
      <HelpButton dark={darkOn} onClick={() => setHelp(true)} buttonRef={(el) => void (R.current.chrome[5] = el)} />
      {(!welcomeSeen || help) && <Welcome api={api} onClose={() => setHelp(false)} />}

      {/* left tabs */}
      <div ref={(el) => void (R.current.chrome[2] = el)} className="absolute left-0 z-[430] flex flex-col gap-2" style={{ top: tabTop }}>
        {(
          [
            ["friends", "My friends", 116],
            ["find", "Find a friend", 130],
            ["songs", "My songs", 112],
          ] as const
        ).map(([name, label, height]) => (
          <button
            key={name}
            type="button"
            onClick={() => openTab(name)}
            aria-label={label}
            aria-expanded={panel === name && panelOn}
            className="relative box-border flex w-[38px] flex-col items-center justify-center gap-2 rounded-r-[18px] !border-l-0 transition-shadow"
            style={{ height, ...glass(darkOn), ...activeTab(name) }}
          >
            <TabIcon name={name} />
            {name === "friends" && newCount > 0 && (
              <span
                aria-label={`${newCount} new`}
                className="absolute right-[3px] top-[6px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold leading-none text-white"
              >
                {newCount}
              </span>
            )}
            <span className="rotate-180 whitespace-nowrap text-[11px] font-semibold tracking-[0.06em] [writing-mode:vertical-rl]">
              {label}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => openCore(null)}
          aria-label="Core, open your profile"
          className="box-border flex h-[84px] w-[38px] flex-col items-center justify-center gap-2 rounded-r-[18px] !border-l-0"
          style={glass(darkOn)}
        >
          <Magma look={look} className="h-4 w-4 drop-shadow-[0_1px_4px_rgba(60,90,110,0.45)]" />
          <span className="rotate-180 whitespace-nowrap text-[11px] font-semibold tracking-[0.06em] [writing-mode:vertical-rl]">
            Core
          </span>
        </button>
      </div>

      {panel && (
        <div
          className="absolute left-[46px] z-[425] box-border flex flex-col overflow-hidden rounded-[26px] transition-[opacity,transform] duration-[260ms] ease-out"
          style={{
            top: Math.max(90, tabTop - 50),
            width: panelW,
            height: Math.min(600, L.h - Math.max(90, tabTop - 50) - 144),
            ...glass(darkOn),
            boxShadow: "18px 0 50px -28px rgba(0,0,0,0.7)",
            opacity: panelOn ? 1 : 0,
            transform: `translateX(${panelOn ? 0 : -60}px)`,
            pointerEvents: panelOn ? undefined : "none",
            animation: "panel-in .26s ease-out",
          }}
        >
          <div className="flex items-center py-1.5 pl-[18px] pr-1.5 pt-3">
            <h2 className="display text-lg">
              {panel === "friends" ? "My friends" : panel === "find" ? "Find a friend" : "My songs"}
            </h2>
            <button type="button" onClick={closePanel} aria-label="Close" className="ml-auto flex h-11 w-11 items-center justify-center">
              <BackIcon />
            </button>
          </div>
          {panel === "friends" && (
            <FriendsPanel
              friends={friends}
              addedMe={addedMe}
              activity={activity}
              onMine={() => myPost && landed && fly(ME)}
              seenBefore={seenBefore}
              onAddBack={onAddBack}
              onShow={(f) => setHidden(f, false)}
              onOpen={fly}
              onCore={(p) => openCore(null, p)}
              onSpin={(k) => {
                m.current.moved = false;
                spinTo(k);
              }}
              onFind={() => setPanel("find")}
            />
          )}
          {panel === "find" && (
            <FindPanel
              api={api}
              me={me}
              friends={friends}
              onFollowed={onFollowed}
              onCore={(p) => openCore(null, p)}
              onSpin={(k) => {
                m.current.moved = false;
                spinTo(k);
              }}
            />
          )}
          {panel === "songs" && (
            <SongsPanel
              me={me}
              songs={mySongs}
              canRedo={!redoUsed && !launching && myPost?.day === todayIn(me.timezone)}
              onRedo={onRedo}
              width={panelW}
            />
          )}
        </div>
      )}

      {/* the globe chat, pulled out from the right */}
      <Chat
        api={api}
        me={me}
        friends={friends}
        addedMe={addedMe}
        dark={darkOn}
        open={chatOn}
        onOpen={() => {
          closePanel();
          setChatOn(true);
        }}
        onClose={() => setChatOn(false)}
        dmWith={dmWith}
        onCore={(p) => {
          setChatOn(false);
          openCore(null, p);
        }}
        tabTop={tabTop}
        top={Math.max(90, tabTop - 50)}
        width={Math.min(320, L.w - 96)}
        height={Math.min(600, L.h - Math.max(90, tabTop - 50) - 144)}
        tabRef={(el) => void (R.current.chrome[3] = el)}
      />

      {feat !== null && featPost && (
        <Feature
          key={featPost.id}
          post={featPost}
          me={me}
          who={featWho}
          timeZone={featTz}
          cover={L.cover}
          dark={darkOn}
          left={L.cx - L.cover / 2}
          top={L.cy - L.cover / 2 - 42}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          onClose={closeFeat}
          onCore={() => openCore(feat === ME ? null : feat)}
          api={api}
          onBlocked={() => window.location.reload()}
          onHide={feat !== ME && friends[feat] ? () => setHidden(friends[feat], true) : undefined}
          rootRef={(el) => void (R.current.feat = el)}
          backdropRef={(el) => void (R.current.featBack = el)}
          cardRef={(el) => void (R.current.featCard = el)}
        />
      )}

      <div
        ref={(el) => void (R.current.launch = el)}
        className="pointer-events-none absolute z-[515] overflow-hidden"
        style={{
          width: 220 * L.s,
          height: 220 * L.s,
          opacity: 0,
          borderRadius: coverRadius(220 * L.s),
          background: myPost ? coverBackground(myPost.artwork_url, myPost.title) : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {compose && <Compose api={api} userId={me.id} onClose={() => setCompose(false)} onPosted={onPosted} />}

      {coreOpen && coreData && (
        <CoreView
          profile={coreData.profile}
          posts={coreData.posts}
          mine={coreData.profile.id === me.id}
          dark={darkOn}
          sheetTop={Math.round(L.cy + Math.max(56, L.R * 0.5))}
          onClose={closeCore}
          onOpenToday={!coreWho ? () => fly(ME) : coreFor?.k != null ? () => fly(coreFor.k!) : undefined}
          onAdd={coreAdded ? undefined : addFromCore}
          onMessage={
            coreWho && (coreAdded || addedMe.some((p) => p.id === coreWho.id))
              ? () => {
                  closeCore();
                  closePanel();
                  setDmWith({ p: coreWho, n: Date.now() });
                  setChatOn(true);
                }
              : undefined
          }
          api={api}
          onBlocked={() => window.location.reload()}
          rootRef={(el) => void (R.current.prof = el)}
          sheetRef={(el) => void (R.current.profSheet = el)}
        />
      )}
    </div>
  );
}

// Writes one frame of motion and light straight to the DOM.
function draw(
s: Motion,
r: Els,
tileEls: Map<number, TileEls>,
sim: TileSim,
{ keys, half, Rb, L, zFeat, friends }: Live,
) {
  const sun = s.sun!;
  const dk = s.dk;
  const W = half * 2,
    fs = W / 3,
    r0 = 0.26 * W;

  const reveal = s.lens !== null ? 0 : clamp01((s.zoom - 1.4) / 1.2);
  const lensP = s.lens !== null ? clamp01((s.zoom - 1) / (zFeat - 1)) : 0;
  const cam: Camera = { yaw: s.yaw, pitch: s.pitch, roll: 0 };
  s.cam = cam;
  // the tilt leaves a centred tile leaning; roll the camera so the song lands upright
  if (s.lens !== null) {
    if (!s.featOn) {
      const { lat, lon } = latLon(sim.pos(s.lens));
      const e = camV([Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.sin(lat) * Math.cos(lon)], cam, true);
      s.rollHold = Math.atan2(e[0], e[1]);
    }
    cam.roll = s.rollHold * lensP;
  }

  if (r.world) {
    r.world.style.transform = `scale3d(${s.zoom},${s.zoom},${s.zoom}) rotateZ(${cam.roll.toFixed(4)}rad) rotateX(${s.pitch}rad) rotateZ(${TILT}rad) rotateY(${s.yaw}rad)`;
    r.world.style.pointerEvents = reveal > 0.5 ? "none" : "";
  }
  if (r.core)
    r.core.style.transform = `rotateY(${(-s.yaw).toFixed(4)}rad) rotateZ(${(-TILT).toFixed(4)}rad) rotateX(${(-s.pitch).toFixed(4)}rad) rotateZ(${(-cam.roll).toFixed(4)}rad) scale(${(0.3333 * L.s * Math.min(1, 3.9 / s.zoom)).toFixed(4)})`;

  // tiles
  const Lc = sun.L,
    day = sun.day;
  const lk = s.look;
  const direct = 1 - 0.7 * lk.overcast;
  const grey = 0.1 * lk.overcast * day;
  const hv = [Lc[0], Lc[1], Lc[2] + 1],
    hl = Math.hypot(hv[0], hv[1], hv[2]) || 1;
  const visibleZ = (s.zoom * Rb) / PERSPECTIVE - 0.05;
  for (const k of keys) {
    const te = tileEls.get(k);
    if (!te?.box) continue;
    const v = sim.pos(k);
    const { lat, lon } = latLon(v);
    const wait = k === ME ? !s.myLanded : !friends[k]?.post;
    const b = s.born.get(k);
    const lockAt = k === ME ? s.myLock : null;
    const lockAge = wait || lockAt === null ? 99 : s.t - lockAt;
    const grow = 1 - Math.pow(1 - Math.min(1, (b === undefined ? 99 : s.t - b) / 0.9), 3);
    const lockE = 1 - Math.pow(1 - Math.min(1, lockAge / 0.7), 3);
    const sla = Math.sin(lat),
      cla = Math.cos(lat),
      slo = Math.sin(lon),
      clo = Math.cos(lon);
    const ez = camV([cla * slo, -sla, cla * clo], cam);
    const camZ = s.zoom * Rb * ez[2];
    const nearFade = clamp01((880 - camZ) / 220);
    te.box.style.visibility = nearFade <= 0 ? "hidden" : "";
    // riding the water: up and down, and rocked a little
    const fl = sim.float(k);
    te.box.style.transform =
      `rotateY(${lon.toFixed(4)}rad) rotateX(${lat.toFixed(4)}rad) translateZ(${(Rb + fl.h).toFixed(2)}px) ` +
      `rotateX(${fl.a.toFixed(4)}rad) rotateY(${fl.b.toFixed(4)}rad) scale(${grow.toFixed(3)})`;
    if (nearFade <= 0 || ez[2] < visibleZ) continue; // facing away: nothing to light

    const ex = camV([clo, 0, -slo], cam),
      ey = camV([sla * slo, cla, sla * clo], cam);
    const fadeOp =
      nearFade * (1 - reveal * 0.6) * (s.lens !== null ? (k !== s.lens ? 1 - 0.88 * lensP : 1 - s.fp) : 1);
    const morph = lockE < 1 || wait;
    const line = wait
      ? dk > 0.5
        ? `rgba(220,235,255,${(0.1 + 0.16 * dk).toFixed(3)})`
        : `rgba(13,42,63,${(0.16 * (1 - dk * 2)).toFixed(3)})`
      : "";
    for (let i = 0; i < 9; i++) {
      const f = te.facets[i];
      if (!f) continue;
      const row = Math.floor(i / 3),
        col = i % 3;
      const ox = col * fs + fs / 2 - half,
        oy = row * fs + fs / 2 - half;
      if (i === 0 || i === 2 || i === 6 || i === 8) {
        const ci = i === 0 ? 0 : i === 2 ? 1 : i === 8 ? 2 : 3;
        const base = morph ? (0.31 + 0.05 * Math.sin(s.mt * (0.8 + ci * 0.2) + ci + k)) * W : r0;
        const rad = Math.min(fs, base).toFixed(1) + "px";
        if (i === 0) f.style.borderTopLeftRadius = rad;
        else if (i === 2) f.style.borderTopRightRadius = rad;
        else if (i === 8) f.style.borderBottomRightRadius = rad;
        else f.style.borderBottomLeftRadius = rad;
      }
      if (wait) {
        const sx = Math.sin(ox / Rb),
          sy = Math.sin(oy / Rb);
        const wn = [0, 1, 2].map((j) => ex[j] * sx + ey[j] * sy + ez[j]);
        const wl = (wn[0] * Lc[0] + wn[1] * Lc[1] + wn[2] * Lc[2]) / Math.hypot(wn[0], wn[1], wn[2]);
        f.style.backgroundColor = `rgba(13,42,63,${(0.02 + 0.16 * Math.max(0, -wl) * day).toFixed(3)})`;
        f.style.borderColor = line;
        f.style.opacity = fadeOp.toFixed(3);
      } else {
        const fa = ox / Rb,
          fb = -oy / Rb;
        const nn = [0, 1, 2].map(
          (j) => ex[j] * Math.sin(fa) - ey[j] * Math.sin(fb) + ez[j] * Math.cos(fa) * Math.cos(fb),
        );
        const lit = nn[0] * Lc[0] + nn[1] * Lc[1] + nn[2] * Lc[2];
        // cloud cover takes the edge off the sun: softer light, softer shadows
        const shade =
          lit > 0
            ? `rgba(255,247,226,${(0.32 * lit * day * direct).toFixed(3)})`
            : `rgba(13,42,63,${(Math.min(0.62, 0.75 * -lit + 0.12) * day * (0.4 + 0.6 * direct)).toFixed(3)})`;
        const amb = `rgba(13,42,63,${(0.1 * (1 - day) + 0.05 * lk.wet).toFixed(3)})`;
        let layers = `linear-gradient(${shade},${shade}), `;
        if (grey > 0.005) layers += `linear-gradient(rgba(120,130,140,${grey.toFixed(3)}),rgba(120,130,140,${grey.toFixed(3)})), `;
        if (lk.wet > 0.01) {
          // wet covers catch the light: a glint where the sun reflects, and the sky's sheen
          const nh = (nn[0] * hv[0] + nn[1] * hv[1] + nn[2] * hv[2]) / hl;
          const ry = 2 * nn[2] * nn[1];
          const glint = lk.wet * (0.4 * Math.pow(Math.max(0, nh), 60) * day * direct + 0.1 * Math.pow(clamp01(-ry), 2) * (0.3 + 0.7 * day));
          if (glint > 0.004) layers += `linear-gradient(rgba(255,255,255,${glint.toFixed(3)}),rgba(255,255,255,${glint.toFixed(3)})), `;
        }
        const sh = te.shades[i];
        if (sh) sh.style.background = layers + amb;
        // frost rims the covers in winter and when it's freezing; the sun melts it back
        const coat = te.coats[i];
        if (coat) {
          if (lk.frost > 0.01 && !coat.dataset.k) {
            coat.dataset.k = "frost";
            coat.style.backgroundImage = `url(${frostTexture()})`;
          }
          coat.style.opacity = (lk.frost > 0.01 ? lk.frost * (0.95 - 0.5 * Math.max(0, lit) * day) : 0).toFixed(3);
        }
        f.style.opacity = (fadeOp * lockE).toFixed(3);
      }
    }
  }

  // the room: sun glow, the globe's shadow on the floor, faint body of the sphere
  const sElv = Math.sin(sun.el),
    cElv = Math.cos(sun.el);
  const roomOp = (1 - reveal) * (1 - lensP) * (1 - dk);
  if (r.sunShadow) {
    const cot = Math.min(2.2, cElv / Math.max(0.05, sElv));
    const lx = Math.sin(sun.az),
      lz = -Math.cos(sun.az);
    const len = Math.min(170, 0.45 * 216 * cot) * L.s;
    const w = 290 * L.s * (1 + 0.45 * cot * Math.abs(lx)),
      h = 60 * L.s * (1 + 0.5 * cot * Math.abs(lz));
    const cx = L.cx - lx * len,
      cy = L.cy + 216 * L.s - lz * len * 0.3;
    const a = (0.12 * (1 - day) + (day * 0.72) / (1 + 0.3 * cot)) * (0.35 + 0.65 * direct);
    const st = r.sunShadow.style;
    st.left = (cx - w / 2).toFixed(1) + "px";
    st.top = (cy - h / 2).toFixed(1) + "px";
    st.width = w.toFixed(1) + "px";
    st.height = h.toFixed(1) + "px";
    st.opacity = roomOp.toFixed(3);
    st.background = `radial-gradient(closest-side, rgba(13,42,63,${a.toFixed(3)}), rgba(13,42,63,${(a * 0.7).toFixed(3)}) 50%, rgba(13,42,63,0))`;
    st.filter = `blur(${(1.5 + 1.5 * cot * day + 5 * (1 - day) + 7 * lk.overcast).toFixed(1)}px)`;
  }
  if (r.floor) r.floor.style.opacity = roomOp.toFixed(3);
  if (r.sphere) {
    const hx = 50 + 42 * Lc[0],
      hy = 50 + 42 * Lc[1],
      lit = 18 + (30 * (1 + Lc[2])) / 2;
    r.sphere.style.opacity = ((1 - reveal) * (1 - lensP) * Math.max(0, 1 - (s.zoom - 1) * 3)).toFixed(3);
    r.sphere.style.background = `radial-gradient(circle at ${hx.toFixed(1)}% ${hy.toFixed(1)}%, rgba(255,250,236,${((0.35 + 0.2 * dk) * day * direct + 0.05 * dk).toFixed(3)}) 0%, rgba(255,250,236,0) ${lit.toFixed(1)}%, rgba(${dk > 0.5 ? "0,0,0" : "13,42,63"},${((0.04 + 0.11 * day) * (dk > 0.5 ? 2.2 : 1)).toFixed(3)}) 100%)`;
    r.sphere.style.boxShadow = dk > 0 ? `0 0 ${(40 * dk).toFixed(0)}px rgba(180,210,255,${(0.08 * dk).toFixed(3)})` : "";
  }
  if (r.space) r.space.style.opacity = dk.toFixed(3);
  if (r.stars) r.stars.style.transform = `rotate(${(s.yaw * 0.08).toFixed(4)}rad)`;
  if (r.starsB) r.starsB.style.opacity = (0.65 + 0.35 * Math.sin(s.mt * 1.7)).toFixed(3);

  // chrome fades away while flying to a song or into a core
  const chrome = Math.min(1 - s.fp, 1 - reveal, 1 - lensP);
  const off = s.fp > 0.3 || reveal > 0.3 || lensP > 0.3;
  for (const el of r.chrome)
    if (el) {
      el.style.opacity = chrome.toFixed(3);
      el.style.pointerEvents = off ? "none" : "";
    }

  // the song card and the core fade with the camera
  // the world stays there behind a song, softly blurred
  if (r.featBack) {
    const blur = `blur(${(6 * s.fp).toFixed(1)}px)`;
    r.featBack.style.background = `rgba(${dk > 0.5 ? "8,14,26" : "248,250,252"},${(0.18 * s.fp).toFixed(3)})`;
    r.featBack.style.backdropFilter = blur;
    r.featBack.style.setProperty("-webkit-backdrop-filter", blur);
  }
  if (r.featCard) r.featCard.style.opacity = (1 - Math.pow(1 - s.fp, 3)).toFixed(3);
  // the core's page fades in while its sheet glides up from below the screen
  if (r.prof) r.prof.style.opacity = Math.min(1, s.profP * 2.2).toFixed(3);
  if (r.profSheet) r.profSheet.style.transform = `translateY(${(Math.pow(1 - s.profP, 4) * 70).toFixed(2)}vh)`;

  // your song dropping into the globe
  if (r.launch) {
    if (s.launch === null) r.launch.style.opacity = "0";
    else {
      const p = s.launch;
      let y: number,
        sc: number,
        op = 1;
      if (p < 0.3) {
        const e = 1 - Math.pow(1 - p / 0.3, 2);
        y = 170 - 220 * e;
        sc = 0.45 + 0.6 * e;
      } else {
        const u = (p - 0.3) / 0.7;
        const e = u * u * u;
        y = -50 + 135 * e;
        sc = 1.05 - 0.8 * e;
        op = p > 0.92 ? (1 - p) / 0.08 : 1;
      }
      const box = 220 * L.s;
      r.launch.style.left = (L.cx - box / 2).toFixed(1) + "px";
      r.launch.style.top = (L.cy + y * L.s - box / 2).toFixed(1) + "px";
      r.launch.style.opacity = op.toFixed(3);
      r.launch.style.transform = `scale(${sc.toFixed(3)})`;
      r.launch.style.boxShadow = `0 30px 70px -20px rgba(13,42,63,0.5), 0 0 ${Math.round(30 + 50 * p)}px ${Math.round(6 + 10 * p)}px rgba(13,42,63,${(0.06 + 0.1 * p).toFixed(2)})`;
    }
  }
}

// The magma stream: from the back of the playing song's tile into the core,
// flowing inwards and swelling on the song's hits. Drawn on a canvas just
// behind the globe, so the tile covers its end and the core its start.
function drawBeam(s: Motion, cv: HTMLCanvasElement | null, sim: TileSim, { half, Rb, L, beam, look }: Live, dt: number) {
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(L.w * dpr),
    H = Math.round(L.h * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const ctx = cv.getContext("2d");
  if (!ctx) return;

  // fades in when a song starts, out when it's paused or stopped
  const on = beam !== null && !beam.paused && s.lens === null && !s.coreOn;
  if (beam) s.beamK = beam.k;
  s.beamA += ((on ? 1 : 0) - s.beamA) * Math.min(1, dt * (on ? 2.5 : 4));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (s.beamA < 0.01 || s.beamK < 0 || !s.cam) return;

  // the song's hits while the site can hear it; otherwise an even flow. Each
  // new hit sends a swell of magma down the stream into the core.
  const ct = beam?.beat ? beam.clipTime() : null;
  const hit = beam?.beat && ct !== null ? pulseAt(beam.beat, ct) : 0;
  if (hit > s.beamLvl + 0.25 && hit > 0.45) s.beamSwells.push({ u: 0, a: hit });
  s.beamLvl += (hit - s.beamLvl) * Math.min(1, dt * (hit > s.beamLvl ? 40 : 9));
  const lvl = s.beamLvl;
  for (const w of s.beamSwells) w.u += dt * 1.5;
  s.beamSwells = s.beamSwells.filter((w) => w.u < 1.1).slice(-4);

  const { lat, lon } = latLon(sim.pos(s.beamK));
  const v = camV([Math.cos(lat) * Math.sin(lon), -Math.sin(lat), Math.cos(lat) * Math.cos(lon)], s.cam);
  const z = v[2] * Rb * s.zoom;
  const kz = (s.zoom * PERSPECTIVE) / Math.max(1, PERSPECTIVE - z);
  const tx = L.cx + v[0] * Rb * kz,
    ty = L.cy + v[1] * Rb * kz;
  const night = s.dk > 0.5;
  // round the back of the globe it dims, passing behind the core
  const A = s.beamA * (0.35 + 0.65 * clamp01((v[2] + 0.35) / 0.7)) * (night ? 0.7 : 0.85);
  const dx = L.cx - tx,
    dy = L.cy - ty,
    len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len,
    ny = dx / len;
  const wTile = half * kz * 0.42,
    wCore = 7 * L.s;

  // the stream sways a little as it flows, like something thick and warm
  const sway = len * 0.07 * Math.sin(s.mt * 0.6);
  const mx = tx + dx * 0.5 + nx * sway,
    my = ty + dy * 0.5 + ny * sway;
  const at = (u: number): [number, number] => {
    const a = (1 - u) * (1 - u),
      b = 2 * u * (1 - u),
      c = u * u;
    return [a * tx + b * mx + c * L.cx, a * ty + b * my + c * L.cy];
  };
  const width = (u: number) => {
    let k = 1 + 0.16 * Math.sin(u * 11 - s.mt * 3.2) + 0.07 * Math.sin(u * 23 + s.mt * 1.7);
    for (const w of s.beamSwells) k += 0.45 * w.a * Math.exp(-(((u - w.u) / 0.09) ** 2));
    return (wTile + (wCore - wTile) * u) * k;
  };

  // the core's own colours, slowly shifting: your songs' colours once your
  // core has them, the original light magma before
  const hue = (s.mt * 14) % 360;
  const mag = look
    ? (dh: number, _sat: number, l: number, a: number) =>
        drift(look.colors, s.mt * 0.12 + dh / 60, clamp01((l - (night ? 70 : 74)) / 50), clamp01(a))
    : (dh: number, sat: number, l: number, a: number) =>
        `hsla(${((hue + dh) % 360).toFixed(0)},${sat}%,${night ? l : l - 6}%,${clamp01(a).toFixed(3)})`;
  const style = look?.style;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = night ? "screen" : "source-over";
  const N = 30;
  // dh: the colour at the song's end and at the core's, from the core's palette
  const stream = (scale: number, a: number, blur: number, dh0: number, dh1: number, l: number) => {
    const side: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N,
        [x, y] = at(u),
        w = width(u) * scale;
      side.push([x + nx * w, y + ny * w]);
      side.unshift([x - nx * w, y - ny * w]);
    }
    const g = ctx.createLinearGradient(tx, ty, L.cx, L.cy);
    g.addColorStop(0, mag(dh0, 95, l, a * 0.75));
    g.addColorStop(1, mag(dh1, 100, l + 6, a));
    ctx.fillStyle = g;
    ctx.shadowColor = mag(dh1, 100, l, a);
    ctx.shadowBlur = blur;
    ctx.beginPath();
    side.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  // a soft haze, the flowing body, and its bright heart; matte cores don't
  // glow, hazy ones glow wider, electric ones have a hot wire down the middle
  const hazy = style === "hazy";
  if (style !== "matte") stream(hazy ? 2.2 : 1.7, A * (0.16 + 0.12 * lvl), (hazy ? 24 : 16) * L.s, 70, 40, 78);
  stream(0.85, A * (0.5 + 0.2 * lvl), (style === "matte" ? 0 : 6) * L.s, 60, 25, 76);
  ctx.shadowBlur = 0;
  stream(0.3, A * (0.55 + 0.3 * lvl), 0, 20, 0, 88);
  if (style === "electric") {
    ctx.shadowBlur = 8 * L.s;
    stream(0.08, A * (0.7 + 0.3 * Math.abs(Math.sin(s.mt * 3.1))), 8 * L.s, 0, 30, 100);
    ctx.shadowBlur = 0;
  }

  // gooey globs riding in from the song to the core, hot at their hearts,
  // with a few darker cooling patches between them
  const flow = s.mt * 0.2 * (look ? Math.max(0.6, look.speed / 0.8) : 1);
  const glob = (u: number, r: number, inner: string, outer: string) => {
    const [x, y] = at(u);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let i = 0; i < 16; i++) {
    const u = (((i * 0.6180339 + flow) % 1) + 1) % 1;
    const fade = Math.sqrt(Math.sin(Math.PI * u));
    const r = width(u) * (0.55 + 0.25 * Math.sin(i * 3.1 + s.mt * 2));
    glob(u, r, mag(10, 100, night ? 94 : 84, A * 0.6 * fade), mag(30, 100, 80, 0));
  }
  ctx.globalCompositeOperation = night ? "source-over" : "multiply";
  for (let i = 0; i < 5; i++) {
    const u = (((i * 0.381966 + 0.13 + flow * 0.8) % 1) + 1) % 1;
    const a = A * 0.22 * Math.sin(Math.PI * u);
    if (look) glob(u, width(u) * 0.55, alpha(look.base, clamp01(a * 1.4)), alpha(look.base, 0));
    else glob(u, width(u) * 0.55, mag(110, 55, 52, a), mag(110, 55, 52, 0));
  }
  // a night owl's stream carries a few stars down with it
  if (look?.stars) {
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 9; i++) {
      const u = (((i * 0.7548 + flow * 1.3) % 1) + 1) % 1,
        [x, y] = at(u),
        off = Math.sin(i * 5.3) * width(u) * 0.6;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(s.mt * 2 + i));
      ctx.fillStyle = `rgba(255,255,255,${(A * Math.sin(Math.PI * u) * tw).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x + nx * off, y + ny * off, 1.1 * L.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // where it meets the song and where it pours into the core
  ctx.globalCompositeOperation = night ? "screen" : "source-over";
  const halo = (x: number, y: number, r: number, a: number, dh: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, mag(dh, 100, 86, a));
    g.addColorStop(1, mag(dh, 100, 86, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  halo(tx, ty, half * kz * (1.1 + 0.15 * lvl), A * (0.1 + 0.25 * lvl), 55);
  halo(L.cx, L.cy, (26 + 14 * lvl) * L.s, A * (0.14 + 0.3 * lvl), 25);
  ctx.globalCompositeOperation = "source-over";
}

// ---------------------------------------------------------------------------
// The tiles. Memoised: their motion and light are written by the frame loop.
// Each one is a 3×3 grid of facets bent to the sphere's curve.
// ---------------------------------------------------------------------------

const TileLayer = memo(function TileLayer({
  tiles,
  half,
  Rb,
  focus,
  els,
  onPick,
}: {
  tiles: TileInfo[];
  half: number;
  Rb: number;
  focus: number | null;
  els: React.RefObject<Map<number, TileEls>>;
  onPick(k: number, wait: boolean): void;
}) {
  const W = half * 2,
    fs = W / 3,
    r0 = Math.round(0.26 * W);
  // a real cover sits inset, square, far enough in that the rounded corners
  // never clip it
  const d = Math.round(0.09 * W),
    A = W - 2 * d,
    rim = "linear-gradient(rgba(13,42,63,0.35), rgba(13,42,63,0.35))"; // a hairline round the cover
  return tiles.map(({ k, wait, art, frame, label }) => {
    if (!els.current.has(k)) els.current.set(k, { box: null, facets: [], shades: [], coats: [] });
    const te = els.current.get(k)!;
    const facets = [];
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3),
        col = i % 3;
      const ov = wait ? 0 : 0.6; // overlap hides hairline seams between facets
      const l0 = col * fs - (col > 0 ? ov : 0),
        t0 = row * fs - (row > 0 ? ov : 0);
      const fw = fs + (col > 0 ? ov : 0) + (col < 2 ? ov : 0),
        fh = fs + (row > 0 ? ov : 0) + (row < 2 ? ov : 0);
      const ox = l0 + fw / 2 - half,
        oy = t0 + fh / 2 - half;
      const edge = "1px solid";
      facets.push(
        <div
          key={i}
          ref={(el) => void (te.facets[i] = el)}
          className="backface-hidden absolute box-border overflow-hidden"
          style={{
            left: l0,
            top: t0,
            width: fw,
            height: fh,
            transform: `translate(${-ox}px,${-oy}px) translateZ(${-Rb}px) rotateY(${(ox / Rb).toFixed(4)}rad) rotateX(${(-oy / Rb).toFixed(4)}rad) translateZ(${Rb}px)`,
            ...(wait
              ? {
                  borderTop: row === 0 ? edge : undefined,
                  borderBottom: row === 2 ? edge : undefined,
                  borderLeft: col === 0 ? edge : undefined,
                  borderRight: col === 2 ? edge : undefined,
                  borderColor: "transparent",
                }
              : frame
                ? {
                    backgroundImage: `${art}, ${rim}, ${frame}`,
                    backgroundSize: `${A}px ${A}px, ${A + 2}px ${A + 2}px, ${W}px ${W}px, ${W}px ${W}px`,
                    backgroundPosition: `${d - l0}px ${d - t0}px, ${d - 1 - l0}px ${d - 1 - t0}px, ${-l0}px ${-t0}px, ${-l0}px ${-t0}px`,
                    backgroundRepeat: "no-repeat",
                  }
                : {
                    backgroundImage: art,
                    backgroundSize: `${W}px ${W}px`,
                    backgroundPosition: `${-l0}px ${-t0}px`,
                  }),
          }}
        >
          {!wait && (
            <div
              ref={(el) => void (te.coats[i] = el)}
              className="absolute inset-0 opacity-0"
              style={{
                backgroundSize: `${W}px ${W}px`,
                backgroundPosition: `${-l0}px ${-t0}px`,
              }}
            />
          )}
          {!wait && <div ref={(el) => void (te.shades[i] = el)} className="absolute inset-0" />}
        </div>,
      );
    }
    return (
      <div
        key={k}
        ref={(el) => void (te.box = el)}
        className="preserve-3d absolute"
        style={{ left: -half, top: -half, width: W, height: W, transformOrigin: `${half}px ${half}px` }}
      >
        <div
          className="backface-hidden absolute inset-0 opacity-60"
          style={{ transform: "rotateY(180deg)", background: "rgba(13,42,63,0.05)", borderRadius: "26%" }}
        />
        {focus === k && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ transform: "translateZ(1.5px)", borderRadius: r0, boxShadow: "inset 0 0 0 3px #D7262B" }}
          />
        )}
        <button
          type="button"
          onClick={() => onPick(k, wait)}
          aria-label={label}
          className="preserve-3d absolute inset-0 cursor-pointer"
        >
          {facets}
        </button>
      </div>
    );
  });
});

// ---------------------------------------------------------------------------
// Small pieces that tick every second on their own, so the Globe doesn't.
// ---------------------------------------------------------------------------

const subscribeSeconds = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};

function useNow() {
  const sec = useSyncExternalStore(
    subscribeSeconds,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
  return sec === null ? null : new Date(sec * 1000);
}

function Clock({ color }: { color: string }) {
  const now = useNow();
  return (
    <div className="h-4 text-xs tracking-[0.02em] transition-colors duration-500" style={{ color }}>
      {now &&
        `${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
    </div>
  );
}

// Time left until midnight where you live, when the next song opens up.
function Countdown({ dark, timeZone }: { dark: boolean; timeZone: string }) {
  const now = useNow();
  if (!now) return null;
  let left: number;
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
        .formatToParts(now)
        .map((p) => [p.type, Number(p.value)]),
    );
    left = 86400 - (parts.hour * 3600 + parts.minute * 60 + parts.second);
  } catch {
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    left = Math.floor((mid.getTime() - now.getTime()) / 1000);
  }
  const hh = Math.floor(left / 3600),
    mm = Math.floor((left % 3600) / 60),
    ss = left % 60;
  const two = (x: number) => String(x).padStart(2, "0");
  return (
    <div
      role="timer"
      aria-label={`${hh} hours ${mm} minutes until the next song`}
      className="font-bubble text-[50px] font-semibold leading-none tracking-[0.05em] tabular-nums transition-colors duration-500"
      style={
        dark
          ? { color: "rgba(230,240,255,0.06)", WebkitTextStroke: "1.5px rgba(230,240,255,0.6)", textShadow: "0 0 18px rgba(180,210,255,0.25)" }
          : { color: "rgba(13,42,63,0.04)", WebkitTextStroke: "1.5px rgba(13,42,63,0.45)", textShadow: "0 6px 14px rgba(13,42,63,0.12)" }
      }
    >
      {two(hh)}:{two(mm)}:{two(ss)}
    </div>
  );
}

function TabIcon({ name }: { name: PanelName }) {
  const p = { "aria-hidden": true, width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  if (name === "friends")
    return (
      <svg {...p}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14.5c2.6 0 4.6 1.6 5.5 4.5" />
      </svg>
    );
  if (name === "find")
    return (
      <svg {...p}>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5.5 5.5" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}
