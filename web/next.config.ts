import type { NextConfig } from "next";

/**
 * Database credentials (SUPABASE_URL, SUPABASE_SECRET_KEY) come from the
 * hosting environment's variables and are read at runtime by lib/store.
 * With neither set the app falls back to the in-memory demo store, which is
 * what local development and CI use.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
