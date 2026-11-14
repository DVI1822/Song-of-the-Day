"use client";

import { useEffect, useLayoutEffect, useRef, type ButtonHTMLAttributes, type Ref } from "react";

// A side tab you can grab and pull, like the handle of a drawer. Drag it
// out from the edge and its panel slides out under your finger; let go past
// a third of the way (or with a flick) and it opens, otherwise it slides
// back. Drag the tab of an open panel back toward the edge to put it away.
// A plain tap still does what it always did: the click goes through unless
// the finger actually dragged. The tab itself gives a little as you pull it,
// so it feels held. With no panel (the Core tab) the pull alone decides.
//
// Everything moves by writing straight to the elements' styles while the
// finger is down, so the Globe doesn't re-render on every move. On release
// the panel is left at the place React's own style for it will put it, so
// the two never disagree.

const LOCK = 8; // px before a drag counts as one
const FLICK = 0.4; // px per ms that opens or closes whatever the distance
const SNAP = 240; // ms for the slide after you let go
const GIVE = 16; // how far the tab itself stretches, at most

type Opts = {
  side: "left" | "right"; // which edge the tab sits on
  open: boolean; // this tab's panel is out
  travel: number; // px from tucked away to fully out
  panel?: string; // the panel's element id
  onStart?(): void; // a drag began (mount the panel, close others)
  onOpen(): void;
  onClose?(): void;
  onEnd?(): void; // the drag is over, whichever way it went
};

export function usePull(o: Opts) {
  const opts = useRef(o);
  useLayoutEffect(() => {
    opts.current = o;
  });
  const s = useRef({
    id: -1,
    x0: 0,
    y0: 0,
    from: 0, // progress when the drag began: 0 tucked, 1 out
    on: false, // locked into a sideways drag
    dead: false, // went up or down instead
    eat: false, // swallow the click that follows a drag
    p: 0,
    hist: [] as { t: number; x: number }[],
    tab: null as HTMLElement | null,
  });

  const sign = () => (opts.current.side === "left" ? 1 : -1);
  const closedX = () => -sign() * 60; // where React parks a closed panel

  const paint = (p: number, pulled: number) => {
    const { panel } = opts.current;
    const el = panel ? document.getElementById(panel) : null;
    if (el) {
      el.style.transition = "none";
      el.style.animation = "none";
      el.style.pointerEvents = "none";
      el.style.transform = `translateX(${-sign() * (1 - p) * opts.current.travel}px)`;
      el.style.opacity = String(Math.min(1, p * 3));
    }
    const tab = s.current.tab;
    if (tab) {
      // past its own reach the tab gives less and less, like something held
      const give = panel ? GIVE * (1 - Math.exp(-Math.max(0, pulled) / 60)) : Math.max(0, pulled) * 0.35;
      tab.style.transition = "none";
      tab.style.transform = `translateX(${sign() * give}px)`;
    }
  };

  const settle = (el: HTMLElement | null | undefined, open: boolean) => {
    if (!el) return;
    // the slide plays even with Reduce Motion on: it finishes what the finger started
    el.style.setProperty("transition", `transform ${SNAP}ms cubic-bezier(.2,.8,.3,1), opacity ${SNAP}ms ease-out`, "important");
    el.style.transform = open ? "translateX(0px)" : `translateX(${closedX()}px)`;
    el.style.opacity = open ? "1" : "0";
    el.style.pointerEvents = "";
    if (!open) el.style.pointerEvents = "none";
    setTimeout(() => {
      el.style.removeProperty("transition");
      // React owns pointer-events again from here
      el.style.pointerEvents = opts.current.open ? "" : "none";
    }, SNAP + 20);
  };

  const release = (tab: HTMLElement | null) => {
    if (!tab) return;
    tab.style.setProperty("transition", `transform ${SNAP}ms cubic-bezier(.3,1.6,.5,1)`, "important");
    tab.style.transform = "";
    setTimeout(() => tab.style.removeProperty("transition"), SNAP + 20);
  };

  const finish = (cancelled: boolean) => {
    const st = s.current;
    const o = opts.current;
    const tab = st.tab;
    st.id = -1;
    if (!st.on) return;
    st.on = false;
    st.eat = true;
    const h = st.hist;
    const a = h[0],
      b = h[h.length - 1];
    const v = a && b && b.t > a.t ? (sign() * (b.x - a.x)) / (b.t - a.t) : 0;
    let open: boolean;
    if (cancelled) open = st.from === 1;
    else if (v > FLICK) open = true;
    else if (v < -FLICK) open = false;
    else open = st.p > (st.from === 1 ? 0.7 : 0.28);
    if (o.panel) settle(document.getElementById(o.panel), open);
    release(tab);
    if (open && st.from === 0) o.onOpen();
    else if (!open && st.from === 1) o.onClose?.();
    o.onEnd?.();
  };

  const bind = {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      if (e.button !== 0 || s.current.id !== -1) return;
      const st = s.current;
      st.id = e.pointerId;
      st.x0 = e.clientX;
      st.y0 = e.clientY;
      st.on = false;
      st.dead = false;
      st.eat = false;
      st.tab = e.currentTarget;
      st.from = opts.current.open ? 1 : 0;
      st.p = st.from;
      st.hist = [{ t: e.timeStamp, x: e.clientX }];
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      const st = s.current;
      if (e.pointerId !== st.id || st.dead) return;
      const dx = e.clientX - st.x0,
        dy = e.clientY - st.y0;
      if (!st.on) {
        if (Math.abs(dy) > LOCK && Math.abs(dy) > Math.abs(dx)) {
          st.dead = true;
          return;
        }
        if (Math.abs(dx) < LOCK) return;
        // pushing a tucked tab into the wall, or pulling an open one further out, does nothing
        if (sign() * dx < 0 && st.from === 0) return void (st.dead = true);
        st.on = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        opts.current.onStart?.();
      }
      st.hist.push({ t: e.timeStamp, x: e.clientX });
      while (st.hist.length > 2 && e.timeStamp - st.hist[0].t > 90) st.hist.shift();
      const pulled = sign() * dx;
      st.p = Math.max(0, Math.min(1, st.from + pulled / opts.current.travel));
      paint(st.p, st.from === 0 ? pulled : 0);
    },
    onPointerUp(e: React.PointerEvent<HTMLElement>) {
      if (e.pointerId === s.current.id) finish(false);
    },
    onPointerCancel(e: React.PointerEvent<HTMLElement>) {
      if (e.pointerId === s.current.id) finish(true);
    },
    onClickCapture(e: React.MouseEvent<HTMLElement>) {
      if (!s.current.eat) return;
      s.current.eat = false;
      e.preventDefault();
      e.stopPropagation();
    },
    // the finger, not the page, owns a drag that starts on a tab
    style: { touchAction: "none" } as React.CSSProperties,
  };
  return bind;
}

