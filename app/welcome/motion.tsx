"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Lenis from "lenis";
import { useEffect, useRef } from "react";

/* Scroll motion for the landing page: Lenis for smooth scrolling, GSAP ScrollTrigger for the
 * scenes. Every scene is set up inside gsap.matchMedia("(prefers-reduced-motion: no-preference)"),
 * so with reduced motion nothing moves and every element sits in its final place. */

gsap.registerPlugin(ScrollTrigger);
const MOTION = "(prefers-reduced-motion: no-preference)";

/** Smooth scrolling for the whole page while it is open, driven by GSAP's ticker so the two
 * never disagree about where the page is. In-page links (#how) glide too. */
export function SmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia(MOTION).matches) return;
    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -88 } });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);
  return null;
}

/* ---------------------------------------------------------------- hero */
/** The hero's screens. They start lying back like papers on a desk; scrolling stands the
 * front one up and fans the two behind it out to the sides, while the headline steps aside.
 * On wide screens the hero holds still (pinned) for the length of that move. */
export function HeroStage() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    const hero = el?.closest("section");
    if (!el || !hero) return;
    const q = gsap.utils.selector(el);
    const copy = hero.querySelector("[data-hero-copy]");
    const mm = gsap.matchMedia();

    mm.add({ wide: `${MOTION} and (min-width: 768px)`, narrow: `${MOTION} and (max-width: 767px)` }, (ctx) => {
      const wide = ctx.conditions?.wide;
      const front = q("[data-sheet=front]");
      const back = q("[data-sheet=back]");

      // lying down: the state the page opens in
      gsap.set(el, { perspective: 1600 });
      gsap.set(front, { rotateX: 58, yPercent: 6, scale: 0.86, transformOrigin: "50% 100%" });
      gsap.set(back, { rotateX: 58, yPercent: 6, scale: 0.8, opacity: 0, transformOrigin: "50% 100%" });

      // how far the screens rise so the upright front one sits in the middle of the window
      const lift = () => {
        const top = el.offsetTop - (hero as HTMLElement).offsetTop;
        return Math.min(0, Math.max(84, (window.innerHeight - el.offsetHeight) / 2) - top);
      };

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: wide
          ? { trigger: hero, start: "top top", end: "+=110%", scrub: 0.8, pin: true, anticipatePin: 1, invalidateOnRefresh: true }
          : { trigger: el, start: "top 85%", end: "top 25%", scrub: 0.8 },
      });
      tl.to(front, { rotateX: 0, yPercent: 0, scale: 1, duration: 1 }, 0)
        .to(back, { rotateX: 0, yPercent: 0, opacity: 1, duration: 0.8 }, 0.15)
        .to(back, { xPercent: (i) => (i ? 19 : -19), rotateY: (i) => (i ? -10 : 10), scale: 0.84, duration: 0.7 }, 0.45);
      if (wide) {
        // The screens end higher than where the page laid them out: take that height back from
        // the hero, or an empty band would follow it once the pin lets go.
        const fit = () => { gsap.set(el, { marginBottom: 0 }); gsap.set(el, { marginBottom: lift() }); };
        fit();
        ScrollTrigger.addEventListener("refreshInit", fit);
        tl.to(el, { y: lift, duration: 1 }, 0);
        if (copy) tl.to(copy, { y: -90, opacity: 0, duration: 0.6 }, 0.05);
        return () => ScrollTrigger.removeEventListener("refreshInit", fit);
      }
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={stage} className="relative isolate mx-auto mt-14 max-w-[1080px] md:mt-16">
      <Sheet side="back" src="/landing/tasks.webp" alt="The Tasks board: every deadline from the files, with its date" />
      <Sheet side="back" src="/landing/chat.webp" alt="The Assistant: agents reading files, every tool call shown" />
      <Sheet side="front" src="/landing/page.webp" priority
        alt="A LEARIS page: a research paper on database normalisation, each claim numbered, sources quoted on the right" />
    </div>
  );
}

function Sheet({ side, src, alt, priority }: { side: "front" | "back"; src: string; alt: string; priority?: boolean }) {
  return (
    <div data-sheet={side}
      className={`overflow-hidden rounded-[6px] border border-[var(--lw-line)] bg-white shadow-[0_40px_80px_-30px_rgba(20,30,25,0.45)] will-change-transform ${side === "front" ? "relative z-[2]" : "absolute inset-0 z-[1] hidden md:block"}`}>
      <Image src={src} alt={alt} width={2880} height={1800} priority={priority} sizes="(min-width: 1080px) 1080px, 100vw" className="h-auto w-full" />
    </div>
  );
}

/* ------------------------------------------------------- smaller scenes */
/** Section headlines rise into place word by word as they arrive. */
export function Words({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      gsap.from(el.querySelectorAll("[data-w]"), {
        yPercent: 110, duration: 1, ease: "expo.out", stagger: 0.045,
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
    });
    return () => mm.revert();
  }, []);
  return (
    <span ref={ref} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-top">
          <span data-w className="inline-block">{w}&nbsp;</span>
        </span>
      ))}
    </span>
  );
}

/** A number that counts up from zero the first time it is seen. The server renders the real
 * value, so without JavaScript (or with reduced motion) it simply shows it. */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      const n = { v: 0 };
      el.textContent = "0";
      gsap.to(n, {
        v: value, duration: 1.6, ease: "power3.out",
        onUpdate: () => { el.textContent = String(Math.round(n.v)); },
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      return () => { el.textContent = String(value); };
    });
    return () => mm.revert();
  }, [value]);
  return <span ref={ref}>{value}</span>;
}

/** Scroll-linked drift for decorative layers: the stripe's barcode slides sideways, the green
 * cloth's weave shifts, the footer wordmark rises out of the floor. */
export function Drift() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      document.querySelectorAll<HTMLElement>("[data-drift=stripe]").forEach((el) =>
        gsap.fromTo(el, { backgroundPosition: "0px 0px" }, {
          backgroundPosition: "-420px 0px", ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        }));
      document.querySelectorAll<HTMLElement>("[data-drift=cloth]").forEach((el) =>
        gsap.fromTo(el, { backgroundPosition: "0px 0px" }, {
          backgroundPosition: "0px -160px", ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        }));
      document.querySelectorAll<HTMLElement>("[data-drift=rise]").forEach((el) =>
        gsap.from(el, {
          yPercent: 35, opacity: 0, ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom bottom", scrub: true },
        }));
      document.querySelectorAll<HTMLElement>("[data-drift=float]").forEach((el, i) =>
        gsap.fromTo(el, { y: 50 + i * 20 }, {
          y: -30, ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        }));
    });
    // images and fonts change heights after load: measure again
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    return () => { window.removeEventListener("load", refresh); mm.revert(); };
  }, []);
  return null;
}
