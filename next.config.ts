import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les deux packages chargent des fichiers au runtime depuis node_modules.
  // Les garder externes evite que Turbopack n'en perde des ressources internes.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],

  // Chromium et Playwright resolvent certains fichiers runtime dynamiquement.
  // Le tracer Next ne peut pas toujours les inferer automatiquement.
  outputFileTracingIncludes: {
    "/api/admin/suppliers/stockman/*": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/playwright-core/browsers.json",
    ],
    "/api/admin/suppliers/pricing": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/playwright-core/browsers.json",
    ],
    "/api/admin/catalogue/\\[id\\]/stockman/sync": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/playwright-core/browsers.json",
    ],
  },
};

export default nextConfig;
