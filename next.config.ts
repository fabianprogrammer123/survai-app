import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Emit a self-contained production build at .next/standalone that Cloud Run
  // can run with `node server.js` — no node_modules tree, no source maps,
  // no dev deps. Cuts the Docker image from ~1GB to ~200MB.
  output: "standalone",
  // Pin the file-tracing root to this project so standalone output lands at
  // .next/standalone/server.js (not nested under a detected workspace parent).
  // Relevant when multiple lockfiles exist (worktrees share the parent's).
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS: force HTTPS for two years, include subdomains, eligible for
          // browser preload list. Only effective when served over HTTPS (dev
          // over http://localhost ignores it).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // frame-ancestors 'none' is the modern replacement for X-Frame-Options.
          // Keeping both — browsers honor whichever is stricter.
          // base-uri 'self' + form-action 'self' lock down common injection vectors
          // without interfering with Next.js's inline hydration scripts.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
