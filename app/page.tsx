"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

/* ── Primitives ─────────────────────────────────────── */
function Logo({ size = 22 }: { size?: number }) {
  return <Image src="/logo.svg" alt="Zelo" width={size} height={size} priority />;
}

function Icon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function Reveal({ children, delay = "0s", className = "" }: {
  children: ReactNode; delay?: string; className?: string;
}) {
  return (
    <div data-reveal style={{ transitionDelay: delay }} className={className}>
      {children}
    </div>
  );
}

/* ── Chat bubble ─────────────────────────────────────── */
function Bubble({ text, mine, delay }: { text: string; mine?: boolean; delay: string }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}
      style={{ animation: `bubble-in .35s ease-out ${delay} both` }}>
      <div className={`px-3 py-2 rounded-xl text-[10.5px] leading-relaxed max-w-[80%] ${
        mine ? "glass text-white/85" : "bg-white/10 text-white/75 border border-white/[.07]"
      }`}>
        {text}
      </div>
    </div>
  );
}

/* ── Feature card ────────────────────────────────────── */
function Feature({ icon, title, desc, delay }: {
  icon: string; title: string; desc: string; delay: string;
}) {
  return (
    <Reveal delay={delay}>
      <div className="glass-card p-5 h-full">
        <div className="w-8 h-8 rounded-lg glass flex items-center justify-center mb-4 text-white/50">
          <Icon path={icon} size={15} />
        </div>
        <p className="text-white/85 font-medium text-[14px] mb-1.5 tracking-tight">{title}</p>
        <p className="text-muted text-[13px] leading-relaxed">{desc}</p>
      </div>
    </Reveal>
  );
}

/* ── Step ────────────────────────────────────────────── */
function Step({ n, title, desc, delay }: { n: number; title: string; desc: string; delay: string }) {
  return (
    <Reveal delay={delay} className="flex gap-4">
      <div className="w-7 h-7 rounded-lg glass flex items-center justify-center text-white/60 text-[12px] font-semibold shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <p className="text-white/85 font-medium text-[14px] mb-1">{title}</p>
        <p className="text-muted text-[13px] leading-relaxed">{desc}</p>
      </div>
    </Reveal>
  );
}

