import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Inline the database credentials into the server bundle at build time.
   * They arrive from .env.production, which is supplied per-deployment and is
   * never committed. Both are read only by server code (lib/store), so neither
   * reaches the browser bundle. Empty values make the app fall back to the
   * in-memory demo store, which is what local development and CI use.
   */
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "",
  },
};

export default nextConfig;
