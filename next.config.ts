import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets `next dev` be opened through a tunnel (ngrok / Cloudflare) for quick demos.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io", "*.trycloudflare.com"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  // Ship SQL migrations with the server bundle so they can run at startup.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
