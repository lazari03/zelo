"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

function Logo({ size = 20 }: { size?: number }) {
  return <Image src="/logo.svg" alt="Zelo" width={size} height={size} priority />;
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

const ERROR_MAP: Record<string, string> = {
  "auth/user-not-found":       "No account with that email.",
  "auth/wrong-password":       "Incorrect password.",
  "auth/email-already-in-use": "An account already exists with that email.",
  "auth/weak-password":        "Password must be at least 6 characters.",
  "auth/invalid-email":        "Please enter a valid email address.",
  "auth/invalid-credential":   "Incorrect email or password.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
};

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode]         = useState<"signin" | "signup">("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (mode === "signin") await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(ERROR_MAP[code] ?? "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  async function handleGoogle() {
    setError(""); setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(ERROR_MAP[code] ?? "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#060612] flex items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Ambient */}
      <div className="bg-scene">
        <div className="bg-orb w-[500px] h-[500px] -top-20 -left-20 blur-[140px] opacity-35"
          style={{ background: "radial-gradient(circle, #4f2d87, transparent 70%)" }} />
        <div className="bg-orb w-[400px] h-[400px] -bottom-20 -right-10 blur-[130px] opacity-25"
          style={{ background: "radial-gradient(circle, #2d3a8c, transparent 70%)" }} />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[360px]" style={{ animation: "fade-up 0.4s ease-out both" }}>
        <div className="glass rounded-2xl p-7"
          style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)" }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="flex items-center gap-2">
              <Logo size={18} />
              <span className="text-white font-semibold text-[13.5px] tracking-tight">Zelo</span>
            </Link>
            <Link href="/" className="text-white/30 text-[12px] hover:text-white/60 transition-colors">← Back</Link>
          </div>

          <h1 className="text-white text-[19px] font-semibold tracking-tight mb-1">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-white/40 text-[13px] mb-5">
            {mode === "signin" ? "Sign in to your Zelo workspace." : "Start automating your Instagram sales."}
          </p>

          {/* Google */}
          <button onClick={handleGoogle} disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl glass text-white/65 text-[13px] font-medium hover:bg-white/[0.07] transition-colors mb-4 disabled:opacity-40">
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-white/25 text-[11px]">or</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-white/35 text-[11px] font-medium mb-1.5 tracking-wider uppercase">
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="email"
                className="input" />
            </div>
            <div>
              <label className="block text-white/35 text-[11px] font-medium mb-1.5 tracking-wider uppercase">
                Password
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="input" />
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06]">
                <p className="text-red-300/80 text-[12.5px]">{error}</p>
              </div>
            )}

            <button type="submit" disabled={busy}
              className="mt-1 btn btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-white/30 text-[12.5px] text-center mt-5">
            {mode === "signin" ? "No account?" : "Have an account?"}{" "}
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
              className="text-white/60 hover:text-white transition-colors font-medium">
              {mode === "signin" ? "Sign up free" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-5 text-center text-white/20 text-[12px] leading-relaxed italic px-2">
          "U zgjova me 6 porosi të reja. Kjo është fuqia e Zeros."
          <span className="not-italic block text-white/15 mt-1">Mirela K. — Fashion reseller, Durrës</span>
        </p>
      </div>
    </div>
  );
}
