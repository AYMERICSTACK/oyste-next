import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les deux packages chargent des fichiers au runtime depuis node_modules.
  // Les garder externes evite que Turbopack n'en perde des ressources internes.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],

  // @sparticuz/chromium resout ses archives Brotli dynamiquement depuis bin/.
  // Le tracer Next ne peut pas toujours inferer ces fichiers tout seul.
  outputFileTracingIncludes: {
    "/api/admin/suppliers/stockman/*": [
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

export default nextConfig;
