"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Conversation, ChatMessage } from "@/lib/types";

function Icon({ path, size = 14 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function maskSender(id: string) {
  if (id.length <= 10) return id;
  return id.slice(0, 5) + "·····" + id.slice(-4);
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Message thread ─────────────────────────────────────────────────────────────

function MessageThread({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-col gap-2 p-4 max-h-72 overflow-y-auto">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
          <div className={`px-3 py-2 rounded-xl text-[12px] leading-relaxed max-w-[80%] ${
            m.role === "user"
              ? "bg-white/[0.06] text-white/70 border border-white/[0.06]"
              : "glass text-white/80"
          }`}>
            <p>{m.content}</p>
            <p className={`text-[10px] mt-1 ${m.role === "user" ? "text-white/25" : "text-white/30"}`}>
              {new Date(m.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Conversation row ───────────────────────────────────────────────────────────

function ConvItem({ conv }: { conv: Conversation & { id: string } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-white/[0.05] last:border-0">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.025] transition-colors text-left">

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full glass flex items-center justify-center text-white/40 text-[12px] font-semibold shrink-0">
          {conv.senderId.slice(-2).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-white/70 text-[12.5px] font-medium font-mono">
              {maskSender(conv.senderId)}
            </p>
            {conv.orderDetected && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-300/70 font-medium border border-violet-500/15">
                Order
              </span>
            )}
          </div>
          <p className="text-white/35 text-[12px] truncate">{conv.lastMessage}</p>
        </div>

        {/* Meta */}
        <div className="text-right shrink-0 mr-2">
          <p className="text-white/30 text-[11px]">{timeAgo(conv.updatedAt)}</p>
          <p className="text-white/20 text-[10.5px] mt-0.5">{conv.messageCount} messages</p>
        </div>

        {/* Chevron */}
        <div className={`text-white/20 transition-transform ${expanded ? "rotate-90" : ""}`}>
          <Icon path="M9 18l6-6-6-6" size={13} />
        </div>
      </button>

      {/* Expanded thread */}
      {expanded && (
        <div className="border-t border-white/[0.05] bg-white/[0.015]">
          <div className="px-4 py-2 border-b border-white/[0.05] flex items-center justify-between">
            <p className="text-white/25 text-[11px]">
              Conversation started {new Date(conv.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <p className="text-white/20 text-[11px]">Page: {conv.pageId}</p>
          </div>
          <MessageThread messages={conv.messages ?? []} />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<(Conversation & { id: string })[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterOrder,   setFilterOrder]   = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [syncMsg,       setSyncMsg]       = useState<string | null>(null);

  async function handleSync() {
    if (!user) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/instagram/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json() as { ok: boolean; synced?: number; error?: string };
      setSyncMsg(data.ok ? `Synced ${data.synced} conversation${data.synced !== 1 ? "s" : ""}` : (data.error ?? "Sync failed"));
    } catch {
      setSyncMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "conversations"),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Conversation) })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const visible = conversations.filter((c) => {
    if (filterOrder && !c.orderDetected) return false;
    if (search && !c.senderId.toLowerCase().includes(search.toLowerCase()) &&
        !c.lastMessage.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-4xl space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-white text-[16px] font-semibold tracking-tight mb-1">Conversations</h1>
          <p className="text-white/35 text-[12.5px]">
            All DM conversations handled by Zelo — click any row to view the full thread.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {syncMsg && <span className="text-white/30 text-[11.5px]">{syncMsg}</span>}
          <button onClick={handleSync} disabled={syncing}
            className="btn btn-secondary text-[12px] disabled:opacity-40">
            <Icon path="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" size={12} />
            {syncing ? "Syncing…" : "Sync inbox"}
          </button>
          <span className="text-white/30 text-[11.5px]">{conversations.length} total</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
            <Icon path="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" size={13} />
          </div>
          <input
            type="text"
            placeholder="Search by sender ID or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-8 text-[12.5px] h-9"
          />
        </div>
        <button
          onClick={() => setFilterOrder(!filterOrder)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium border transition-all shrink-0 ${
            filterOrder
              ? "glass border-violet-500/30 text-violet-300"
              : "border-white/[0.09] text-white/40 hover:text-white/60 hover:border-white/15"
          }`}>
          <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" size={12} />
          Orders only
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl glass animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card py-14 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/30 mb-4">
            <Icon path="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" size={16} />
          </div>
          <p className="text-white/50 text-[13.5px] font-medium mb-1">
            {search || filterOrder ? "No matches found" : "No conversations yet"}
          </p>
          <p className="text-white/25 text-[12.5px] max-w-[260px]">
            {search || filterOrder
              ? "Try adjusting your filters."
              : "Conversations will appear here as customers message your Instagram."}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-2.5 border-b border-white/[0.06] text-[11px] font-semibold text-white/25 uppercase tracking-wider">
            <span className="w-9" />
            <span>Customer · Last message</span>
            <span>Time</span>
            <span className="w-4" />
          </div>
          <div>
            {visible.map((conv) => <ConvItem key={conv.id} conv={conv} />)}
          </div>
        </div>
      )}

    </div>
  );
}
