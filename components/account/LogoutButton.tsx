"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-white/70 bg-white px-5 py-3 text-sm font-black text-[#061923] shadow-lg shadow-black/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-500 hover:text-white hover:shadow-red-950/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/40 disabled:cursor-wait disabled:opacity-70"
      aria-label="Se déconnecter de l’espace client"
    >
      <LogOut className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      {isLoading ? "Déconnexion…" : "Déconnexion"}
    </button>
  );
}