// A tab button that pulls (see usePull above); otherwise a plain button.
export function PullTab({
  pull,
  buttonRef,
  style,
  ...rest
}: { pull: Opts; buttonRef?: Ref<HTMLButtonElement> } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { style: own, ...bind } = usePull(pull);
  return <button ref={buttonRef} type="button" {...rest} {...bind} style={{ ...style, ...own }} />;
}

// An open side panel you can push back in: drag it sideways toward its own
// edge and it follows the finger; let go past a third of the way (or with a
// flick that way) and it closes, otherwise it springs back. Up and down still
// scroll the panel, and a drag that starts in a text box is left alone.
// Touch events, not pointer events: once the panel's list can scroll, the
// browser takes a pointer drag for itself (pointercancel), while a touchmove
// can still be claimed with preventDefault once it's clearly sideways.
export function useSwipeAway(o: { side: "left" | "right"; onClose(): void }) {
  const opts = useRef(o);
  useLayoutEffect(() => {
    opts.current = o;
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sign = () => (opts.current.side === "left" ? 1 : -1);
    let x0 = 0,
      y0 = 0,
      on = false,
      dead = true,
      dx = 0,
      hist: { t: number; x: number }[] = [];
    const back = (close: boolean) => {
      el.style.setProperty("transition", `transform ${SNAP}ms cubic-bezier(.2,.8,.3,1), opacity ${SNAP}ms ease-out`, "important");
      el.style.transform = close ? `translateX(${-sign() * 60}px)` : "translateX(0px)";
      el.style.opacity = close ? "0" : "1";
      if (close) opts.current.onClose();
      // left exactly where React's own style for it puts it (open or tucked
      // away), so the two never disagree; clearing them would wipe React's
      setTimeout(() => el.style.removeProperty("transition"), SNAP + 20);
    };
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      dead = e.touches.length > 1 || !!(e.target as Element).closest?.("input, textarea, select, [contenteditable]");
      on = false;
      dx = 0;
      x0 = t.clientX;
      y0 = t.clientY;
      hist = [{ t: e.timeStamp, x: t.clientX }];
    };
    const move = (e: TouchEvent) => {
      if (dead) return;
      const t = e.touches[0];
      const mx = t.clientX - x0,
        my = t.clientY - y0;
      if (!on) {
        if (Math.abs(my) > LOCK && Math.abs(my) > Math.abs(mx)) return void (dead = true);
        if (Math.abs(mx) < LOCK) return;
        if (sign() * mx > 0) return void (dead = true); // only toward its own edge
        on = true;
      }
      e.preventDefault();
      hist.push({ t: e.timeStamp, x: t.clientX });
      while (hist.length > 2 && e.timeStamp - hist[0].t > 90) hist.shift();
      dx = Math.min(0, sign() * mx); // how far in, as a negative number
      el.style.transition = "none";
      el.style.transform = `translateX(${sign() * dx}px)`;
      el.style.opacity = String(Math.max(0.2, 1 + dx / (el.offsetWidth + 46)));
    };
    const end = (e: TouchEvent) => {
      if (dead || !on) return;
      dead = true;
      if (e.type === "touchcancel") return back(false);
      const a = hist[0],
        b = hist[hist.length - 1];
      const v = a && b && b.t > a.t ? (sign() * (b.x - a.x)) / (b.t - a.t) : 0;
      back(v < -FLICK || -dx > (el.offsetWidth + 46) / 3);
    };
    // capture: a list inside may keep its touches to itself
    el.addEventListener("touchstart", start, { passive: true, capture: true });
    el.addEventListener("touchmove", move, { passive: false, capture: true });
    el.addEventListener("touchend", end, true);
    el.addEventListener("touchcancel", end, true);
    return () => {
      el.removeEventListener("touchstart", start, true);
      el.removeEventListener("touchmove", move, true);
      el.removeEventListener("touchend", end, true);
      el.removeEventListener("touchcancel", end, true);
    };
  }, []);
  return ref;
}

// A panel div that can be pushed back in (useSwipeAway).
export function PanelSwipe({
  side,
  onClose,
  ...rest
}: { side: "left" | "right"; onClose(): void } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useSwipeAway({ side, onClose });
  return <div ref={ref} {...rest} />;
}
