"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  Building2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Package,
  PlugZap,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import type { AdminSupplier } from "@/lib/admin/suppliers-data";
import type { StockmanConnectionStatus } from "@/lib/suppliers/stockman/types";
import StockmanConnectorCard from "@/components/admin/StockmanConnectorCard";
import StockmanBulkSyncCard from "@/components/admin/StockmanBulkSyncCard";
import StockmanCatalogDiscoveryCard from "@/components/admin/StockmanCatalogDiscoveryCard";
import StockmanImportDraftReviewCard from "@/components/admin/StockmanImportDraftReviewCard";
import SupplierPricingManager from "@/components/admin/SupplierPricingManager";
import StockmanPublicationAuditCard from "@/components/admin/StockmanPublicationAuditCard";
import StockmanMiloadCategoryRepairCard from "@/components/admin/StockmanMiloadCategoryRepairCard";
import AdeiLeadTimeSyncCard from "@/components/admin/AdeiLeadTimeSyncCard";

type WorkspaceTab = "overview" | "catalogue" | "import" | "sync" | "pricing" | "connection";

const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof Package }> = [
  { id: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
  { id: "catalogue", label: "Produits", icon: Package },
  { id: "import", label: "Import / scan", icon: Boxes },
  { id: "sync", label: "Synchronisation", icon: RefreshCw },
  { id: "pricing", label: "Pricing", icon: CircleDollarSign },
  { id: "connection", label: "Connexion", icon: PlugZap },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function SuppliersWorkspace({
  suppliers,
  stockmanStatus,
}: {
  suppliers: AdminSupplier[];
  stockmanStatus: StockmanConnectionStatus;
}) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [query, setQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingSupplier, setDeletingSupplier] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const selected = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [selectedSupplierId, suppliers],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter((supplier) =>
      `${supplier.name} ${supplier.email} ${supplier.website}`.toLowerCase().includes(needle),
    );
  }, [query, suppliers]);

  function openSupplier(supplier: AdminSupplier) {
    setSelectedSupplierId(supplier.id);
    setTab("overview");
    setDeleteConfirm("");
    setDeleteError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteSupplier() {
    if (!selected || deleteConfirm.trim() !== selected.name.trim()) return;
    setDeletingSupplier(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/admin/suppliers/${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected.name }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Suppression impossible.");
      window.location.reload();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setDeletingSupplier(false);
    }
  }

  if (!selected) {
    return (
      <section className="mt-7">
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-slate-100 px-4 py-3">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un fournisseur…"
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white shadow-lg shadow-cyan-900/10"
          >
            <Building2 size={16} /> Nouveau fournisseur
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((supplier) => {
            const isStockman = slugify(supplier.name) === "stockman";
            return (
              <button
                key={supplier.id}
                type="button"
                onClick={() => openSupplier(supplier)}
                className="group rounded-[1.6rem] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#007f8f]/40 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Building2 size={21} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-black">{supplier.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${supplier.status === "Actif" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          {supplier.status}
                        </span>
                        {isStockman ? (
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${stockmanStatus.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {stockmanStatus.configured ? "Connecté" : "À connecter"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={19} className="mt-3 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#007f8f]" />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <Metric icon={Package} value={supplier.productCount} label="Produits" />
                  <Metric icon={ImageIcon} value={supplier.imageCount} label="Photos" />
                  <Metric icon={FileText} value={supplier.documentCount} label="Documents" />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Publiés</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{supplier.publishedCount}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">À compléter</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{supplier.incompleteCount}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const isStockman = slugify(selected.name) === "stockman";
  const isAdei = slugify(selected.name) === "adei";

  return (
    <section className="mt-7 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white md:p-7">
        <button
          type="button"
          onClick={() => setSelectedSupplierId(null)}
          className="inline-flex items-center gap-2 text-xs font-black text-slate-300 transition hover:text-white"
        >
          <ArrowLeft size={15} /> Tous les fournisseurs
        </button>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
              <Building2 size={25} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black md:text-3xl">{selected.name}</h2>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-300">
                  {selected.status}
                </span>
                {isStockman ? (
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${stockmanStatus.configured ? "bg-cyan-400/15 text-cyan-200" : "bg-amber-400/15 text-amber-200"}`}>
                    {stockmanStatus.configured ? "Connecteur actif" : "Connecteur à configurer"}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-medium text-slate-400">
                {selected.productCount} produits · {selected.publishedCount} publiés · {selected.draftCount} brouillons
              </p>
            </div>
          </div>

          <Link
            href={`/admin/catalogue?fournisseur=${encodeURIComponent(selected.name)}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-slate-950 transition hover:bg-slate-100"
          >
            <Package size={16} /> Ouvrir le catalogue
          </Link>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white">
        <div className="flex gap-1 overflow-x-auto p-2 md:px-5">
          {tabs
            .filter((item) => isStockman || (isAdei ? !["import", "connection"].includes(item.id) : !["import", "sync", "connection"].includes(item.id)))
            .map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-black transition ${
                  tab === id
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
        </div>
      </div>

      <div className="min-w-0 bg-slate-50/60 p-3 md:p-5 xl:p-6">
        {tab === "overview" ? (
          <div className="space-y-5">
            <SupplierOverview supplier={selected} isStockman={isStockman} stockmanStatus={stockmanStatus} onNavigate={setTab} />
            <details className="rounded-[1.5rem] border border-red-200 bg-red-50/60">
              <summary className="cursor-pointer px-5 py-4 text-xs font-black text-red-800">
                Zone sensible · supprimer le fournisseur
              </summary>
              <div className="border-t border-red-200 p-5">
                <p className="text-xs font-bold leading-5 text-red-700">
                  La suppression est refusée tant qu’un produit est rattaché à ce fournisseur. Pour confirmer une suppression possible, tapez exactement <span className="font-black">{selected.name}</span>.
                </p>
                {deleteError ? <div className="mt-3 rounded-xl bg-white px-4 py-3 text-xs font-bold text-red-700">{deleteError}</div> : null}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={deleteConfirm}
                    onChange={(event) => setDeleteConfirm(event.target.value)}
                    placeholder={`Taper ${selected.name}`}
                    className="min-w-0 flex-1 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void deleteSupplier()}
                    disabled={deletingSupplier || deleteConfirm.trim() !== selected.name.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                  >
                    <Trash2 size={16} /> {deletingSupplier ? "Suppression…" : "Supprimer le fournisseur"}
                  </button>
                </div>
              </div>
            </details>
          </div>
        ) : null}

        {tab === "catalogue" ? (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">Catalogue fournisseur</p>
            <h3 className="mt-2 text-xl font-black">{selected.productCount} produit(s) {selected.name}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Accédez au catalogue déjà filtré sur ce fournisseur pour modifier, publier ou contrôler les fiches.
            </p>
            <Link
              href={`/admin/catalogue?fournisseur=${encodeURIComponent(selected.name)}`}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white"
            >
              Voir les produits <ChevronRight size={15} />
            </Link>
          </div>
        ) : null}

        {tab === "pricing" ? (
          <div className="space-y-5">
            <SupplierPricingManager supplierName={selected.name} lockSupplier />
            {isStockman ? (
              <>
                <StockmanMiloadCategoryRepairCard />
                <StockmanPublicationAuditCard />
              </>
            ) : null}
          </div>
        ) : null}

        {isStockman && tab === "import" ? (
          <div className="space-y-5">
            <StockmanCatalogDiscoveryCard enabled={stockmanStatus.configured} />
            <StockmanImportDraftReviewCard />
          </div>
        ) : null}

        {isStockman && tab === "sync" ? (
          <StockmanBulkSyncCard enabled={stockmanStatus.configured} />
        ) : null}

        {isAdei && tab === "sync" ? (
          <AdeiLeadTimeSyncCard />
        ) : null}

        {isStockman && tab === "connection" ? (
          <StockmanConnectorCard status={stockmanStatus} />
        ) : null}
      </div>
    </section>
  );
}

function SupplierOverview({
  supplier,
  isStockman,
  stockmanStatus,
  onNavigate,
}: {
  supplier: AdminSupplier;
  isStockman: boolean;
  stockmanStatus: StockmanConnectionStatus;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const actions: Array<{ title: string; description: string; tab: WorkspaceTab; icon: typeof Package }> = [
    { title: "Produits", description: "Consulter les fiches rattachées", tab: "catalogue", icon: Package },
    { title: "Pricing", description: "Marge et révision tarifaire", tab: "pricing", icon: CircleDollarSign },
  ];
  if (isStockman) {
    actions.push(
      { title: "Import / scan", description: "Découvrir et préparer des références", tab: "import", icon: Boxes },
      { title: "Synchronisation", description: "Actualiser le catalogue fournisseur", tab: "sync", icon: RefreshCw },
      { title: "Connexion", description: "Contrôler l’accès revendeur", tab: "connection", icon: PlugZap },
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric label="Produits" value={supplier.productCount} />
        <OverviewMetric label="Publiés" value={supplier.publishedCount} />
        <OverviewMetric label="Brouillons" value={supplier.draftCount} />
        <OverviewMetric label="À compléter" value={supplier.incompleteCount} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={17} className="text-[#007f8f]" />
            <h3 className="text-base font-black">Piloter {supplier.name}</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {actions.map(({ title, description, tab, icon: Icon }) => (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(tab)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#007f8f]/40 hover:bg-cyan-50/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-950">{title}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{description}</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-[#007f8f]" />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Settings2 size={17} className="text-[#007f8f]" />
            <h3 className="text-base font-black">État fournisseur</h3>
          </div>
          <div className="mt-5 space-y-4 text-xs font-bold">
            <StatusRow label="Statut" value={supplier.status} />
            <StatusRow label="Délai moyen" value={supplier.averageLeadTime} />
            <StatusRow label="Dernière mise à jour" value={supplier.lastUpdate} />
            {isStockman ? (
              <StatusRow label="Connecteur" value={stockmanStatus.configured ? "Opérationnel" : "À configurer"} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Package; value: number; label: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <Icon size={15} className="text-[#007f8f]" />
      <p className="mt-2 text-lg font-black">{value}</p>
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function OverviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-400">{label}</span>
      <strong className="text-right text-slate-950">{value}</strong>
    </div>
  );
}
