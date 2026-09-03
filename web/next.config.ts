import type { NextConfig } from "next";

/**
 * Database credentials (SUPABASE_URL, SUPABASE_SECRET_KEY) come from the
 * hosting environment's variables and are read at runtime by lib/store.
 * With neither set the app falls back to the in-memory demo store, which is
 * what local development and CI use.
 */
const nextConfig: NextConfig = {
  experimental: {
    // Logo uploads go through a server action, and the default cap is 1MB —
    // below the 2MB the upload form itself advertises. The extra megabyte is
    // headroom for the multipart encoding around the file.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
