import type { NextConfig } from "next";

import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // The default MDX files are read from disk at runtime; make sure they ship with the standalone build.
  outputFileTracingIncludes: {
    "/": ["./content/**/*"],
    "/admin": ["./content/**/*"],
    "/admin/[id]": ["./content/**/*"],
  },
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
