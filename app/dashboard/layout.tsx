"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

function Logo({ size = 18 }: { size?: number }) {
  return <Image src="/logo.svg" alt="Zelo" width={size} height={size} />;
}

function Icon({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function UserAvatar({ photoURL, displayName }: { photoURL: string | null; displayName: string | null }) {
  if (photoURL) {
    return (
      <Image src={photoURL} alt={displayName ?? "User"} width={24} height={24}
        className="rounded-full shrink-0" referrerPolicy="no-referrer" />
    );
  }
  return (
    <div className="w-6 h-6 rounded-full glass flex items-center justify-center text-white/40 shrink-0">
      <Icon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" size={11} />
    </div>
  );
}

const NAV = [
  { label: "Overview",       href: "/dashboard",               icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11l2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" },
  { label: "Conversations",  href: "/dashboard/conversations",  icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { label: "Orders",         href: "/dashboard/orders",         icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
  { label: "Accounts",       href: "/dashboard/accounts",       icon: "M16 2H8C4.7 2 2 4.7 2 8v8c0 3.3 2.7 6 6 6h8c3.3 0 6-2.7 6-6V8c0-3.3-2.7-6-6-6zm-4 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm5.5-9a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" },
];

function Sidebar({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={17} />
          <span className="text-white font-semibold text-[13.5px] tracking-tight">Zelo</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        <p className="px-3 text-[9.5px] font-semibold text-white/20 uppercase tracking-[0.12em] mb-2">
          Workspace
        </p>
        {NAV.map(({ label, href, icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[12.5px] transition-all ${
                active
                  ? "glass text-white font-medium"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}>
              <span className={active ? "text-white/60" : "text-white/25"}>
                <Icon path={icon} size={13} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 pb-4 pt-3 border-t border-white/[0.06]">
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <UserAvatar photoURL={user.photoURL} displayName={user.displayName} />
            <div className="min-w-0 flex-1">
              <p className="text-white/80 text-[11.5px] font-medium truncate leading-none mb-0.5">
                {user.displayName ?? "Account"}
              </p>
              <p className="text-white/30 text-[10.5px] truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.04] text-[12px] transition-colors">
          <Icon path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" size={12} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const label = NAV.find((n) => n.href === pathname)?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[#060612] text-white flex relative overflow-hidden">

      {/* Ambient */}
      <div className="bg-scene pointer-events-none">
        <div className="bg-orb w-[500px] h-[500px] -top-32 -left-32 blur-[140px] opacity-25"
          style={{ background: "radial-gradient(circle, #4f2d87, transparent 70%)" }} />
        <div className="bg-orb w-[350px] h-[350px] bottom-0 right-0 blur-[120px] opacity-15"
          style={{ background: "radial-gradient(circle, #2d3a8c, transparent 70%)" }} />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[200px] shrink-0 fixed top-0 left-0 h-full z-30 glass-deep border-r border-white/[0.06]">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-[220px] h-full z-10 glass-deep border-r border-white/[0.06]"
            style={{ animation: "fade-up 0.2s ease-out both" }}>
            <Sidebar onNavClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col md:ml-[200px] relative z-10 min-h-screen">

        {/* Topbar */}
        <header className="h-12 glass-deep border-b border-white/[0.06] flex items-center px-5 gap-3 shrink-0 sticky top-0 z-40">
          <button className="md:hidden text-white/40 hover:text-white/70 transition-colors"
            onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Icon path="M3 12h18M3 6h18M3 18h18" size={18} />
          </button>
          <p className="text-white/60 text-[13px] font-medium">{label}</p>
        </header>

        <main className="flex-1 px-5 md:px-7 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
