"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  Building2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Pencil,
  Plus,
  Package,
  PlugZap,
  RefreshCw,
  Search,
  Settings2,
  X,
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
import AssetUploadButton from "@/components/admin/AssetUploadButton";
import { isIntegrationSupplier } from "@/lib/admin/reference-validation";

type WorkspaceTab = "overview" | "profile" | "catalogue" | "import" | "sync" | "pricing" | "connection";

type SupplierReference = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  averageLeadTime?: string | null;
  internalNotes?: string | null;
  homeHref?: string | null;
  homeOrder?: number | null;
  homeVisible?: boolean;
  isActive?: boolean;
};

type SupplierForm = {
  id?: string;
  name: string;
  slug: string;
  logoUrl: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  averageLeadTime: string;
  internalNotes: string;
  homeHref: string;
  homeOrder: number;
  homeVisible: boolean;
  isActive: boolean;
};

const emptySupplierForm: SupplierForm = {
  name: "", slug: "", logoUrl: "", contactName: "", email: "", phone: "", website: "",
  averageLeadTime: "", internalNotes: "", homeHref: "", homeOrder: 0, homeVisible: false, isActive: true,
};

const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof Package }> = [
  { id: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
  { id: "profile", label: "Fiche fournisseur", icon: Pencil },
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
  const [references, setReferences] = useState<SupplierReference[]>([]);
  const [writable, setWritable] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [referenceError, setReferenceError] = useState("");

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

  useEffect(() => {
    let active = true;
    fetch("/api/admin/suppliers")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Chargement des fiches fournisseurs impossible.");
        if (!active) return;
        setReferences(payload.items || []);
        setWritable(Boolean(payload.writable));
      })
      .catch((error) => {
        if (active) setReferenceError(error instanceof Error ? error.message : "Chargement impossible.");
      });
    return () => { active = false; };
  }, []);

  const selectedReference = useMemo(
    () => references.find((item) => item.id === selectedSupplierId) ?? null,
    [references, selectedSupplierId],
  );

  function openSupplier(supplier: AdminSupplier, nextTab: WorkspaceTab = "overview") {
    setCreatingSupplier(false);
    setSelectedSupplierId(supplier.id);
    setTab(nextTab);
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

  if (!selected && !creatingSupplier) {
    return (
      <section className="mt-7">
        <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-white to-cyan-50/50 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-950 md:text-2xl">Fournisseurs & intégrations</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{suppliers.length} fournisseurs</span>
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Une seule vue pour gérer la fiche publique d’un fournisseur et piloter ses produits, imports, synchronisations ou tarifs.</p>
              </div>
              {writable ? (
                <button type="button" onClick={() => { setCreatingSupplier(true); setTab("profile"); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-900/10 transition hover:-translate-y-0.5 hover:bg-[#006f7d]">
                  <Plus size={17} /> Nouveau fournisseur
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-4 md:p-5">
            {referenceError ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{referenceError}</div> : null}
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-50">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un fournisseur…" className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400" />
              <span className="shrink-0 text-[11px] font-bold text-slate-400">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((supplier) => {
                const slug = slugify(supplier.name);
                const isStockman = slug === "stockman";
                const hasIntegration = ["stockman", "adei", "kito", "sew", "sew-usocome"].includes(slug);
                const ref = references.find((item) => item.id === supplier.id);
                return (
                  <article key={supplier.id} className="group rounded-[1.6rem] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#007f8f]/40 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-white">
                          {ref?.logoUrl ? <img src={ref.logoUrl} alt="" className="h-full w-full bg-white object-contain p-1.5" /> : <Building2 size={21} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black">{supplier.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${supplier.status === "Actif" ? "bg-emerald-500" : "bg-amber-500"}`} />
                            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{supplier.status}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${hasIntegration ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-500"}`}>{hasIntegration ? "Intégration" : "Gestion manuelle"}</span>
                            {isStockman ? <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${stockmanStatus.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{stockmanStatus.configured ? "Connecté" : "À connecter"}</span> : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <Metric icon={Package} value={supplier.productCount} label="Produits" />
                      <Metric icon={ImageIcon} value={supplier.imageCount} label="Photos" />
                      <Metric icon={FileText} value={supplier.documentCount} label="Documents" />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                      <div><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Publiés</p><p className="mt-1 text-sm font-black text-slate-950">{supplier.publishedCount}</p></div>
                      <div><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">À compléter</p><p className="mt-1 text-sm font-black text-slate-950">{supplier.incompleteCount}</p></div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => openSupplier(supplier, "overview")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white transition hover:bg-slate-800">
                        <SlidersHorizontal size={14} /> Pilotage
                      </button>
                      <button type="button" onClick={() => openSupplier(supplier, "profile")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-[#007f8f]">
                        <Pencil size={14} /> Gérer la fiche
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (creatingSupplier) {
    return (
      <section className="mt-7 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
        <SupplierProfileEditor
          reference={null}
          writable={writable}
          onClose={() => setCreatingSupplier(false)}
          onSaved={() => window.location.reload()}
        />
      </section>
    );
  }

  // At this point the workspace can only render an existing supplier.
  // Keep the invariant explicit for TypeScript as selectedSupplierId and
  // creatingSupplier are independent pieces of React state.
  if (!selected) return null;

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
          <SupplierOverview supplier={selected} isStockman={isStockman} stockmanStatus={stockmanStatus} onNavigate={setTab} />
        ) : null}

        {tab === "profile" ? (
          <SupplierProfileEditor
            reference={selectedReference}
            writable={writable}
            fallbackName={selected.name}
            deleteConfirm={deleteConfirm}
            setDeleteConfirm={setDeleteConfirm}
            deletingSupplier={deletingSupplier}
            deleteError={deleteError}
            onDelete={() => void deleteSupplier()}
            onClose={() => setTab("overview")}
            onSaved={() => window.location.reload()}
          />
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
    { title: "Fiche fournisseur", description: "Logo, contacts et visibilité publique", tab: "profile", icon: Pencil },
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

function SupplierProfileEditor({
  reference,
  writable,
  fallbackName = "",
  onClose,
  onSaved,
  deleteConfirm,
  setDeleteConfirm,
  deletingSupplier,
  deleteError,
  onDelete,
}: {
  reference: SupplierReference | null;
  writable: boolean;
  fallbackName?: string;
  onClose: () => void;
  onSaved: () => void;
  deleteConfirm?: string;
  setDeleteConfirm?: (value: string) => void;
  deletingSupplier?: boolean;
  deleteError?: string;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<SupplierForm>(() => toSupplierForm(reference, fallbackName));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const protectedIdentity = Boolean(reference && isIntegrationSupplier(reference));

  useEffect(() => {
    setForm(toSupplierForm(reference, fallbackName));
    setMessage("");
  }, [reference, fallbackName]);

  async function save() {
    if (!writable) return;
    setBusy(true);
    setMessage("");
    const { id, ...body } = form;
    const nullable = ["logoUrl", "contactName", "email", "phone", "website", "averageLeadTime", "internalNotes", "homeHref"] as const;
    const payload: Record<string, unknown> = { ...body };
    for (const key of nullable) if (payload[key] === "") payload[key] = null;
    try {
      const response = await fetch(`/api/admin/suppliers${id ? `/${encodeURIComponent(id)}` : ""}`, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Enregistrement impossible.");
      setMessage("Fiche fournisseur enregistrée.");
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-50 disabled:bg-slate-100 disabled:text-slate-400";
  const labelClass = "text-xs font-black text-slate-700";

  return (
    <div className="p-5 md:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><Building2 size={21} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#007f8f]">{reference ? "Fiche fournisseur" : "Création"}</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{form.name || "Nouveau fournisseur"}</h3>
            <p className="mt-1 text-sm text-slate-500">Logo, coordonnées, visibilité sur l’accueil et informations publiques.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"><X size={15} /> Fermer</button>
      </div>

      {message ? <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{message}</div> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Nom<input disabled={!writable || busy} readOnly={protectedIdentity} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} /></label>
        <label className={labelClass}>Adresse publique<input disabled={!writable || busy} readOnly={Boolean(reference)} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={fieldClass} /></label>
        <label className={labelClass}>Logo (URL)<input disabled={!writable || busy} value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} className={fieldClass} /><AssetUploadButton scope="suppliers" disabled={!writable || busy} onUpload={(url) => setForm({ ...form, logoUrl: url })} />{form.logoUrl ? <img src={form.logoUrl} alt="Aperçu du logo" className="mt-2 h-24 w-full rounded-xl border border-slate-200 bg-white object-contain p-2" /> : null}</label>
        <label className={labelClass}>Contact<input disabled={!writable || busy} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={fieldClass} /></label>
        <label className={labelClass}>E-mail<input type="email" disabled={!writable || busy} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass} /></label>
        <label className={labelClass}>Téléphone<input disabled={!writable || busy} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass} /></label>
        <label className={labelClass}>Site web<input disabled={!writable || busy} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={fieldClass} /></label>
        <label className={labelClass}>Délai moyen<input disabled={!writable || busy} value={form.averageLeadTime} onChange={(e) => setForm({ ...form, averageLeadTime: e.target.value })} className={fieldClass} /></label>
        <label className={labelClass}>Lien au clic sur l’accueil<input disabled={!writable || busy} value={form.homeHref} onChange={(e) => setForm({ ...form, homeHref: e.target.value })} className={fieldClass} /></label>
        <label className={labelClass}>Ordre sur l’accueil<input type="number" min={0} disabled={!writable || busy} value={form.homeOrder} onChange={(e) => setForm({ ...form, homeOrder: Number(e.target.value) })} className={fieldClass} /></label>
        <label className={`${labelClass} md:col-span-2`}>Notes internes<textarea disabled={!writable || busy} rows={4} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} className={fieldClass} /></label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-700"><input type="checkbox" disabled={!writable || busy} checked={form.homeVisible} onChange={(e) => setForm({ ...form, homeVisible: e.target.checked })} />Afficher sur l’accueil</label>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-700"><input type="checkbox" disabled={!writable || busy} checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Fournisseur actif</label>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Annuler</button>
        {writable ? <button type="button" disabled={busy || !form.name.trim() || !form.slug.trim()} onClick={() => void save()} className="rounded-xl bg-[#007f8f] px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-900/10 disabled:opacity-40">{busy ? "Enregistrement…" : reference ? "Enregistrer la fiche" : "Créer le fournisseur"}</button> : null}
      </div>

      {reference && onDelete && setDeleteConfirm ? (
        <details className="mt-6 rounded-[1.3rem] border border-red-200 bg-red-50/60">
          <summary className="cursor-pointer px-5 py-4 text-xs font-black text-red-800">Zone sensible · supprimer le fournisseur</summary>
          <div className="border-t border-red-200 p-5">
            <p className="text-xs font-bold leading-5 text-red-700">La suppression est refusée tant qu’un produit est rattaché. Pour confirmer, tapez exactement <span className="font-black">{form.name}</span>.</p>
            {deleteError ? <div className="mt-3 rounded-xl bg-white px-4 py-3 text-xs font-bold text-red-700">{deleteError}</div> : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input value={deleteConfirm || ""} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={`Taper ${form.name}`} className="min-w-0 flex-1 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold outline-none" />
              <button type="button" onClick={onDelete} disabled={deletingSupplier || (deleteConfirm || "").trim() !== form.name.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40"><Trash2 size={16} /> {deletingSupplier ? "Suppression…" : "Supprimer le fournisseur"}</button>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function toSupplierForm(reference: SupplierReference | null, fallbackName = ""): SupplierForm {
  if (!reference) return { ...emptySupplierForm, name: fallbackName };
  return {
    id: reference.id,
    name: reference.name || fallbackName,
    slug: reference.slug || "",
    logoUrl: reference.logoUrl || "",
    contactName: reference.contactName || "",
    email: reference.email || "",
    phone: reference.phone || "",
    website: reference.website || "",
    averageLeadTime: reference.averageLeadTime || "",
    internalNotes: reference.internalNotes || "",
    homeHref: reference.homeHref || "",
    homeOrder: Number(reference.homeOrder || 0),
    homeVisible: Boolean(reference.homeVisible),
    isActive: reference.isActive !== false,
  };
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
