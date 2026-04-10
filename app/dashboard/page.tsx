"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, limit,
  getDocs, getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Conversation, DailyStats, InstagramAccount } from "@/lib/types";
import { doc, updateDoc } from "firebase/firestore";

function Icon({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string; icon: string; color: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-white/40 text-[12px] font-medium">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon path={icon} size={13} />
        </div>
      </div>
      <p className="text-white text-[26px] font-bold tracking-tight leading-none mb-1">{value}</p>
      {sub && <p className="text-white/35 text-[11.5px]">{sub}</p>}
    </div>
  );
}

// ── Bar chart (last 7 days) ───────────────────────────────────────────────────

function BarChart({ data }: { data: DailyStats[] }) {
  const max = Math.max(...data.map((d) => d.messages), 1);

  const fmt = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" });

  return (
    <div className="flex items-end gap-1.5 h-20 w-full">
      {data.map((d) => {
        const pct = (d.messages / max) * 100;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group relative">
            {/* Tooltip */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 glass rounded px-2 py-0.5
                            text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {d.messages}
            </div>
            <div className="w-full rounded-sm transition-all duration-300"
              style={{
                height:     `${Math.max(pct, 4)}%`,
                background: pct > 0
                  ? "linear-gradient(to top, rgba(109,40,217,0.6), rgba(139,92,246,0.4))"
                  : "rgba(255,255,255,0.05)",
              }} />
            <span className="text-[9.5px] text-white/25">{fmt(d.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Recent conversation row ───────────────────────────────────────────────────

function ConvRow({ conv }: { conv: Conversation & { id: string } }) {
  const masked = conv.senderId.slice(0, 6) + "…" + conv.senderId.slice(-4);
  const ago    = (() => {
    const diff = Date.now() - conv.updatedAt;
    if (diff < 60_000)  return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  })();

  return (
    <Link href="/dashboard/conversations"
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors rounded-xl group">
      <div className="w-8 h-8 rounded-full glass flex items-center justify-center text-white/40 text-[11px] font-medium shrink-0">
        {conv.senderId.slice(-2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-white/75 text-[12.5px] font-medium font-mono">{masked}</p>
          {conv.orderDetected && (
            <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-300/70 font-medium">
              Order
            </span>
          )}
        </div>
        <p className="text-white/35 text-[12px] truncate">{conv.lastMessage}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-white/25 text-[11px]">{ago}</p>
        <p className="text-white/20 text-[10.5px] mt-0.5">{conv.messageCount} msgs</p>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Stats = {
  conversations: number;
  messages:      number;
  orders:        number;
  activeToday:   number;
};

export default function OverviewPage() {
  const { user } = useAuth();
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [chartData,    setChartData]    = useState<DailyStats[]>([]);
  const [recentConvs,  setRecentConvs]  = useState<(Conversation & { id: string })[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [accounts,     setAccounts]     = useState<InstagramAccount[]>([]);

  // Toggle AI on/off for an account
  const toggleAi = async (pageId: string, current: boolean) => {
    await updateDoc(doc(db, "instagram_accounts", pageId), { aiEnabled: !current });
    setAccounts((prev) => prev.map((a) => a.pageId === pageId ? { ...a, aiEnabled: !current } : a));
  };

  useEffect(() => {
    if (!user) return;

    (async function load() {
      // ── Counts ──
      const [convCount, orderCount, todayConvSnap] = await Promise.all([
        getCountFromServer(
          query(collection(db, "conversations"), where("userId", "==", user.uid))
        ),
        getCountFromServer(
          query(collection(db, "orders"), where("userId", "==", user.uid))
        ),
        getDocs(
          query(
            collection(db, "conversations"),
            where("userId", "==", user.uid),
            where("updatedAt", ">=", Date.now() - 86_400_000)
          )
        ),
      ]);

      // ── Total messages (sum messageCount across conversations) ──
      const allConvsSnap = await getDocs(
        query(collection(db, "conversations"), where("userId", "==", user.uid))
      );
      const totalMessages = allConvsSnap.docs.reduce(
        (sum, d) => sum + ((d.data().messageCount as number) ?? 0), 0
      );

      setStats({
        conversations: convCount.data().count,
        messages:      totalMessages,
        orders:        orderCount.data().count,
        activeToday:   todayConvSnap.size,
      });

      // ── Last 7 days chart data ──
      const days: DailyStats[] = [];
      for (let i = 6; i >= 0; i--) {
        const d    = new Date();
        d.setDate(d.getDate() - i);
        const key  = d.toISOString().slice(0, 10);
        days.push({ date: key, messages: 0, conversations: 0, orders: 0 });
      }

      const dailySnap = await getDocs(
        query(
          collection(db, "analytics", user.uid, "daily"),
          where("date", ">=", days[0].date),
          orderBy("date", "asc")
        )
      );
      dailySnap.forEach((doc) => {
        const d = doc.data() as DailyStats;
        const idx = days.findIndex((x) => x.date === d.date);
        if (idx !== -1) days[idx] = { ...days[idx], ...d };
      });
      setChartData(days);

      // ── Recent conversations ──
      const recentSnap = await getDocs(
        query(
          collection(db, "conversations"),
          where("userId", "==", user.uid),
          orderBy("updatedAt", "desc"),
          limit(6)
        )
      );
      setRecentConvs(
        recentSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Conversation),
        }))
      );

      // Load connected Instagram accounts
      getDocs(query(collection(db, "instagram_accounts"), where("userId", "==", user.uid)))
        .then((snap) => setAccounts(snap.docs.map((d) => d.data() as InstagramAccount)))
        .catch(console.error);

      setLoading(false);
    })().catch(console.error);
  }, [user]);

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl glass animate-pulse" />
        ))}
      </div>
    );
  }

  const totalMsgs7d = chartData.reduce((s, d) => s + d.messages, 0);

  return (
    <div className="max-w-4xl space-y-6 w-full px-2 sm:px-4 mx-auto">
      {/* Connect Instagram button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <a
          href="/api/auth/instagram"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold shadow hover:scale-105 transition text-base"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><path d="M7.75 2A5.75 5.75 0 0 0 2 7.75v8.5A5.75 5.75 0 0 0 7.75 22h8.5A5.75 5.75 0 0 0 22 16.25v-8.5A5.75 5.75 0 0 0 16.25 2h-8.5Zm0 1.5h8.5A4.25 4.25 0 0 1 20.5 7.75v8.5a4.25 4.25 0 0 1-4.25 4.25h-8.5A4.25 4.25 0 0 1 3.5 16.25v-8.5A4.25 4.25 0 0 1 7.75 3.5Zm8.25 2.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM12 7.25A4.75 4.75 0 1 0 12 16.75a4.75 4.75 0 0 0 0-9.5Zm0 1.5a3.25 3.25 0 1 1 0 6.5a3.25 3.25 0 0 1 0-6.5Z" fill="#262626"/></svg>
          Connect Instagram
        </a>
        <span className="text-xs text-zinc-400 text-center sm:text-left">
          You can connect more than one Instagram account.
        </span>
      </div>

      {/* Connected Instagram accounts */}
      {accounts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          {accounts.map((acc) => (
            <div key={acc.pageId} className="glass-card p-5 flex flex-col gap-2 items-start">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-white/90 text-[15px] truncate max-w-[140px]">{acc.instagramUsername || acc.pageId}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 ml-2">Connected</span>
              </div>
              <div className="flex items-center gap-3 w-full">
                <button
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs transition ${(acc as any).aiEnabled ? "bg-violet-500/80 text-white" : "bg-zinc-700/60 text-zinc-200"}`}
                  onClick={() => toggleAi(acc.pageId, !!(acc as any).aiEnabled)}
                >
                  {(acc as any).aiEnabled ? "AI: ON (Takeover)" : "AI: OFF (Manual)"}
                </button>
                <Link href={`/dashboard/inbox/${acc.pageId}`} className="text-blue-400 hover:underline text-xs">Inbox</Link>
                <Link href={`/dashboard/stats/${acc.pageId}`} className="text-amber-400 hover:underline text-xs">Stats</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Conversations"
          value={stats?.conversations ?? 0}
          sub="All time"
          icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          color="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          label="Messages"
          value={stats?.messages ?? 0}
          sub="Total exchanged"
          icon="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"
          color="bg-violet-500/10 text-violet-400"
        />
        <StatCard
          label="Orders Detected"
          value={stats?.orders ?? 0}
          sub="From DM conversations"
          icon="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          label="Active Today"
          value={stats?.activeToday ?? 0}
          sub="Conversations (24 h)"
          icon="M13 10V3L4 14h7v7l9-11h-7z"
          color="bg-amber-500/10 text-amber-400"
        />
      </div>

      {/* Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-white/80 text-[13.5px] font-semibold">Message volume</p>
            <p className="text-white/35 text-[12px] mt-0.5">Last 7 days · {totalMsgs7d} messages</p>
          </div>
          <Link href="/dashboard/conversations"
            className="text-white/35 hover:text-white/60 text-[12px] transition-colors">
            View all →
          </Link>
        </div>
        {chartData.length > 0
          ? <BarChart data={chartData} />
          : <div className="h-20 flex items-center justify-center text-white/20 text-[12.5px]">
              No data yet — conversations will appear here automatically.
            </div>
        }
      </div>

      {/* Recent conversations */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <p className="text-white/80 text-[13.5px] font-semibold">Recent conversations</p>
          <Link href="/dashboard/conversations"
            className="text-white/35 hover:text-white/60 text-[12px] transition-colors">
            View all →
          </Link>
        </div>

        {recentConvs.length === 0 ? (
          <div className="px-5 py-10 text-center text-white/25 text-[13px]">
            No conversations yet. Connect an Instagram account to get started.
          </div>
        ) : (
          <div className="px-2 py-2 flex flex-col">
            {recentConvs.map((conv) => <ConvRow key={conv.id} conv={conv} />)}
          </div>
        )}
      </div>

    </div>
  );
}

// Toggle AI on/off for an account
// (must be declared after setAccounts is defined)
// Move this function inside the OverviewPage component, after setAccounts is defined
