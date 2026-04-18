// ── Firestore document types ──────────────────────────────────────────────────
// All collections are scoped by userId (Firebase Auth UID).
// Sensitive PII is never stored — only Instagram pseudonymous sender IDs (IGSIDs).

export type InstagramAccount = {
  userId: string;
  pageId: string;
  instagramUsername: string;
  accessToken: string;       // long-lived Instagram token — server-side only
  expiresIn: number | null;
  connectedAt: number;
  aiEnabled?: boolean;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

// conversations/{pageId}_{senderId}
export type Conversation = {
  userId: string;
  pageId: string;
  senderId: string;           // Instagram IGSID — pseudonymous, per-app scoped
  messages: ChatMessage[];
  messageCount: number;
  lastMessage: string;        // truncated preview, no PII
  orderDetected: boolean;
  createdAt: number;
  updatedAt: number;
};

// orders/{autoId}
export type Order = {
  userId: string;
  pageId: string;
  senderId: string;           // pseudonymous IGSID
  conversationId: string;     // pageId_senderId
  description: string;        // what the customer asked about — no PII
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: number;
  updatedAt: number;
};

// analytics/{userId}/daily/{YYYY-MM-DD}
export type DailyStats = {
  date: string;               // YYYY-MM-DD
  messages: number;
  conversations: number;      // new conversations started this day
  orders: number;             // new orders detected this day
};
