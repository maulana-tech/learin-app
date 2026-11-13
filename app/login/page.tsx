"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Dot } from "@/components/dort";
import { Field } from "@/components/field";
import { LearisMark } from "@/components/learis-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* Sign in, or create an account: a friend invited to a group needs one. The
 * session lives in an httpOnly cookie set by /api/login or /api/signup. An
 * invite link that sent someone here comes back through `next`. */
export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(mode === "in" ? "/api/login" : "/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "in" ? { email, password } : { email, password, name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "could not sign in");
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not sign in");
    } finally {
      setBusy(false);
    }
  }

  const up = mode === "up";
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex items-center gap-2.5 text-white">
        <LearisMark className="size-8" />
        <span className="text-[26px] tracking-[-0.02em]">learis</span>
      </div>
      <form onSubmit={submit} className="bg-card-grad shadow-float w-full max-w-[420px] space-y-5 rounded-xl border border-white/40 p-6 md:p-8">
        <div>
          <h1 className="text-[22px]">{up ? "Create your account" : "Sign in"}</h1>
          <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
            {up ? "A personal workspace is ready the moment you sign up. Invite friends into a group later."
              : "Ask once; your agents read your files, write sourced pages and plan the work."}
          </p>
        </div>
        {up && <Field label="Your name"><Input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} required /></Field>}
        <Field label="Email"><Input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password" hint={up ? "At least 8 characters." : undefined}>
          <Input type="password" value={password} minLength={up ? 8 : undefined}
            autoComplete={up ? "new-password" : "current-password"} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? (up ? "Creating…" : "Signing in…") : up ? "Create account" : "Sign in"}
        </Button>
        <p className="text-muted-foreground text-center text-[12.5px]">
          {up ? "Already have an account? " : "New here? "}
          <button type="button" className="text-brand underline-offset-4 hover:underline" onClick={() => { setMode(up ? "in" : "up"); setError(""); }}>
            {up ? "Sign in" : "Create an account"}
          </button>
        </p>
      </form>
      <p className="text-on-canvas-dim max-w-sm text-center text-[12.5px]">
        An agentic workspace for students and teams · bring your own AI · every claim cites its source.
      </p>
    </main>
  );
}
