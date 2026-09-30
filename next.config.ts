import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  // Ship SQL migrations with the server bundle so they can run at startup.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
