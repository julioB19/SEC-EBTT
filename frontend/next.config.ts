import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence Turbopack workspace root warning by pinning the root
  // to this app directory. This avoids conflicts when multiple
  // lockfiles exist at different levels (e.g., repo root + app).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
