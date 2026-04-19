"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { InstagramAccount } from "@/lib/types";

function Icon({ path, size = 14 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

type AccountDoc = InstagramAccount & { id: string };

export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountDoc[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [removing,  setRemoving]  = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "instagram_accounts"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as InstagramAccount) })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  function buildConnectUrl() {
    const appId       = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
    const redirectUri = encodeURIComponent(
      process.env.NEXT_PUBLIC_META_REDIRECT_URI ?? `${window.location.origin}/api/auth/meta/callback`
    );
    const scope = encodeURIComponent("instagram_business_basic,instagram_business_manage_messages");
    const state = encodeURIComponent(user?.uid ?? "");
    return `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
  }

  async function handleRefresh(id: string) {
    setRefreshing(id);
    await fetch("/api/auth/meta/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: id, userId: user?.uid }),
    });
    setRefreshing(null);
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    await fetch("/api/auth/meta/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: id, userId: user?.uid }),
    });
    setRemoving(null);
  }

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-white text-[16px] font-semibold tracking-tight mb-1">Instagram Accounts</h1>
          <p className="text-white/35 text-[12.5px]">
            {loading ? "Loading…" : accounts.length > 0
              ? `${accounts.length} account${accounts.length > 1 ? "s" : ""} connected`
              : "No accounts connected yet"}
          </p>
        </div>
        <a href={buildConnectUrl()} className="btn btn-primary shrink-0 text-[12.5px]">
          <Icon path="M12 5v14M5 12h14" size={12} />
          Add account
        </a>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[1, 2].map((i) => <div key={i} className="h-[62px] rounded-xl glass animate-pulse" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="glass-card flex flex-col items-center text-center py-14 px-6 border-dashed">
          <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/30 mb-4">
            <Icon path="M16 2H8C4.7 2 2 4.7 2 8v8c0 3.3 2.7 6 6 6h8c3.3 0 6-2.7 6-6V8c0-3.3-2.7-6-6-6zm-4 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm5.5-9a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" size={16} />
          </div>
          <h3 className="text-white/65 text-[13.5px] font-medium mb-1.5">No accounts connected</h3>
          <p className="text-white/30 text-[12.5px] mb-6 max-w-[240px] leading-relaxed">
            Connect your Instagram to let Zelo handle your sales DMs automatically.
          </p>
          <a href={buildConnectUrl()} className="btn btn-primary text-[12.5px]">
            <Icon path="M12 5v14M5 12h14" size={12} />
            Connect Instagram
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {accounts.map((acc) => (
            <div key={acc.id} className="group glass-card flex items-center gap-4 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-violet-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-[13.5px] font-medium truncate">
                  {acc.instagramUsername ? `@${acc.instagramUsername}` : acc.pageId}
                </p>
                <p className="text-white/30 text-[11.5px] mt-0.5">
                  Connected {new Date(acc.connectedAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                  {acc.expiresIn && (
                    <span className="ml-2">· Token valid for ~60 days</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-white/30 text-[11.5px]">Active</span>
              </div>
              <button onClick={() => handleRefresh(acc.id)} disabled={refreshing === acc.id}
                title="Refresh token"
                className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-blue-400 transition-all disabled:opacity-20">
                <Icon path="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" size={13} />
              </button>
              <button onClick={() => handleRemove(acc.id)} disabled={removing === acc.id}
                title="Disconnect account"
                className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition-all disabled:opacity-20 ml-1">
                <Icon path="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Token notice */}
      {accounts.length > 0 && (
        <div className="flex gap-3 p-4 rounded-xl glass">
          <span className="text-white/30 mt-0.5 shrink-0">
            <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" size={13} />
          </span>
          <p className="text-white/35 text-[12px] leading-relaxed">
            Access tokens expire after 60 days. Reconnecting your account will refresh the token automatically.
            Make sure{" "}
            <code className="text-white/50 font-mono text-[11px]">META_PAGE_ID</code> and{" "}
            <code className="text-white/50 font-mono text-[11px]">META_PAGE_ACCESS_TOKEN</code>{" "}
            in Vercel are kept up to date for the webhook to function.
          </p>
        </div>
      )}

    </div>
  );
}
