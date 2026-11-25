"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StockmanDocumentaryStaging from "./StockmanDocumentaryStaging";
import StockmanReviewV8 from "./StockmanReviewV8";
import StockmanCommercialV10 from "./StockmanCommercialV10";
import StockmanCommercialV16 from "./StockmanCommercialV16";
import StockmanImportPreviewV17 from "./StockmanImportPreviewV17";
import StockmanPilotAfDraftsV18 from "./StockmanPilotAfDraftsV18";
import StockmanBulkDraftsV19 from "./StockmanBulkDraftsV19";
import StockmanGroupedProductsV20 from "./StockmanGroupedProductsV20";
import StockmanImagesV21 from "./StockmanImagesV21";
import StockmanReadinessV22 from "./StockmanReadinessV22";
import StockmanContentV27 from "./StockmanContentV27";
import StockmanCategoriesV28 from "./StockmanCategoriesV28";

type PublicationRow = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  status: string;
  purchasePriceHT: number | null;
  productPriceHT: number;
  stock: number;
  stockOnRequest: boolean;
  priceOnRequest: boolean;
  hasImage: boolean;
  hasDocument: boolean;
  hasFeatures: boolean;
  blockers: string[];
  warnings: string[];
};
type PublicationAudit = { rows: PublicationRow[]; total: number };
type PriceRow = { reference: string; status: string; salePriceHt: number; catalogPriceHt: number | null };
type PriceAudit = { rows: PriceRow[] };
type WatchSnapshot = {
  savedAt?: string;
  done?: number;
  total?: number;
  finished?: boolean;
  changes?: Array<{ reference: string }>;
  newProducts?: Array<{ reference: string }>;
  issues?: Array<{ page: number }>;
};
type Inventory = {
  checkedAt: string;
  products: Array<{ id: string; code: string; supplierCode: string | null; publicationStatus: string }>;
  variants: Array<{ id: string; code: string; supplierCode: string | null; productId: string }>;
  index: Array<{ reference: string; productId: string | null; targetId: string | null; targetType: string | null; isActive: boolean; lastMatchStatus: string | null }>;
  counts: { products: number; variants: number; references: number };
};
type ComparisonStatus = "PRESENT" | "INDEX_ONLY" | "ABSENT" | "DOUBLON" | "UNVERIFIED";
type LocalArticle = { reference?: unknown; designation?: unknown };
type Qualification = "A_QUALIFIER" | "PREPARER" | "RAPPROCHER" | "IGNORER";
type LocalFiche = {
  title?: unknown;
  subcategory?: unknown;
  sourceUrl?: unknown;
  description?: unknown;
  technicalSections?: unknown;
  pdfs?: unknown;
  articles?: unknown;
};
type LocalScan = { fiches?: unknown; date?: unknown };
type ScanReference = { reference: string; designation: string; subcategory: string; title: string; sourceUrl: string; hasDescription: boolean; hasTechnical: boolean; hasPdf: boolean; description: string; technicalSections: unknown[]; pdfs: Array<{ text: string; url: string }> };
const safeString = (value: unknown) => typeof value === "string" ? value.trim() : "";
const normalizeRef = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
function scanReferences(payload: unknown): { references: ScanReference[]; fiches: number; date: string } {
  if (!isRecord(payload) || !Array.isArray((payload as LocalScan).fiches)) throw new Error("Ce fichier n'est pas un export de scan STOCKMAN valide (fiches manquantes).");
  const fiches = (payload as LocalScan).fiches as unknown[];
  if (fiches.length > 10000) throw new Error("Export trop volumineux pour ce contrôle local.");
  const references: ScanReference[] = [];
  for (const fiche of fiches) {
    if (!isRecord(fiche)) continue;
    const f = fiche as LocalFiche;
    const articles = Array.isArray(f.articles) ? f.articles : [];
    const hasPdf = Array.isArray(f.pdfs) && f.pdfs.some((pdf: unknown) => isRecord(pdf) && typeof pdf.url === "string" && Boolean(pdf.url.trim()));
    const hasTechnical = Array.isArray(f.technicalSections) && f.technicalSections.length > 0;
    for (const article of articles) {
      if (!isRecord(article)) continue;
      const a = article as LocalArticle;
      const reference = safeString(a.reference);
      if (!reference) continue;
      references.push({
        reference, designation: safeString(a.designation), subcategory: safeString(f.subcategory), title: safeString(f.title),
        sourceUrl: safeString(f.sourceUrl), hasDescription: Boolean(safeString(f.description)), hasTechnical, hasPdf,
        description: safeString(f.description),
        technicalSections: Array.isArray(f.technicalSections) ? f.technicalSections.filter((part: unknown) => typeof part === "string" || Array.isArray(part) || isRecord(part)) : [],
        pdfs: Array.isArray(f.pdfs) ? f.pdfs.filter((pdf: unknown) => isRecord(pdf) && typeof pdf.url === "string" && /^https?:\/\//i.test(pdf.url)).map((pdf: Record<string, unknown>) => ({ text: safeString(pdf.text), url: safeString(pdf.url) })) : [],
      });
    }
  }
  return { references, fiches: fiches.length, date: safeString((payload as LocalScan).date) };
}
const WATCH_KEY = "oyste-stockman-watch-v274";
const euro = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value)
    : "A confirmer";
