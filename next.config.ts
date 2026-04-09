import type { NextConfig } from "next";

const requiredEnvVars = [
  "META_WEBHOOK_VERIFY_TOKEN",
  "META_APP_SECRET",
  "META_PAGE_ACCESS_TOKEN",
  "META_PAGE_ID",
  "OPENAI_API_KEY",
];

if (process.env.NODE_ENV === "production") {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

const nextConfig: NextConfig = {
  serverExternalPackages: [],

  // Disable the x-powered-by header
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
