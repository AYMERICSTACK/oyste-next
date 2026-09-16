"use client";

import { useState } from "react";
import { CheckCircle2, Wrench } from "lucide-react";

export default function HydrobullCategoryFixCard() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<string[]>([]);

  async function applyFix() {
    const confirmation = window.prompt(
      "Correction ciblée HYDROBULL : 6 références seront replacées dans les branches Grue d’atelier.\n\nTapez exactement HYDROBULL pour confirmer.",
    );
    if (confirmation !== "HYDROBULL") return;

    setRunning(true);
    setMessage("");
    setDetails([]);

    try {
      const response = await fetch("/api/admin/catalogue/hydrobull-category-fix", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Correction impossible.");

      setMessage(`${payload.updated || 0} produit(s) HYDROBULL corrigé(s).`);
      setDetails(
        Array.isArray(payload.changes)
          ? payload.changes.map(
              (item: { code: string; from: string; to: string }) =>
                `${item.code} : ${item.from} → ${item.to}`,
            )
          : [],
      );

      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Correction impossible.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Wrench size={17} className="text-amber-600" />
            Correction catégories HYDROBULL · V2.10.23.2
          </div>
          <p className="mt-2 max-w-4xl text-xs font-bold leading-5 text-slate-600">
            Replace uniquement HBGK, HBFAPO, HBGKFAPO, HBGSFAPO, ITI500 et HB300GKNF8
            dans les branches Grue d’atelier définies par le fichier source. Aucun autre produit n’est modifié.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void applyFix()}
          disabled={running}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-xs font-black text-white hover:bg-amber-500 disabled:opacity-50"
        >
          <CheckCircle2 size={16} />
          {running ? "Correction…" : "Appliquer la correction HYDROBULL"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white px-4 py-3 text-xs font-bold text-slate-700">
          {message}
          {details.length ? (
            <div className="mt-2 space-y-1 text-[10px] text-slate-500">
              {details.map((detail) => <div key={detail}>{detail}</div>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