const norm = (value: string) => value.trim().toUpperCase();
// Escapes CSV cells and prevents formula execution when an audit is opened in Excel.
const safeCsv = (value: string) => {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};


export default function StockmanPilotageCard() {
  const [rows, setRows] = useState<PublicationRow[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [watch, setWatch] = useState<WatchSnapshot | null>(null);
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [localScan, setLocalScan] = useState<{ references: ScanReference[]; fiches: number; date: string; filename: string } | null>(null);
  const [scanError, setScanError] = useState("");
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [inventoryError, setInventoryError] = useState("");
  const [scanFilter, setScanFilter] = useState("ALL");
  const [scanQuery, setScanQuery] = useState("");
  const [scanCategory, setScanCategory] = useState("ALL");
  // Local-only decisions: never saved to Neon or localStorage, and cleared when changing scans.
  const [qualification, setQualification] = useState<Record<string, Qualification>>({});
  const loadLocalScan = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setScanError("");
    if (file.size > 25 * 1024 * 1024) { setScanError("Fichier trop volumineux (maximum 25 Mo)."); return; }
    try {
      const raw: unknown = JSON.parse(await file.text());
      const parsed = scanReferences(raw);
      setLocalScan({ ...parsed, filename: file.name });
      setScanFilter("ALL"); setScanCategory("ALL"); setScanQuery(""); setQualification({});
    } catch (reason) {
      setLocalScan(null); setQualification({});
      setScanError(reason instanceof Error ? reason.message : "Impossible de lire le fichier JSON.");
    }
  }, []);
  const localComparison = useMemo(() => {
    if (!localScan) return null;
    const byCode = new Map<string, Set<string>>();
    const byIndexedReference = new Map<string, Set<string>>();
    const productIds = new Set(inventory?.products.map((p) => p.id) || []);
    const variantIds = new Set(inventory?.variants.map((v) => v.id) || []);
    const insert = (table: Map<string, Set<string>>, reference: string | null | undefined, id: string) => {
      const key = normalizeRef(reference || "");
      if (!key) return;
      if (!table.has(key)) table.set(key, new Set());
      table.get(key)?.add(id);
    };
    for (const product of inventory?.products || []) {
      insert(byCode, product.code, `p:${product.id}`);
      insert(byCode, product.supplierCode, `p:${product.id}`);
    }
    for (const variant of inventory?.variants || []) {
      insert(byCode, variant.code, `v:${variant.id}`);
      insert(byCode, variant.supplierCode, `v:${variant.id}`);
    }
    for (const record of inventory?.index || []) {
      if (!record.isActive) continue;
      // An index link is only a confirmed catalog match if its target still exists.
      if (record.productId && productIds.has(record.productId)) insert(byCode, record.reference, `p:${record.productId}`);
      else if (record.targetId && record.targetType?.toLowerCase() === "product" && productIds.has(record.targetId)) insert(byCode, record.reference, `p:${record.targetId}`);
      else if (record.targetId && record.targetType?.toLowerCase() === "variant" && variantIds.has(record.targetId)) insert(byCode, record.reference, `v:${record.targetId}`);
      else insert(byIndexedReference, record.reference, `index:${record.reference}`);
    }
    const seen = new Map<string, number>();
    for (const item of localScan.references) seen.set(normalizeRef(item.reference), (seen.get(normalizeRef(item.reference)) || 0) + 1);
    const comparisons = localScan.references.map((item) => {
      const key = normalizeRef(item.reference);
      const matches = byCode.get(key);
      const duplicated = (seen.get(key) || 0) > 1 || (matches?.size || 0) > 1;
      const state: ComparisonStatus = !inventory ? "UNVERIFIED" : duplicated ? "DOUBLON" : matches?.size ? "PRESENT" : byIndexedReference.has(key) ? "INDEX_ONLY" : "ABSENT";
      return { ...item, state };
    });
    return {
      comparisons, unique: seen.size,
      duplicates: comparisons.filter((c) => c.state === "DOUBLON").length,
      missing: comparisons.filter((c) => c.state === "ABSENT").length,
      indexed: comparisons.filter((c) => c.state === "INDEX_ONLY").length,
      present: comparisons.filter((c) => c.state === "PRESENT").length,
      pdfs: comparisons.filter((c) => c.hasPdf).length,
      descriptions: comparisons.filter((c) => c.hasDescription).length,
    };
  }, [localScan, inventory]);
  const scanExceptions = useMemo(() => localComparison?.comparisons.filter((item) => item.state === "ABSENT" || item.state === "DOUBLON") || [], [localComparison]);
  const exportReconciliation = useCallback(() => {
    if (!localComparison || !inventory) return;
    const labels: Record<ComparisonStatus, string> = {
      PRESENT: "Produit Neon confirmé", INDEX_ONLY: "Index uniquement - rattachement à qualifier",
      ABSENT: "Non retrouvé - contrôler la référence", DOUBLON: "Doublon ou ambiguïté - contrôle manuel",
      UNVERIFIED: "Inventaire non vérifié",
    };
    const heading = ["Reference", "Sous-categorie", "Designation", "Etat", "Action recommandee", "Description detectee", "Zones techniques detectees", "Lien PDF detecte", "Source STOCKMAN"];
    const lines = [heading, ...localComparison.comparisons.map((item) => [
      item.reference, item.subcategory, item.designation || item.title, labels[item.state],
      item.state === "PRESENT" ? "Vérifier avant enrichissement" : item.state === "INDEX_ONLY" ? "Qualifier le rattachement dans Neon avant création" : item.state === "ABSENT" ? "Contrôler l'index et la source avant création" : "Résoudre le doublon avant import",
      item.hasDescription ? "Oui" : "Non", item.hasTechnical ? "Oui" : "Non", item.hasPdf ? "Oui" : "Non", item.sourceUrl,
    ])];
    const csv = "\uFEFF" + lines.map((line) => line.map(safeCsv).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `OYSTE-STOCKMAN-PLAN-RAPPROCHEMENT-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }, [localComparison, inventory]);
  const exportQualifiedDrafts = useCallback(() => {
    if (!inventory || !localScan || !localComparison) return;
    const drafts = localComparison.comparisons.filter((item) => qualification[normalizeRef(item.reference)] === "PREPARER" && item.state !== "PRESENT" && item.state !== "DOUBLON").map((item) => ({
      reference: item.reference,
      designation: item.designation,
      title: item.title,
      subcategory: item.subcategory,
      sourceUrl: item.sourceUrl,
      statusNeon: item.state,
      decision: "PREPARER_POUR_VALIDATION",
      description: item.description,
      technicalSections: item.technicalSections,
      pdfs: item.pdfs,
    }));
    // No price, stock, credentials, or commercialText are exported.
    const payload = { version: 1, source: "OYSTE-STOCKMAN-QUALIFICATION", extractedAt: localScan.date, createdAt: new Date().toISOString(),
      warning: "Brouillons uniquement. Aucune création Neon autorisée sans contrôle métier et commercial.", drafts };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `OYSTE-STOCKMAN-BROUILLONS-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }, [inventory, localScan, localComparison, qualification]);
  const exportQualification = useCallback(() => {
    if (!inventory || !localComparison) return;
    const heading = ["Reference", "Sous-categorie", "Designation", "Etat Neon", "Decision humaine", "Source STOCKMAN"];
    const lines = [heading, ...localComparison.comparisons.map((item) => [item.reference, item.subcategory, item.designation, item.state, qualification[normalizeRef(item.reference)] || "A_QUALIFIER", item.sourceUrl])];
    const blob = new Blob(["\uFEFF" + lines.map((line) => line.map(safeCsv).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `OYSTE-STOCKMAN-QUALIFICATIONS-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }, [inventory, localComparison, qualification]);
  // Batch actions only affect in-memory qualification decisions. Never write to Neon.
  const bulkPrepareIndexed = useCallback(() => {
    if (!inventory || !localComparison) return;
    setQualification((previous) => {
      const next = { ...previous };
      for (const item of localComparison.comparisons) {
        if (item.state === "INDEX_ONLY") next[normalizeRef(item.reference)] = "PREPARER";
      }
      return next;
    });
  }, [inventory, localComparison]);
  const bulkExcludeAbsent = useCallback(() => {
    if (!inventory || !localComparison) return;
    setQualification((previous) => {
      const next = { ...previous };
      for (const item of localComparison.comparisons) {
        if (item.state === "ABSENT") next[normalizeRef(item.reference)] = "IGNORER";
      }
      return next;
    });
  }, [inventory, localComparison]);
  const resetQualification = useCallback(() => setQualification({}), []);
  const excludedCount = localComparison?.comparisons.filter((item) => qualification[normalizeRef(item.reference)] === "IGNORER").length || 0;
  const preparedCount = localComparison?.comparisons.filter((item) => qualification[normalizeRef(item.reference)] === "PREPARER" && item.state !== "PRESENT" && item.state !== "DOUBLON").length || 0;
  const scanCategories = useMemo(() => [...new Set(localScan?.references.map((item) => item.subcategory).filter(Boolean) || [])].sort((a,b) => a.localeCompare(b,"fr")), [localScan]);
  const scanVisible = useMemo(() => (localComparison?.comparisons || []).filter((item) =>
    (scanCategory === "ALL" || item.subcategory === scanCategory) &&
    (scanFilter === "ALL" || item.state === scanFilter || (scanFilter === "MISSING_PDF" && !item.hasPdf)) &&
    (!scanQuery.trim() || (item.reference + " " + item.designation + " " + item.title).toUpperCase().includes(scanQuery.trim().toUpperCase()))
  ).slice(0, 150), [localComparison, scanCategory, scanFilter, scanQuery]);


  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [publicationResponse, priceResponse] = await Promise.all([
        fetch("/api/admin/suppliers/stockman/publication-audit", { cache: "no-store" }),
        fetch("/api/admin/suppliers/stockman/price-diagnostic", { cache: "no-store" }),
      ]);
      if (!publicationResponse.ok || !priceResponse.ok) {
        throw new Error("Un des audits STOCKMAN est indisponible. Vérifie ta session BO.");
      }
      const publication = (await publicationResponse.json()) as PublicationAudit;
      const diagnostic = (await priceResponse.json()) as PriceAudit;
      if (!Array.isArray(publication.rows) || !Array.isArray(diagnostic.rows)) {
        throw new Error("Réponse d'audit STOCKMAN inattendue.");
      }
      setRows(publication.rows);
      setPrices(diagnostic.rows);
      setCheckedAt(new Date().toLocaleString("fr-FR"));
      try {
        const raw = localStorage.getItem(WATCH_KEY);
        const snapshot = raw ? (JSON.parse(raw) as WatchSnapshot) : null;
        setWatch(snapshot && Array.isArray(snapshot.newProducts) && Array.isArray(snapshot.changes) ? snapshot : null);
      } catch {
        setWatch(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d'actualiser le pilotage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const refreshInventory = useCallback(async () => {
    setInventoryError("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/reference-inventory", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.products) || !Array.isArray(payload.variants) || !Array.isArray(payload.index)) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Inventaire Neon indisponible.");
      }
      setInventory(payload as Inventory);
    } catch (error) {
      setInventory(null);
      setInventoryError(error instanceof Error ? error.message : "Inventaire Neon indisponible.");
    }
  }, []);
  useEffect(() => { void refreshInventory(); }, [refreshInventory]);

  const categories = useMemo(() => [...new Set(rows.map((row) => row.category?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "fr")), [rows]);
  const index = useMemo(() => new Map(prices.map((row) => [norm(row.reference), row])), [prices]);
  const scoped = useMemo(() => rows.filter((row) => category === "ALL" || row.category === category), [rows, category]);
  const flagged = useCallback((row: PublicationRow) => {
    const p = index.get(norm(row.code));
    return row.blockers.length > 0 || row.warnings.length > 0 || !row.hasImage || !row.hasDocument || !row.hasFeatures || row.stockOnRequest || row.priceOnRequest || !row.purchasePriceHT || (p !== undefined && p.status !== "OK");
  }, [index]);
  const visible = useMemo(() => scoped.filter((row) => {
    if (filter === "ISSUES" && !flagged(row)) return false;
    if (filter === "MISSING_PDF" && row.hasDocument) return false;
    if (filter === "STOCK" && !row.stockOnRequest) return false;
    if (filter === "PRICE" && row.purchasePriceHT && !row.priceOnRequest && (index.get(norm(row.code))?.status ?? "OK") === "OK") return false;
    const search = query.trim().toUpperCase();
    return !search || row.code.toUpperCase().includes(search) || row.name.toUpperCase().includes(search);
  }).slice(0, 100), [scoped, filter, flagged, query, index]);
  const count = (condition: (row: PublicationRow) => boolean) => scoped.filter(condition).length;
  const priced = count((row) => row.purchasePriceHT !== null && row.purchasePriceHT > 0 && !row.priceOnRequest);
  const missingDoc = count((row) => !row.hasDocument);
  const stockUnknown = count((row) => row.stockOnRequest);
  const withIssues = count(flagged);
  const priceIssues = count((row) => row.priceOnRequest || !row.purchasePriceHT || (index.get(norm(row.code))?.status ?? "OK") !== "OK");

  return (
    <section className="rounded-[1.5rem] border border-cyan-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Pilotage STOCKMAN · lecture seule</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Contrôle catalogue en un coup d'œil</h3>
          <p className="mt-1 text-xs text-slate-600">Données OYSTE / Neon, sans synchronisation ni modification automatique. Transport inclus dans le prix fournisseur.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void refresh()} className="rounded-xl bg-cyan-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{loading ? "Chargement…" : "Actualiser les audits"}</button>
      </div>
      {error ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : null}
      {checkedAt ? <p className="mt-2 text-xs text-slate-500">Dernière consultation des audits : {checkedAt} (pas une date de synchronisation fournisseur)</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">Catégorie
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="max-w-full rounded-lg border p-2 text-sm">
            <option value="ALL">Toutes les catégories</option>
            {categories.map((name) => <option value={name} key={name}>{name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">Afficher
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border p-2 text-sm">
            <option value="ALL">Toutes les fiches</option><option value="ISSUES">Anomalies</option><option value="PRICE">Prix à contrôler</option><option value="STOCK">Stock à confirmer</option><option value="MISSING_PDF">PDF manquants</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">Référence ou nom
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher..." className="rounded-lg border p-2 text-sm" />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {[
          ["Fiches OYSTE", scoped.length], ["PA renseignés", priced], ["Prix à contrôler", priceIssues], ["Stock à confirmer", stockUnknown], ["PDF manquants", missingDoc],
        ].map(([label, count]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-2xl font-black">{count}</p><p className="text-xs text-slate-600">{label}</p></div>)}
      </div>
      <p className="mt-3 text-xs text-slate-600">{withIssues} fiche(s) avec au moins une alerte selon les audits existants. Les statistiques portent sur les fiches OYSTE retournées par l'audit, pas sur toutes les références possibles de l'intranet.</p>
      <div className="mt-4 rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
        <strong>Dernière veille navigateur :</strong> {watch?.savedAt ? new Date(watch.savedAt).toLocaleString("fr-FR") : "Aucune veille enregistrée sur ce navigateur"}
        {watch ? <span> · {watch.changes?.length ?? 0} changement(s) de prix · {watch.newProducts?.length ?? 0} nouvelle(s) référence(s) · {watch.issues?.length ?? 0} problème(s) · {watch.finished ? "veille terminée" : "veille incomplète"}</span> : null}
        <p className="mt-1 text-slate-500">La veille est enregistrée localement dans le navigateur. Elle est globale, pas filtrée par catégorie ; lance-la dans l'onglet Synchronisation pour actualiser les nouveautés.</p>
      </div>
      <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
        <h4 className="text-sm font-black text-slate-950">Comparer une extraction STOCKMAN avec le BO</h4>
        <p className="mt-1 text-xs text-slate-700">Sélectionne <strong>donnees-privees-diables.json</strong> (ou le JSON d'une prochaine famille). Le fichier est lu uniquement dans ce navigateur : aucun envoi, stockage ou import dans Neon. Les textes commerciaux et prix éventuels ne sont pas affichés.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-700">Choisir l'extraction JSON
            <input type="file" accept=".json,application/json" className="mt-1 block max-w-full text-xs" onChange={(event) => void loadLocalScan(event.target.files?.[0])} />
          </label>
          {localScan ? <button type="button" className="rounded-lg border bg-white px-3 py-2 text-xs font-bold" onClick={() => { setLocalScan(null); setScanError(""); setQualification({}); }}>Effacer la comparaison</button> : null}
        </div>
        {scanError ? <p role="alert" className="mt-2 text-xs text-red-700">{scanError}</p> : null}
        {localScan && localComparison ? <>
          <p className="mt-3 text-xs text-slate-600"><strong>{localScan.filename}</strong> · {localScan.fiches} fiches source · {localComparison.unique} références distinctes · extraction {localScan.date || "non datée"} · inventaire Neon : {inventory ? `${inventory.counts.products} produits, ${inventory.counts.variants} variantes, ${inventory.counts.references} références indexées` : "non chargé"}.</p>
          <p className="mt-1 text-xs text-amber-800">« Absent de Neon » signifie aucune correspondance trouvée dans les produits, variantes ou index STOCKMAN actuellement chargés. Cela ne suffit pas à autoriser une création automatique. Les 76 références supplémentaires de l'export catalogue local ne figurent pas dans ce scan.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <button type="button" onClick={() => void refreshInventory()} className="rounded-lg border bg-white px-3 py-1 font-bold">Actualiser l'inventaire Neon</button>
            {inventory ? <span>Inventaire complet consulté : {new Date(inventory.checkedAt).toLocaleString("fr-FR")}</span> : <span>Inventaire Neon non chargé : aucun statut d'absence fiable.</span>}
          </div>
          {inventoryError ? <p role="alert" className="mt-2 text-xs text-red-700">{inventoryError}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
            {[["Présentes dans Neon", localComparison.present], ["Indexées seulement",localComparison.indexed], ["Absentes de Neon",localComparison.missing],["Ambiguës / doublons",localComparison.duplicates],["Descriptions",localComparison.descriptions],["Liens PDF",localComparison.pdfs]].map(([label,value]) => <div key={label} className="rounded-lg bg-white p-3"><p className="text-xl font-black">{value}</p><p className="text-xs text-slate-600">{label}</p></div>)}
          </div>
          {inventory ? <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportReconciliation} className="rounded-lg bg-cyan-800 px-3 py-2 text-xs font-bold text-white">Exporter le plan de rapprochement (CSV)</button>
            <span className="text-xs text-slate-600">94 lignes de référence maximum selon le scan, sans prix ni données commerciales confidentielles. Aucune écriture dans Neon.</span>
          </div> : null}
          {inventory ? <div className="mt-3 rounded-lg border border-cyan-200 bg-white p-3">
            <p className="text-xs font-bold text-slate-900">Qualification manuelle des références · aucune écriture Neon</p>
            <p className="mt-1 text-xs text-slate-600">Choisis une action par référence dans le tableau. « Préparer fiche » construit un brouillon documentaire sans prix ni stock ; il ne publie aucun produit. Les décisions restent dans cet onglet tant que tu ne les exportes pas.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={bulkPrepareIndexed} disabled={localComparison.indexed === 0} className="rounded-lg bg-cyan-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Préparer les {localComparison.indexed} indexées</button>
              <button type="button" onClick={bulkExcludeAbsent} disabled={localComparison.missing === 0} className="rounded-lg border border-amber-500 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50">Exclure les {localComparison.missing} non retrouvées</button>
              <button type="button" onClick={resetQualification} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">Réinitialiser la sélection</button>
              <span className="text-xs text-slate-600">{preparedCount} préparée(s) · {excludedCount} ignorée(s). Actions appliquées à toute l'extraction, même si un filtre est actif.</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={exportQualification} className="rounded-lg border border-cyan-700 px-3 py-2 text-xs font-bold text-cyan-900">Exporter décisions (CSV)</button>
              <button type="button" onClick={exportQualifiedDrafts} disabled={preparedCount === 0} className="rounded-lg bg-cyan-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Exporter {preparedCount} brouillon(s) JSON</button>
            </div>
          </div> : null}
          {scanExceptions.length > 0 ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-950">Références à vérifier en priorité ({scanExceptions.length})</p>
            <div className="mt-2 flex flex-wrap gap-2">{scanExceptions.slice(0, 20).map((item, idx) =>
              <button key={`${item.reference}-${idx}`} type="button" className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold" title={item.designation || item.title}
                onClick={() => { setScanFilter(item.state); setScanCategory("ALL"); setScanQuery(item.reference); }}>{item.reference} · {item.state === "ABSENT" ? "non retrouvée" : "ambiguë"}</button>)}</div>
            <p className="mt-2 text-xs text-amber-900">« Non retrouvée » n'autorise pas une création : vérifier la référence sur STOCKMAN et dans les index avant toute écriture.</p>
          </div> : null}
          {inventory && localComparison.indexed > 0 ? <p className="mt-3 text-xs text-slate-700"><strong>Prochaine étape :</strong> qualifier les {localComparison.indexed} références « indexées seulement » avant de rattacher descriptions et PDF. Leur présence dans l'index ne prouve pas l'existence d'un produit publiable.</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <select aria-label="Sous-famille extraite" value={scanCategory} onChange={(event) => setScanCategory(event.target.value)} className="rounded-lg border p-2 text-xs"><option value="ALL">Toutes les sous-familles</option>{scanCategories.map((name) => <option key={name} value={name}>{name}</option>)}</select>
            <select aria-label="État de comparaison" value={scanFilter} onChange={(event) => setScanFilter(event.target.value)} className="rounded-lg border p-2 text-xs"><option value="ALL">Tous les états</option><option value="PRESENT">Présentes dans Neon</option><option value="INDEX_ONLY">Indexées seulement</option><option value="ABSENT">Absentes de Neon</option><option value="DOUBLON">Ambiguës / doublons</option><option value="UNVERIFIED">Inventaire non chargé</option><option value="MISSING_PDF">Sans PDF détecté</option></select>
            <input aria-label="Recherche dans l'extraction" value={scanQuery} onChange={(event) => setScanQuery(event.target.value)} placeholder="Référence ou produit" className="rounded-lg border p-2 text-xs" />
          </div>
          <div className="mt-3 max-h-96 overflow-auto rounded-lg border bg-white">
            <table className="w-full min-w-[720px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Référence STOCKMAN</th><th className="p-2">Sous-famille</th><th className="p-2">Désignation</th><th className="p-2">Documents source</th><th className="p-2">BO / Neon</th><th className="p-2">Qualification</th></tr></thead><tbody>{scanVisible.map((item, i) => <tr key={`${item.reference}-${i}`} className="border-t"><td className="p-2 font-semibold">{item.reference}</td><td className="p-2">{item.subcategory}</td><td className="p-2">{item.designation || item.title}</td><td className="p-2">{item.hasDescription ? "Description ✓" : "Description —"} · {item.hasPdf ? "PDF ✓" : "PDF —"}</td><td className="p-2">{item.state === "PRESENT" ? "Présent dans Neon" : item.state === "INDEX_ONLY" ? "Dans l'index seulement" : item.state === "ABSENT" ? "Absent de Neon" : item.state === "UNVERIFIED" ? "Neon non vérifié" : "Ambiguïté / doublon"}</td><td className="p-2"><select aria-label={`Qualification ${item.reference}`} value={qualification[normalizeRef(item.reference)] || "A_QUALIFIER"} disabled={!inventory || item.state === "PRESENT" || item.state === "DOUBLON"} onChange={(event) => setQualification((previous) => ({ ...previous, [normalizeRef(item.reference)]: event.target.value as Qualification }))} className="rounded border bg-white p-1 text-xs"><option value="A_QUALIFIER">À qualifier</option><option value="PREPARER">Préparer fiche</option><option value="RAPPROCHER">Rattachement manuel</option><option value="IGNORER">Ignorer</option></select></td></tr>)}</tbody></table>
          </div>
          {scanVisible.length === 150 ? <p className="mt-2 text-xs text-slate-600">Liste limitée à 150 lignes : affine les filtres.</p> : null}
        </> : null}
      </div>
      <StockmanDocumentaryStaging inventory={inventory} />
      <StockmanReviewV8 />
      <StockmanCommercialV10 />
      <StockmanCommercialV16 />
      <StockmanImportPreviewV17 />
      <StockmanBulkDraftsV19 />
      <StockmanGroupedProductsV20 />
      <StockmanImagesV21 />
      <StockmanReadinessV22 />
      <StockmanContentV27 />
      <StockmanCategoriesV28 />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-xs">
          <thead><tr className="border-b text-slate-500"><th className="p-2">Référence</th><th className="p-2">Produit</th><th className="p-2">PA HT</th><th className="p-2">PV HT</th><th className="p-2">Stock</th><th className="p-2">Fiche</th><th className="p-2">État</th></tr></thead>
          <tbody>{visible.map((row) => <tr key={row.id} className="border-b border-slate-100">
            <td className="p-2 font-bold">{row.code}</td><td className="p-2">{row.name}</td><td className="p-2">{euro(row.purchasePriceHT)}</td><td className="p-2">{row.priceOnRequest ? "Nous consulter" : euro(row.productPriceHT)}</td><td className="p-2">{row.stockOnRequest ? "À confirmer" : row.stock}</td><td className="p-2">{row.hasDocument ? "PDF ✓" : "PDF absent"} · {row.hasImage ? "Photo ✓" : "Photo absente"}</td><td className="p-2">{flagged(row) ? "À contrôler" : row.status}</td>
          </tr>)}</tbody>
        </table>
        {!loading && visible.length === 0 ? <p className="p-3 text-sm text-slate-500">Aucune fiche dans cette sélection.</p> : null}
        {visible.length === 100 ? <p className="p-2 text-xs text-slate-500">Affichage limité aux 100 premières fiches : affine le filtre pour en voir d'autres.</p> : null}
      </div>
    </section>
  );
}
