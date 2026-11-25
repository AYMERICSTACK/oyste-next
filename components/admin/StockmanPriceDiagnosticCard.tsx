"use client";

import { useMemo, useState } from "react";

type Status =
  | "OK"
  | "ECART_PRIX"
  | "ABSENT_CATALOGUE"
  | "AMBIGU"
  | "PRIX_PRODUIT_INVALIDE";

type Row = {
  reference: string;
  salePriceHt: number;
  catalogPriceHt: number | null;
  status: Status;
  kind: string | null;
  sourceVersion: string;
  updatedAt: string;
};

type Diagnostic = {
  total: number;
  counts: Record<Status, number>;
  rows: Row[];
};

const statuses: { value: string; label: string }[] = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "OK", label: "Prix identiques" },
  { value: "ECART_PRIX", label: "Ecarts de prix" },
  { value: "ABSENT_CATALOGUE", label: "Absents du catalogue" },
  { value: "AMBIGU", label: "Correspondances ambigues" },
  { value: "PRIX_PRODUIT_INVALIDE", label: "Prix produit invalides" },
];

function euros(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default function StockmanPriceDiagnosticCard() {
  const [data, setData] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);

  async function run() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/admin/suppliers/stockman/price-diagnostic",
        { cache: "no-store", credentials: "same-origin" },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Diagnostic indisponible");
      }
      if (!Array.isArray(body.rows)) {
        throw new Error("Reponse de diagnostic invalide");
      }
      setData(body as Diagnostic);
      setPage(0);
    } catch (reason) {
      setData(null);
      setError(
        reason instanceof Error ? reason.message : "Erreur inconnue"
      );
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const text = query.trim().toUpperCase();
    return (data?.rows ?? []).filter(row =>
      (status === "ALL" || row.status === status) &&
      (!text || row.reference.toUpperCase().includes(text))
    );
  }, [data, query, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * 50, (currentPage + 1) * 50);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900">
            Diagnostic tarifs STOCKMAN - Neon
          </h3>
          <p className="text-sm text-slate-500">
            Prix de vente HT. Lecture seule, sans prix d'achat.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "Diagnostic en cours..." : "Lancer le diagnostic"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>
      )}

      {data && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Tarifs Neon</p>
              <p className="text-xl font-black">{data.total}</p>
            </div>
            {statuses.filter(s => s.value !== "ALL").map(s => (
              <div key={s.value} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-xl font-black">
                  {data.counts[s.value as Status] ?? 0}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <input
              aria-label="Rechercher une reference"
              placeholder="Rechercher une reference"
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setPage(0);
              }}
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              aria-label="Filtrer par statut"
              value={status}
              onChange={event => {
                setStatus(event.target.value);
                setPage(0);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {statuses.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            {filtered.length} reference(s) dans le filtre.
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-2">Reference</th>
                  <th className="p-2">Prix Neon HT</th>
                  <th className="p-2">Prix produit HT</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Diagnostic</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(row => (
                  <tr key={row.reference} className="border-b border-slate-100">
                    <td className="p-2 font-semibold">{row.reference}</td>
                    <td className="p-2">{euros(row.salePriceHt)}</td>
                    <td className="p-2">{euros(row.catalogPriceHt)}</td>
                    <td className="p-2">{row.kind ?? "-"}</td>
                    <td className="p-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >Precedent</button>
            <span className="text-xs text-slate-500">
              Page {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={currentPage + 1 >= pageCount}
              onClick={() => setPage(p => p + 1)}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >Suivant</button>
          </div>
        </>
      )}
    </section>
  );
}