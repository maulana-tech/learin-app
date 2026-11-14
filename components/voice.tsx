"use client";

import { Mic, Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

/* Voice: speak a request instead of typing it, and hear an answer read aloud. Both use the
 * browser's own speech engines (Web Speech API): nothing extra is sent anywhere by LEARIS. */

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start: () => void; stop: () => void;
};
type RecognitionCtor = new () => Recognition;

const noop = () => () => {};
function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const useCanListen = () => useSyncExternalStore(noop, () => !!recognitionCtor(), () => false);
const useCanSpeak = () => useSyncExternalStore(noop, () => "speechSynthesis" in window, () => false);

/** Indonesian when the page or browser is, else English. */
function speechLang(text?: string): string {
  if (text && /\b(yang|dan|untuk|dengan|tidak|adalah|ini|itu)\b/i.test(text)) return "id-ID";
  if (text && /\b(the|and|with|is|are|this)\b/i.test(text)) return "en-US";
  return (navigator.language || "id-ID").toLowerCase().startsWith("id") ? "id-ID" : (navigator.language || "en-US");
}

/** The microphone button: words appear in the text box as they are spoken. */
export function VoiceButton({ onText, disabled, small }: {
  /** Called with the spoken text so far (final + interim), to place after what was typed before. */
  onText: (spoken: string, done: boolean) => void; disabled?: boolean; small?: boolean;
}) {
  const can = useCanListen();
  const [on, setOn] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);

  useEffect(() => () => rec.current?.stop(), []);
  if (!can) return null;

  function toggle() {
    if (on) { rec.current?.stop(); return; }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = speechLang();
    r.interimResults = true;
    r.continuous = true;
    let final = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      onText((final + interim).trim(), false);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone blocked: allow it in the browser" : e.error);
    r.onend = () => { setOn(false); onText(final.trim(), true); };
    rec.current = r;
    setError("");
    try { r.start(); setOn(true); } catch { setOn(false); }
  }

  return (
    <button type="button" onClick={toggle} disabled={disabled} aria-pressed={on}
      aria-label={on ? "Stop dictation" : "Speak your request"} title={error || (on ? "Listening… click to stop" : "Speak (Bahasa Indonesia or English)")}
      className={cn("flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
        small ? "size-6" : "size-7",
        on ? "bg-[#111] text-white" : error ? "text-bad hover:bg-hover" : "text-muted-foreground hover:text-fg hover:bg-hover")}>
      {on ? <span className="relative flex"><span className="absolute inset-0 animate-ping rounded-full bg-white/40" /><Square className={small ? "size-3" : "size-3.5"} /></span>
        : <Mic className={small ? "size-3.5" : "size-4"} />}
    </button>
  );
}

/** Read an answer aloud, in its own language; press again to stop. Markdown marks are not read. */
export function SpeakButton({ text, className }: { text: string; className?: string }) {
  const can = useCanSpeak();
  const [on, setOn] = useState(false);
  useEffect(() => () => { if (on) window.speechSynthesis.cancel(); }, [on]);
  if (!can || !text.trim()) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (on) { synth.cancel(); setOn(false); return; }
    const plain = text.replace(/```[\s\S]*?```/g, " ").replace(/\[(\d+)\]/g, "").replace(/[#*_>`|]/g, "").replace(/\s+/g, " ").trim();
    const u = new SpeechSynthesisUtterance(plain.slice(0, 4000));
    u.lang = speechLang(plain);
    const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase()));
    if (voice) u.voice = voice;
    u.onend = () => setOn(false);
    u.onerror = () => setOn(false);
    synth.cancel();
    synth.speak(u);
    setOn(true);
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? "Stop reading" : "Read aloud"}
      className={cn("text-muted-foreground hover:text-fg inline-flex items-center gap-1 text-[11.5px]", className)}>
      {on ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}{on ? "Stop" : "Read aloud"}
    </button>
  );
}
