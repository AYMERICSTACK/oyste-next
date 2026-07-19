import type { Metadata } from "next";
import { CartProvider } from "@/lib/cart/cart-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "OYSTE — Solutions de levage industriel",
  description:
    "Catalogue OYSTE : levage, manutention, motorisation SEW, accessoires et solutions industrielles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-white text-slate-950"><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