/* ── Main ────────────────────────────────────────────── */
export default function Home() {
  const [scrolled, setScrolled]     = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("revealed"); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const NAV_LINKS = [
    { label: "Features",    href: "#features" },
    { label: "How it works",href: "#how-it-works" },
    { label: "Privacy",     href: "/privacy" },
  ];

  const FEATURES = [
    { icon: "M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", title: "Conversation Memory", desc: "Remembers every customer preference and past order across unlimited sessions." },
    { icon: "M13 2 3 14h9l-1 8 10-12h-9l1-8z", title: "Instant Replies", desc: "Responds to every DM in under 2 seconds, day or night, automatically." },
    { icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", title: "Built to Close", desc: "Handles objections, answers questions, and guides buyers to checkout." },
    { icon: "M6.62 10.79a15.15 15.15 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 4.07.73 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z", title: "Native Instagram DMs", desc: "Works inside Instagram Messenger — no external links, zero friction." },
    { icon: "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4", title: "Secure by Default", desc: "All conversations encrypted in Firebase. Your data never trains other models." },
    { icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z", title: "Multilingual", desc: "Replies in Albanian, English, Italian — adapts to each customer automatically." },
  ];

  return (
    <div className="min-h-screen bg-[#08081a] text-white overflow-x-hidden">

      {/* Ambient orbs */}
      <div className="bg-scene">
        <div className="bg-orb w-[520px] h-[520px] -top-32 -left-32 blur-[130px] opacity-40"
          style={{ background: "radial-gradient(circle, #4f3b8b, transparent 70%)", animation: "orb-drift 14s ease-in-out infinite" }} />
        <div className="bg-orb w-[400px] h-[400px] top-1/3 -right-24 blur-[120px] opacity-30"
          style={{ background: "radial-gradient(circle, #2d3a8c, transparent 70%)", animation: "orb-drift 18s ease-in-out infinite reverse" }} />
        <div className="bg-orb w-[360px] h-[360px] bottom-0 left-1/3 blur-[110px] opacity-25"
          style={{ background: "radial-gradient(circle, #3b2d8b, transparent 70%)", animation: "orb-drift 12s ease-in-out 4s infinite" }} />
      </div>

      {/* ══ NAVBAR ══ */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass-deep" : "bg-transparent"
      } border-b border-white/[.06]`}
        style={{ animation: "fade-up .4s ease-out both" }}>
        <div className="max-w-5xl mx-auto px-5 h-12 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Logo size={20} />
            <span className="font-semibold text-[14px] tracking-tight">Zelo</span>
          </Link>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ label, href }) => (
              href.startsWith("#")
                ? <a key={label} href={href} className="text-muted text-[13px] hover:text-white transition-colors">{label}</a>
                : <Link key={label} href={href} className="text-muted text-[13px] hover:text-white transition-colors">{label}</Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {user
              ? <Link href="/dashboard" className="btn btn-primary text-[13px]">Dashboard →</Link>
              : <>
                  <Link href="/login" className="btn btn-secondary text-[13px]">Sign in</Link>
                  <Link href="/login" className="btn btn-primary text-[13px]">Get started</Link>
                </>
            }
          </div>

          {/* Hamburger */}
          <button className="md:hidden text-white/50 hover:text-white transition-colors"
            onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            <Icon path={menuOpen ? "M18 6 6 18M6 6l12 12" : "M3 12h18M3 6h18M3 18h18"} size={20} />
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="md:hidden glass-deep border-t border-white/[.06] px-5 py-4 flex flex-col gap-2"
            style={{ animation: "fade-up .2s ease-out both" }}>
            {NAV_LINKS.map(({ label, href }) => (
              href.startsWith("#")
                ? <a key={label} href={href} onClick={() => setMenuOpen(false)}
                    className="text-white/60 hover:text-white text-[14px] py-1.5 transition-colors">{label}</a>
                : <Link key={label} href={href} onClick={() => setMenuOpen(false)}
                    className="text-white/60 hover:text-white text-[14px] py-1.5 transition-colors">{label}</Link>
            ))}
            <div className="hr my-2" />
            {user
              ? <Link href="/dashboard" className="btn btn-primary w-full justify-center">Dashboard →</Link>
              : <>
                  <Link href="/login" onClick={() => setMenuOpen(false)} className="btn btn-secondary w-full justify-center">Sign in</Link>
                  <Link href="/login" onClick={() => setMenuOpen(false)} className="btn btn-primary w-full justify-center">Get started free</Link>
                </>
            }
          </div>
        )}
      </header>

      {/* ══ HERO ══ */}
      <section className="relative pt-12 overflow-hidden">
        <div className="relative z-10 max-w-5xl mx-auto px-5 pt-14 pb-12 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 glass rounded-full px-3.5 py-1.5 text-[11.5px] text-white/55 mb-4 font-medium"
                style={{ animation: "fade-up .5s ease-out both" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" style={{ animation: "pulse 2s ease-in-out infinite" }} />
                AI Sales · Instagram DMs · 24/7
              </div>

              <h1 className="text-[36px] sm:text-[44px] lg:text-[50px] font-bold leading-[1.08] tracking-[-0.03em] mb-4"
                style={{ animation: "fade-up .55s ease-out .07s both" }}>
                Reply faster.<br />
                <span className="text-accent">Sell more.</span><br />
                Sleep better.
              </h1>

              <p className="text-muted text-[14.5px] leading-[1.7] mb-7 max-w-[400px]"
                style={{ animation: "fade-up .55s ease-out .14s both" }}>
                Zelo plugs into your Instagram DMs and handles every sales conversation
                with AI — instantly, in your brand's voice, around the clock.
              </p>

              <div className="flex flex-wrap gap-3 mb-7"
                style={{ animation: "fade-up .55s ease-out .21s both" }}>
                <Link href="/login" className="btn btn-primary">Connect Instagram free →</Link>
                <a href="#how-it-works" className="btn btn-secondary">See how it works</a>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2"
                style={{ animation: "fade-up .55s ease-out .28s both" }}>
                {["End-to-end encrypted", "No credit card", "Live in 30 s"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-faint text-[12.5px]">
                    <Icon path="M20 6 9 17l-5-5" size={11} /> {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Phone mockup */}
            <div className="flex justify-center lg:justify-end">
              <div className="animate-float">
                <div className="relative w-[220px] sm:w-[238px] rounded-[2rem] glass border border-white/10 overflow-hidden"
                    style={{ boxShadow: "0 32px 64px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08)" }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 glass rounded-b-xl z-10" />
                    <div className="pt-6 pb-3 px-3 min-h-[400px] flex flex-col">
                      {/* DM header */}
                      <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-white/[.06]">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 shrink-0" />
                        <div>
                          <p className="text-[10.5px] font-semibold">lulushop.al</p>
                          <p className="text-faint text-[8.5px]">Active now</p>
                        </div>
                      </div>
                      {/* Bubbles */}
                      <div className="flex flex-col gap-2 flex-1">
                        <Bubble text="Sa kushton çanta e zezë?" mine   delay=".5s" />
                        <Bubble text="Çanta e zezë — 3,500 L. Kemi edhe kafe dhe bezhë. E rezervojmë?" delay="1s" />
                        <Bubble text="Po! Si bëhet porosia?" mine   delay="1.7s" />
                        <Bubble text="Perfekt! Dërgoni adresën dhe e nisim brenda 24 orësh 🚚" delay="2.3s" />
                        {/* Typing */}
                        <div className="flex items-end gap-1.5" style={{ animation: "bubble-in .35s ease-out 3s both" }}>
                          <div className="glass rounded-xl rounded-bl-sm px-3 py-2.5 flex gap-1 items-center">
                            {[0,.2,.4].map((d, i) => (
                              <span key={i} className="w-1 h-1 rounded-full bg-white/35 block"
                                style={{ animation: `dot-pulse 1.2s ease-in-out ${d}s infinite` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Input bar */}
                      <div className="mt-3 flex items-center gap-1.5">
                        <div className="flex-1 glass rounded-full px-3 py-1.5 text-[9px] text-white/20">Message…</div>
                        <div className="w-5 h-5 glass rounded-full flex items-center justify-center text-white/40 text-[9px] shrink-0">↑</div>
                      </div>
                    </div>
                  </div>
                {/* Glow under phone */}
                <div className="mx-6 h-4 mt-1 rounded-full blur-xl opacity-25"
                  style={{ background: "linear-gradient(90deg,#6d28d9,#4f46e5)" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ NUMBERS ══ */}
      <section className="relative z-10 border-y border-white/[.06]">
        <div className="max-w-5xl mx-auto px-5 py-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { n: "24/7", label: "Always online" },
            { n: "< 2s", label: "Average reply" },
            { n: "100%", label: "DMs answered" },
            { n: "60 d", label: "Token lifespan" },
          ].map(({ n, label }, i) => (
            <Reveal key={label} delay={`${i * .07}s`}>
              <p className="text-[24px] font-bold tracking-tight mb-1">{n}</p>
              <p className="text-muted text-[12.5px]">{label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" className="relative z-10 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-5">
          <Reveal className="mb-12">
            <p className="text-faint text-[11px] font-semibold tracking-[.14em] uppercase mb-3">Capabilities</p>
            <h2 className="text-[30px] sm:text-[36px] font-bold tracking-tight mb-3 max-w-lg leading-tight">
              Everything you need to automate your DM sales
            </h2>
            <p className="text-muted text-[14px] max-w-md leading-relaxed">
              Built specifically for Instagram businesses — boutiques, service providers, resellers.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map(({ icon, title, desc }, i) => (
              <Feature key={title} icon={icon} title={title} desc={desc} delay={`${i * .06}s`} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how-it-works" className="relative z-10 py-20 sm:py-24 border-t border-white/[.06]">
        <div className="max-w-5xl mx-auto px-5 grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">

          {/* Visual */}
          <Reveal className="flex justify-center order-2 lg:order-1">
            <div className="glass-card p-8 w-[220px] flex flex-col items-center gap-5">
              <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center">
                <Logo size={32} />
              </div>
              <div className="w-full flex flex-col gap-2">
                {[["Reply rate", "100%", "bg-emerald-400"], ["Avg. response", "1.8 s", "bg-blue-400"], ["Conversations", "24/7", "bg-violet-400"]].map(([label, val, color]) => (
                  <div key={label} className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-white/40">
                      <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
                      {label}
                    </span>
                    <span className="text-white/70 font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="order-1 lg:order-2">
            <Reveal>
              <p className="text-faint text-[11px] font-semibold tracking-[.14em] uppercase mb-3">Setup</p>
              <h2 className="text-[30px] sm:text-[36px] font-bold tracking-tight mb-9 leading-tight">
                Live in 3 steps,<br />no code required
              </h2>
            </Reveal>
            <div className="flex flex-col gap-6">
              <Step n={1} title="Connect Instagram" desc="Authorize Zelo via Meta Business Login. Takes under 30 seconds." delay="0s" />
              <div className="ml-3.5 w-px h-4 bg-white/[.08]" />
              <Step n={2} title="Configure your assistant" desc="Tell Zelo your products, prices, and tone. It adapts instantly." delay=".08s" />
              <div className="ml-3.5 w-px h-4 bg-white/[.08]" />
              <Step n={3} title="Sales on autopilot" desc="Zelo handles every DM. You're notified only when action is needed." delay=".16s" />
            </div>
            <Reveal delay=".24s" className="mt-8">
              <Link href="/login" className="btn btn-primary inline-flex">Get started free →</Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section className="relative z-10 py-20 border-t border-white/[.06]">
        <div className="max-w-5xl mx-auto px-5">
          <Reveal className="text-center mb-10">
            <p className="text-faint text-[11px] font-semibold tracking-[.14em] uppercase mb-3">Testimonials</p>
            <h2 className="text-[28px] sm:text-[32px] font-bold tracking-tight">Businesses already closing more</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { q: "Shitjet u dyfishuan brenda dy javësh. Nuk humbas asnjë DM tani.", name: "Arta M.", role: "Boutique owner, Tiranë" },
              { q: "Klientët mendojnë se jam unë. Zelo di saktësisht si të flasë.", name: "Erjon B.", role: "Artisan seller, Shkodër" },
              { q: "U zgjova me 6 porosi të reja. Kjo është fuqia e Zeros.", name: "Mirela K.", role: "Fashion reseller, Durrës" },
            ].map(({ q, name, role }, i) => (
              <Reveal key={name} delay={`${i * .08}s`}>
                <div className="glass-card p-5 flex flex-col justify-between gap-4 h-full">
                  <p className="text-white/55 text-[13.5px] leading-relaxed">"{q}"</p>
                  <div>
                    <p className="text-white/80 text-[13px] font-medium">{name}</p>
                    <p className="text-faint text-[12px]">{role}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="relative z-10 py-20 border-t border-white/[.06]">
        <div className="max-w-5xl mx-auto px-5">
          <Reveal>
            <div className="glass-card p-8 sm:p-12 text-center max-w-xl mx-auto">
              <p className="text-faint text-[11px] font-semibold tracking-[.14em] uppercase mb-4">Ready?</p>
              <h2 className="text-[28px] sm:text-[34px] font-bold tracking-tight mb-4 leading-tight">
                Your next sale is one DM away.
              </h2>
              <p className="text-muted text-[14px] leading-relaxed mb-7 max-w-sm mx-auto">
                Connect Instagram in 30 seconds. No credit card, no setup fees.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/login" className="btn btn-primary w-full sm:w-auto justify-center">
                  Connect Instagram free →
                </Link>
                <span className="text-faint text-[12.5px]">Free to start · Cancel anytime</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="relative z-10 border-t border-white/[.06]">
        <div className="max-w-5xl mx-auto px-5 py-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span className="font-semibold text-[13px]">Zelo</span>
            <span className="text-faint text-[12px] ml-1 hidden sm:inline">— AI Sales for Instagram</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-5 text-[12.5px] text-faint">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/privacy"   className="hover:text-white transition-colors">Privacy</Link>
            <a href="#features"     className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          </nav>
          <p className="text-faint text-[12px]">© {new Date().getFullYear()} Zelo</p>
        </div>
      </footer>
    </div>
  );
}
