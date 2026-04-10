"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Order } from "@/lib/types";

function Icon({ path, size = 14 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

type OrderStatus = Order["status"];

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:   "bg-amber-500/12 text-amber-300/80 border-amber-500/15",
  confirmed: "bg-blue-500/12 text-blue-300/80 border-blue-500/15",
  completed: "bg-emerald-500/12 text-emerald-300/80 border-emerald-500/15",
  cancelled: "bg-red-500/10 text-red-300/60 border-red-500/12",
};

const STATUS_OPTIONS: OrderStatus[] = ["pending", "confirmed", "completed", "cancelled"];

function maskSender(id: string) {
  if (id.length <= 10) return id;
  return id.slice(0, 5) + "·····" + id.slice(-4);
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${STATUS_STYLES[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function StatusSelect({ orderId, current }: { orderId: string; current: OrderStatus }) {
  const [updating, setUpdating] = useState(false);

  async function handleChange(next: OrderStatus) {
    if (next === current) return;
    setUpdating(true);
    await updateDoc(doc(db, "orders", orderId), { status: next, updatedAt: Date.now() });
    setUpdating(false);
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value as OrderStatus)}
      disabled={updating}
      className="bg-transparent text-[11.5px] text-white/50 border border-white/[0.09] rounded-lg px-2 py-1 cursor-pointer hover:border-white/20 transition-colors focus:outline-none disabled:opacity-40">
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s} className="bg-[#0d0d20] text-white/80">
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders,  setOrders]  = useState<(Order & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<OrderStatus | "all">("all");

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Order) })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const counts = {
    all:       orders.length,
    pending:   orders.filter((o) => o.status === "pending").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    completed: orders.filter((o) => o.status === "completed").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  return (
    <div className="max-w-4xl space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-white text-[16px] font-semibold tracking-tight mb-1">Orders</h1>
          <p className="text-white/35 text-[12.5px]">
            Orders and booking requests detected by Zelo in DM conversations.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-[11.5px] text-white/35">
          <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" size={13} />
          {orders.length} total
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 glass rounded-xl w-fit">
        {(["all", "pending", "confirmed", "completed", "cancelled"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-all ${
              filter === s
                ? "glass text-white"
                : "text-white/35 hover:text-white/60"
            }`}>
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className={`ml-1.5 text-[10px] ${filter === s ? "text-white/50" : "text-white/20"}`}>
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl glass animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card py-14 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/30 mb-4">
            <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" size={16} />
          </div>
          <p className="text-white/50 text-[13.5px] font-medium mb-1">No orders yet</p>
          <p className="text-white/25 text-[12.5px] max-w-[260px]">
            Zelo automatically detects order intent in DM conversations and logs them here.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-5 py-2.5 border-b border-white/[0.06] text-[11px] font-semibold text-white/25 uppercase tracking-wider">
            <span>Customer</span>
            <span>Description</span>
            <span>Status</span>
            <span className="text-right">Date</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/[0.04]">
            {visible.map((order) => (
              <div key={order.id}
                className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors">
                {/* Customer */}
                <div>
                  <p className="text-white/65 text-[12px] font-mono">{maskSender(order.senderId)}</p>
                  <p className="text-white/25 text-[10.5px] mt-0.5">via Instagram DM</p>
                </div>

                {/* Description */}
                <p className="text-white/55 text-[12.5px] leading-relaxed line-clamp-2">
                  {order.description}
                </p>

                {/* Status */}
                <StatusSelect orderId={order.id} current={order.status} />

                {/* Date */}
                <p className="text-white/30 text-[11.5px] text-right whitespace-nowrap">
                  {timeAgo(order.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
