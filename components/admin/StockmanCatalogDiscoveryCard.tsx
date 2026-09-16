"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Link2,
  LoaderCircle,
  PackageSearch,
  RefreshCcw,
  ScanSearch,
  Sparkles,
  TriangleAlert,
  ClipboardCheck,
  Database,
} from "lucide-react";
import type {
  StockmanCatalogDiscovery,
  StockmanCatalogMatch,
  StockmanDiscoveryJobProgress,
  StockmanDiscoveryJobStatus,
  StockmanMatchMethod,
  StockmanMissingKind,
  StockmanCatalogueState,
  StockmanUnresolvedAudit,
  StockmanDuplicateStructureAudit,
} from "@/lib/suppliers/stockman/types";

type MissingFilter = `missing:${StockmanMissingKind}`;
type CatalogueFilter = `catalogue:${StockmanCatalogueState}`;
type Filter = "all" | StockmanCatalogMatch["status"] | MissingFilter | CatalogueFilter;

export default function StockmanCatalogDiscoveryCard({ enabled }: { enabled: boolean }) {
  const [seedUrl, setSeedUrl] = useState("https://www.stockman.fr/");
  const [scan, setScan] = useState<StockmanCatalogDiscovery | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<StockmanDiscoveryJobProgress | null>(null);
  const activeJobRef = useRef<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [preparingImports, setPreparingImports] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());
  const [rebuildAudit, setRebuildAudit] = useState<any>(null);
  const [auditingRebuild, setAuditingRebuild] = useState(false);
  const [cleanRebuild, setCleanRebuild] = useState<any>(null);
  const [checkingCleanRebuild, setCheckingCleanRebuild] = useState(false);
  const [executingCleanRebuild, setExecutingCleanRebuild] = useState(false);
  const [rebuildConfirmation, setRebuildConfirmation] = useState("");
  const [livingRebuild, setLivingRebuild] = useState<any>(null);
  const [livingDiagnostic, setLivingDiagnostic] = useState<any>(null);
  const [remainingDiagnostic, setRemainingDiagnostic] = useState<any>(null);
  const [diagnosingRemaining, setDiagnosingRemaining] = useState(false);
  const [diagnosingLivingRebuild, setDiagnosingLivingRebuild] = useState(false);
  const [checkingLivingRebuild, setCheckingLivingRebuild] = useState(false);
  const [executingLivingRebuild, setExecutingLivingRebuild] = useState(false);
  const [classificationAudit, setClassificationAudit] = useState<any>(null);
  const [auditingClassification, setAuditingClassification] = useState(false);
  const [breadcrumbAudit, setBreadcrumbAudit] = useState<any>(null);
  const [auditingBreadcrumbs, setAuditingBreadcrumbs] = useState(false);
  const [breadcrumbCategoryOptions, setBreadcrumbCategoryOptions] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [manualCategorySelection, setManualCategorySelection] = useState<Record<string, string>>({});
  const [savingManualCategory, setSavingManualCategory] = useState<string | null>(null);
  const [creatingMissingTaxonomy, setCreatingMissingTaxonomy] = useState(false);
  const [breadcrumbDebug, setBreadcrumbDebug] = useState<any>(null);
  const [debuggingBreadcrumb, setDebuggingBreadcrumb] = useState(false);
  const [breadcrumbPreviewSelected, setBreadcrumbPreviewSelected] = useState<Set<string>>(new Set());
  const [breadcrumbPreviewFilter, setBreadcrumbPreviewFilter] = useState<"all" | "uncategorized" | "recategorized">("all");
  const [applyingBreadcrumbCategories, setApplyingBreadcrumbCategories] = useState(false);
  const [breadcrumbApplyConfirmation, setBreadcrumbApplyConfirmation] = useState("");
  const [unresolvedAudit, setUnresolvedAudit] = useState<StockmanUnresolvedAudit | null>(null);
  const [auditingUnresolved, setAuditingUnresolved] = useState(false);
  const [duplicateStructureAudit, setDuplicateStructureAudit] = useState<StockmanDuplicateStructureAudit | null>(null);
  const [auditingDuplicateStructure, setAuditingDuplicateStructure] = useState(false);
  const [restoringPersistentAudit, setRestoringPersistentAudit] = useState(true);
  const [persistentAuditDate, setPersistentAuditDate] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) { setRestoringPersistentAudit(false); return; }
    let cancelled = false;
    (async () => {
      try {
        let lastError = "";
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          const response = await fetch(`/api/admin/suppliers/stockman/discovery?latest=1&_attempt=${attempt}`, { cache: "no-store" });
          const payload = await response.json().catch(() => ({}));
          if (cancelled) return;
          if (response.ok && payload.restored && payload.scan) {
            setScan(payload.scan as StockmanCatalogDiscovery);
            setUnresolvedAudit((payload.unresolvedAudit || null) as StockmanUnresolvedAudit | null);
            setDuplicateStructureAudit((payload.duplicateStructureAudit || null) as StockmanDuplicateStructureAudit | null);
            setPersistentAuditDate(payload.snapshotFinishedAt || null);
            setSelected(new Set(payload.scan.matches.filter((item: StockmanCatalogMatch) => item.status === "matched").map((item: StockmanCatalogMatch) => item.reference)));
            const purged = Array.isArray(payload.ghostReferencesRemoved) ? payload.ghostReferencesRemoved.length : 0;
            setMessage(`Audit STOCKMAN restauré depuis PostgreSQL : ${payload.scan.totals.discovered} référence(s).${purged ? ` ${purged} référence(s) fantôme(s) purgée(s).` : ""} Aucun rescan intranet nécessaire.`);
            return;
          }
          lastError = payload.message || (payload.restored === false ? "Aucun snapshot persistant trouvé." : `HTTP ${response.status}`);
          if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1200));
        }
        if (!cancelled) setMessage(`Restauration PostgreSQL indisponible après 3 tentatives : ${lastError} Ne relancez pas l’audit complet avant vérification.`);
      } catch (error) {
        if (!cancelled) setMessage(`Restauration PostgreSQL impossible : ${error instanceof Error ? error.message : "erreur inconnue"}. Ne relancez pas l’audit complet avant vérification.`);
      } finally {
        if (!cancelled) setRestoringPersistentAudit(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  const visible = useMemo(() => {
    if (!scan) return [];
    if (filter === "all") return scan.matches;
    if (filter.startsWith("missing:")) {
      const kind = filter.slice("missing:".length) as StockmanMissingKind;
      return scan.matches.filter((item) => item.status === "missing" && item.missingKind === kind);
    }
    if (filter.startsWith("catalogue:")) {
      const state = filter.slice("catalogue:".length) as StockmanCatalogueState;
      return scan.matches.filter((item) => item.catalogueState === state);
    }
    return scan.matches.filter((item) => item.status === filter);
  }, [scan, filter]);

  const breadcrumbChangePreview = useMemo(() => {
    const rows = Array.isArray(breadcrumbAudit?.rows) ? breadcrumbAudit.rows : [];
    const normalizePath = (value: unknown) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\\/]+/g, "\\")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const categoryRows = rows.filter(
      (row: any) => row.breadcrumbKind === "category" && row.proposedCategory && !row.error,
    );
    const changed = categoryRows.filter(
      (row: any) => normalizePath(row.currentCategory) !== normalizePath(row.proposedCategory),
    );
    const unchanged = categoryRows.filter(
      (row: any) => normalizePath(row.currentCategory) === normalizePath(row.proposedCategory),
    );

    return {
      categoryRows,
      changed,
      unchanged,
      accessories: rows.filter((row: any) => row.breadcrumbKind === "accessory" && !row.error),
      discontinued: rows.filter((row: any) => row.breadcrumbKind === "discontinued" && !row.error),
      unresolved: rows.filter((row: any) => row.breadcrumbKind === "review" && !row.error),
      errors: rows.filter((row: any) => row.error),
    };
  }, [breadcrumbAudit]);

  const filteredBreadcrumbChanges = useMemo(() => {
    if (breadcrumbPreviewFilter === "uncategorized") {
      return breadcrumbChangePreview.changed.filter((row: any) => !String(row.currentCategory || "").trim());
    }
    if (breadcrumbPreviewFilter === "recategorized") {
      return breadcrumbChangePreview.changed.filter((row: any) => Boolean(String(row.currentCategory || "").trim()));
    }
    return breadcrumbChangePreview.changed;
  }, [breadcrumbChangePreview.changed, breadcrumbPreviewFilter]);

  useEffect(() => {
    if (!breadcrumbAudit?.finished) return;
    setBreadcrumbPreviewSelected(new Set(breadcrumbChangePreview.changed.map((row: any) => String(row.id))));
    setBreadcrumbPreviewFilter("all");
  }, [breadcrumbAudit?.finished, breadcrumbChangePreview.changed.length]);

  function toggleBreadcrumbPreviewRow(id: string) {
    setBreadcrumbPreviewSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisibleBreadcrumbChanges() {
    setBreadcrumbPreviewSelected((current) => {
      const next = new Set(current);
      filteredBreadcrumbChanges.forEach((row: any) => next.add(String(row.id)));
      return next;
    });
  }

  function deselectVisibleBreadcrumbChanges() {
    setBreadcrumbPreviewSelected((current) => {
      const next = new Set(current);
      filteredBreadcrumbChanges.forEach((row: any) => next.delete(String(row.id)));
      return next;
    });
  }

  async function applySelectedBreadcrumbCategories() {
    const selectedRows = breadcrumbChangePreview.changed.filter((row: any) => breadcrumbPreviewSelected.has(String(row.id)));
    if (!selectedRows.length) return;
    const expectedConfirmation = `APPLIQUER ${selectedRows.length}`;
    if (breadcrumbApplyConfirmation.trim() !== expectedConfirmation) {
      setMessage(`Confirmation attendue : ${expectedConfirmation}`);
      return;
    }

    setApplyingBreadcrumbCategories(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/catalog-classification-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_category_selection",
          confirmation: breadcrumbApplyConfirmation.trim(),
          changes: selectedRows.map((row: any) => ({
            id: String(row.id),
            currentCategory: row.currentCategory || "",
            proposedCategory: row.proposedCategory,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(payload.rejected)
          ? ` ${payload.rejected.slice(0, 3).map((item: any) => `${item.id}: ${item.reason}`).join(" · ")}`
          : "";
        throw new Error((payload.message || "Application des catégories impossible.") + details);
      }
      setMessage(`${payload.applied || selectedRows.length} catégorie(s) appliquée(s). Relance maintenant l'audit breadcrumb pour le contrôle post-application.`);
      setBreadcrumbApplyConfirmation("");
      setBreadcrumbPreviewSelected(new Set());
      setBreadcrumbAudit(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Application des catégories impossible.");
    } finally {
      setApplyingBreadcrumbCategories(false);
    }
  }

  async function runRebuildAudit() {
    setAuditingRebuild(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/rebuild-audit", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Audit rebuild Stockman impossible.");
      setRebuildAudit(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audit rebuild Stockman impossible.");
    } finally {
      setAuditingRebuild(false);
    }
  }

  async function checkCleanRebuild() {
    setCheckingCleanRebuild(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/clean-rebuild", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Préflight clean rebuild impossible.");
      setCleanRebuild(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Préflight clean rebuild impossible.");
    } finally {
      setCheckingCleanRebuild(false);
    }
  }

  async function executeCleanRebuild() {
    if (rebuildConfirmation !== "REBUILD STOCKMAN") return;
    setExecutingCleanRebuild(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/clean-rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute", confirmation: rebuildConfirmation }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Clean rebuild impossible.");
      setMessage(payload.message);
      setCleanRebuild(null);
      setRebuildAudit(null);
      setScan(null);
      setSelected(new Set());
      setSelectedImports(new Set());
      setRebuildConfirmation("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Clean rebuild impossible.");
    } finally {
      setExecutingCleanRebuild(false);
    }
  }

  async function checkLivingRebuild() {
    setCheckingLivingRebuild(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/rebuild-living", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Contrôle reconstruction impossible.");
      setLivingRebuild(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Contrôle reconstruction impossible.");
    } finally {
      setCheckingLivingRebuild(false);
    }
  }

  async function diagnoseRemainingLivingRebuild() {
    setDiagnosingRemaining(true);
    setMessage(null);
    setRemainingDiagnostic(null);

    const allFamilies: any[] = [];
    const totals: Record<string, number> = {};
    let offset = 0;

    try {
      for (let batchIndex = 0; batchIndex < 100; batchIndex += 1) {
        const response = await fetch("/api/admin/suppliers/stockman/rebuild-living", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "diagnose_remaining",
            familyOffset: offset,
            familyLimit: 2,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Diagnostic des familles restantes impossible.");

        const families = Array.isArray(payload.families) ? payload.families : [];
        allFamilies.push(...families);

        for (const family of families) {
          let key = family.kind || "unknown";
          if (family.diagnosticError) key = "diagnostic_error";
          else if (family.kind === "product_page" && Number(family.acceptedCommercialRows || 0) > 0) key = "commercial_rows_readable";
          else if (family.followedDetailUrl && Number(family.acceptedCommercialRows || 0) === 0) key = "detail_followed_no_rows";
          else if (Number(family.acceptedCommercialRows || 0) === 0) key = "no_commercial_rows";
          totals[key] = (totals[key] || 0) + 1;
        }

        offset = Number(payload.nextOffset || offset + families.length);
        setRemainingDiagnostic({
          totalRemainingFamilies: Number(payload.totalRemainingFamilies || 0),
          totalRemainingReferences: Number(payload.totalRemainingReferences || 0),
          processedFamilies: allFamilies.length,
          patternCounts: { ...totals },
          families: [...allFamilies],
          finished: Boolean(payload.finished),
        });

        if (payload.finished || families.length === 0) break;
      }

      setMessage(`Diagnostic des familles restantes terminé : ${allFamilies.length} famille(s) relue(s), aucune modification en base.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Diagnostic des familles restantes impossible.");
    } finally {
      setDiagnosingRemaining(false);
    }
  }

  async function diagnoseBlockedLivingRebuild() {
    setDiagnosingLivingRebuild(true);
    setMessage(null);
    setLivingDiagnostic(null);

    const allFamilies: any[] = [];
    const totals: Record<string, number> = {};
    let offset = 0;

    try {
      for (let batchIndex = 0; batchIndex < 100; batchIndex += 1) {
        const response = await fetch("/api/admin/suppliers/stockman/rebuild-living", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "diagnose_blocked",
            familyOffset: offset,
            familyLimit: 2,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Diagnostic Stockman impossible.");

        const families = Array.isArray(payload.families) ? payload.families : [];
        allFamilies.push(...families);
        for (const family of families) {
          const key = family.pattern || "unknown";
          totals[key] = (totals[key] || 0) + 1;
        }

        offset = Number(payload.nextOffset || offset + families.length);
        setLivingDiagnostic({
          totalBlockedFamilies: Number(payload.totalBlockedFamilies || 0),
          totalBlockedReferences: Number(payload.totalBlockedReferences || 0),
          processedFamilies: allFamilies.length,
          patternCounts: { ...totals },
          families: [...allFamilies],
          finished: Boolean(payload.finished),
        });

        if (payload.finished || families.length === 0) break;
      }
      setMessage(`Diagnostic terminé : ${allFamilies.length} famille(s) analysée(s), sans aucune modification en base.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Diagnostic Stockman impossible.");
    } finally {
      setDiagnosingLivingRebuild(false);
    }
  }

  async function retryBlockedLivingRebuild() {
    setExecutingLivingRebuild(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/rebuild-living", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_blocked" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Réactivation des exceptions impossible.");
      setMessage(
        `${payload.resetReferences || 0} référence(s) réactivée(s). Le moteur reconstruit désormais uniquement depuis les vraies lignes commerciales Stockman ; les faux tokens historiques sont neutralisés.`,
      );
      await checkLivingRebuild();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Réactivation des exceptions impossible.");
    } finally {
      setExecutingLivingRebuild(false);
    }
  }

  async function executeLivingRebuild() {
    setExecutingLivingRebuild(true);
    setMessage(null);
    let totalFamilies = 0;
    let totalReferences = 0;
    let totalVariants = 0;
    let totalDuplicatesSkipped = 0;
    let totalIgnoredFamilies = 0;

    try {
      for (let batchIndex = 0; batchIndex < 100; batchIndex += 1) {
        const response = await fetch("/api/admin/suppliers/stockman/rebuild-living", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "execute_batch", familyLimit: 3 }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Reconstruction Stockman impossible.");

        totalFamilies += Number(payload.createdFamilies || 0);
        totalReferences += Number(payload.createdReferences || 0);
        totalVariants += Number(payload.createdVariants || 0);
        totalDuplicatesSkipped += Number(payload.duplicateCommercialRows || 0);
        totalIgnoredFamilies += Number(payload.ignoredFamilies || 0);

        setLivingRebuild((current: any) => ({
          ...(current || {}),
          builtFamilies: Number(current?.families || 0) - Number(payload.remainingFamilies || 0),
          remainingFamilies: Number(payload.remainingFamilies || 0),
          remainingReferences: Number(payload.remainingReferences || 0),
          lastErrors: payload.errors || [],
          lastSkipped: payload.skipped || [],
          blockedFamilies: Number(payload.blockedFamilies || 0),
          blockedReferences: Number(payload.blockedReferences || 0),
        }));

        if (Array.isArray(payload.errors) && payload.errors.length > 0 && Number(payload.createdFamilies || 0) === 0 && !Array.isArray(payload.skipped)) {
          throw new Error(payload.errors[0]?.message || "Une erreur bloque la reconstruction.");
        }

        if (payload.finished) {
          setMessage(
            `Rebuild final terminé : ${totalFamilies} famille(s) créée(s), ${totalReferences} référence(s), ${totalVariants} variante(s), ${totalDuplicatesSkipped} ligne(s) dupliquée(s) écartée(s) et ${totalIgnoredFamilies} page(s) de navigation ignorée(s).`,
          );
          await checkLivingRebuild();
          break;
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reconstruction Stockman impossible.");
    } finally {
      setExecutingLivingRebuild(false);
    }
  }

  async function runClassificationAudit() {
    setAuditingClassification(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/catalog-classification-audit", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Audit de classification Stockman impossible.");
      setClassificationAudit(payload);
      setMessage(
        `Audit ${payload.version || "V2.10.21.0"} terminé : ${payload.totals?.products || 0} produit(s) analysé(s), sans aucune modification en base.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audit de classification Stockman impossible.");
    } finally {
      setAuditingClassification(false);
    }
  }

  async function runBreadcrumbDebug() {
    setDebuggingBreadcrumb(true);
    setBreadcrumbDebug(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/catalog-classification-audit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "breadcrumb_debug", code: "LFC300" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Diagnostic DOM Stockman impossible.");
      setBreadcrumbDebug(payload);
      setMessage("Diagnostic DOM V2.10.21.0 terminé sur LFC300, sans modification en base.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Diagnostic DOM Stockman impossible.");
    } finally { setDebuggingBreadcrumb(false); }
  }

  async function loadBreadcrumbCategoryOptions() {
    const response = await fetch("/api/admin/suppliers/stockman/catalog-classification-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "category_options" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Impossible de charger les catégories OYSTE.");
    const categories = Array.isArray(payload.categories) ? payload.categories : [];
    setBreadcrumbCategoryOptions(categories);
    return categories;
  }

  async function createMissingStockmanTaxonomy() {
    setCreatingMissingTaxonomy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/catalog-classification-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure_missing_taxonomy" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Création de la taxonomie impossible.");
      setBreadcrumbCategoryOptions(Array.isArray(payload.categories) ? payload.categories : []);
      setMessage("V2.10.21.0 : les deux branches manquantes sont prêtes. Relance l’audit breadcrumb.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création de la taxonomie impossible.");
    } finally {
      setCreatingMissingTaxonomy(false);
    }
  }

  async function saveManualBreadcrumbCategory(row: any) {
    const categoryId = manualCategorySelection[row.id];
    if (!categoryId) {
      setMessage(`Choisis d’abord une catégorie OYSTE pour ${row.code}.`);
      return;
    }
    setSavingManualCategory(row.id);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/catalog-classification-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_category_override",
          productId: row.id,
          categoryId,
          breadcrumb: row.breadcrumb || [],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Enregistrement de l’override impossible.");

      setBreadcrumbAudit((current: any) => {
        if (!current) return current;
        const targetBreadcrumb = (row.breadcrumb || []).join(" > ");
        const updatedRows = (current.rows || []).map((item: any) => {
          if ((item.breadcrumb || []).join(" > ") !== targetBreadcrumb) return item;
          return {
            ...item,
            proposedCategory: payload.override?.categoryPath || item.proposedCategory,
            breadcrumbKind: "category",
            manualOverride: payload.override,
            reason: "override manuel OYSTE mémorisé pour ce breadcrumb",
          };
        });
        return {
          ...current,
          rows: updatedRows,
          proposed: updatedRows.filter((item: any) => item.breadcrumbKind === "category" && item.proposedCategory).length,
          unresolved: updatedRows.filter((item: any) => item.breadcrumbKind === "review" && !item.error).length,
        };
      });

      setMessage(`Override manuel enregistré pour ${row.code}. Il sera réutilisé pour ce breadcrumb Stockman.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement de l’override impossible.");
    } finally {
      setSavingManualCategory(null);
    }
  }

  async function runBreadcrumbAudit() {
    setAuditingBreadcrumbs(true);
    setMessage(null);
    try {
      await loadBreadcrumbCategoryOptions();
    } catch {
      // L’audit reste utilisable même si le sélecteur manuel ne peut pas être chargé.
    }
    const rows: any[] = [];
    let offset = 0;
    let total = 0;

    try {
      for (let batchIndex = 0; batchIndex < 80; batchIndex += 1) {
        const response = await fetch("/api/admin/suppliers/stockman/catalog-classification-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "breadcrumb_batch", offset, limit: 4 }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Audit breadcrumb Stockman impossible.");

        const batch = Array.isArray(payload.rows) ? payload.rows : [];
        rows.push(...batch);
        total = Number(payload.total || total || rows.length);
        offset = Number(payload.nextOffset || offset + batch.length);

        const proposed = rows.filter((row) => row.breadcrumbKind === "category" && row.proposedCategory).length;
        const accessories = rows.filter((row) => row.breadcrumbKind === "accessory").length;
        const discontinued = rows.filter((row) => row.breadcrumbKind === "discontinued").length;
        const unresolved = rows.filter((row) => row.breadcrumbKind === "review" && !row.error).length;
        const errors = rows.filter((row) => row.error).length;

        setBreadcrumbAudit({
          version: payload.version || "V2.10.21.0",
          processed: rows.length,
          total,
          proposed,
          accessories,
          discontinued,
          unresolved,
          errors,
          rows: [...rows],
          finished: Boolean(payload.finished),
        });

        if (payload.finished || batch.length === 0) break;
      }

      setMessage(
        `Audit breadcrumb V2.10.21.0 terminé : ${rows.length} fiche(s) Stockman lue(s), sans aucune modification en base.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audit breadcrumb Stockman impossible.");
    } finally {
      setAuditingBreadcrumbs(false);
    }
  }

  async function runScan() {
    setLoading(true);
    setMessage(null);
    setScan(null);
    setProgress(null);
    setSelected(new Set());
    setSelectedImports(new Set());
    setUnresolvedAudit(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", seedUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Le scan Stockman n’a pas pu démarrer.");

      const jobId = typeof payload.jobId === "string" ? payload.jobId : null;
      if (!jobId) throw new Error("Le serveur n’a pas retourné d’identifiant de scan.");
      activeJobRef.current = jobId;
      if (payload.progress) setProgress(payload.progress as StockmanDiscoveryJobProgress);

      while (activeJobRef.current === jobId) {
        await new Promise((resolve) => window.setTimeout(resolve, 2_000));
        const statusResponse = await fetch(`/api/admin/suppliers/stockman/discovery?jobId=${encodeURIComponent(jobId)}`, {
          method: "GET",
          cache: "no-store",
        });
        const statusPayload = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok) throw new Error(statusPayload.message || "Impossible de récupérer l’avancement du scan.");

        const job = statusPayload as StockmanDiscoveryJobStatus;
        setProgress(job.progress);

        if (job.status === "completed") {
          if (!job.result) throw new Error("Le scan est terminé mais aucun résultat n’a été retourné.");
          const discovery = job.result;
          setScan(discovery);
          setSelected(new Set(
            discovery.matches
              .filter((item) => item.status === "matched")
              .map((item) => item.reference),
          ));
          activeJobRef.current = null;
          break;
        }

        if (job.status === "failed") {
          activeJobRef.current = null;
          throw new Error(job.error || job.progress.message || "Le scan Stockman a échoué.");
        }
      }
    } catch (error) {
      activeJobRef.current = null;
      setMessage(error instanceof Error ? error.message : "Le scan Stockman a échoué.");
    } finally {
      setLoading(false);
    }
  }

  async function auditUnresolvedReferences() {
    if (!scan) return;
    const items = scan.matches.filter((item) => item.catalogueState !== "present");
    if (!items.length) {
      setMessage("Aucune référence non résolue à auditer.");
      return;
    }

    setAuditingUnresolved(true);
    setMessage(null);
    setUnresolvedAudit(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "audit_unresolved",
          items: items.map((item) => ({
            reference: item.reference,
            designation: item.designation,
            sourceUrl: item.sourceUrl,
            category: item.category,
            status: item.status,
            matchMethod: item.matchMethod,
            confidence: item.confidence,
            missingKind: item.missingKind,
            catalogueState: item.catalogueState,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Audit des références non résolues impossible.");
      setUnresolvedAudit(payload as StockmanUnresolvedAudit);
      setMessage(`Audit V2.12.6 terminé : ${payload.toImport || 0} à importer · ${payload.existing || 0} déjà existante(s) · ${payload.ambiguous || 0} ambiguë(s). Aucune modification effectuée.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audit des références non résolues impossible.");
    } finally {
      setAuditingUnresolved(false);
    }
  }

  async function auditDuplicateStructure() {
    if (!unresolvedAudit) return;
    const references = unresolvedAudit.rows
      .filter((row) => row.decision === "existing" && (row.candidates?.length ?? 0) > 1)
      .map((row) => row.reference);
    if (!references.length) {
      setMessage("Aucune référence multi-objet à contrôler.");
      return;
    }

    setAuditingDuplicateStructure(true);
    setMessage(null);
    setDuplicateStructureAudit(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "audit_duplicate_structure", references }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Audit structure des doublons impossible.");
      setDuplicateStructureAudit(payload as StockmanDuplicateStructureAudit);
      setMessage(
        `Audit structure V2.12.6 : ${payload.parentVariantStructures || 0} structure(s) parent/variante normale(s) · ${payload.realDuplicates || 0} vrai(s) doublon(s) · ${payload.sameProductDuplicates || 0} structure(s) inhabituelle(s). Aucune modification effectuée.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audit structure des doublons impossible.");
    } finally {
      setAuditingDuplicateStructure(false);
    }
  }

  async function linkSelected() {
    if (!scan) return;
    const matches = scan.matches
      .filter((item) => selected.has(item.reference)
        && item.status === "matched"
        && item.targetType
        && item.targetId
        && item.productId
        && item.targetReference)
      .map((item) => ({
        reference: item.reference,
        sourceUrl: item.sourceUrl,
        designation: item.designation,
        targetType: item.targetType!,
        targetId: item.targetId!,
        productId: item.productId!,
        targetReference: item.targetReference!,
      }));
    if (!matches.length) return;

    setLinking(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", matches }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Les associations n’ont pas pu être enregistrées.");
      const linked = payload.linked ?? 0;
      setMessage(`${linked} association(s) Stockman enregistrée(s). Actualisez ensuite le tableau de bord RC3.`);
      setScan((current) => current ? {
        ...current,
        matches: current.matches.map((item) => selected.has(item.reference) && item.status === "matched"
          ? { ...item, status: "already_linked" }
          : item),
        totals: {
          ...current.totals,
          matched: Math.max(0, current.totals.matched - linked),
          alreadyLinked: current.totals.alreadyLinked + linked,
        },
      } : current);
      setSelected(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Association impossible.");
    } finally {
      setLinking(false);
    }
  }

  async function prepareResolvedImports() {
    if (!unresolvedAudit) return;
    const rows = unresolvedAudit.rows.filter((row) => row.decision === "to_import");
    if (!rows.length) return;

    setPreparingImports(true);
    setMessage(null);
    try {
      let prepared = 0;
      const errors: Array<{ reference?: unknown; message?: unknown }> = [];
      const ignoredGhosts: string[] = [];
      // Lecture fournisseur par lots de 20 pour éviter un appel serveur trop long.
      for (let offset = 0; offset < rows.length; offset += 20) {
        const items = rows.slice(offset, offset + 20).map((row) => ({
          reference: row.reference,
          designation: row.designation,
          category: row.category,
          sourceUrl: row.sourceUrl,
        }));
        const response = await fetch("/api/admin/suppliers/stockman/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "prepare_import", items }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `Préparation impossible (lot ${Math.floor(offset / 20) + 1}).`);
        prepared += Number(payload.prepared ?? 0);
        if (Array.isArray(payload.errors)) errors.push(...payload.errors);
        if (Array.isArray(payload.ignoredGhosts)) ignoredGhosts.push(...payload.ignoredGhosts.map((value: unknown) => String(value)));
      }

      // Recharge immédiatement le snapshot PostgreSQL recalculé afin que les
      // références fantômes retirées disparaissent aussi des compteurs UI.
      if (ignoredGhosts.length) {
        const restoredResponse = await fetch("/api/admin/suppliers/stockman/discovery?latest=1", { cache: "no-store" });
        const restoredPayload = await restoredResponse.json().catch(() => ({}));
        if (restoredResponse.ok && restoredPayload.restored && restoredPayload.scan) {
          setScan(restoredPayload.scan as StockmanCatalogDiscovery);
          setUnresolvedAudit((restoredPayload.unresolvedAudit || null) as StockmanUnresolvedAudit | null);
          setDuplicateStructureAudit((restoredPayload.duplicateStructureAudit || null) as StockmanDuplicateStructureAudit | null);
          setPersistentAuditDate(restoredPayload.snapshotFinishedAt || null);
        }
      }

      const detail = errors.slice(0, 5).map((entry) => `${String(entry.reference ?? "?")}: ${String(entry.message ?? "Erreur")}`).join(" · ");
      const ghostDetail = ignoredGhosts.length ? ` · ${ignoredGhosts.length} référence(s) fantôme(s) retirée(s) : ${ignoredGhosts.slice(0, 8).join(", ")}` : "";
      setMessage(`${prepared}/${rows.length} référence(s) V2.12.6 préparée(s) en brouillon d’import${ghostDetail}${errors.length ? ` · ${errors.length} erreur(s) : ${detail}` : ""}. Aucun produit n’est encore publié.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Préparation des références résolues impossible.");
    } finally {
      setPreparingImports(false);
    }
  }

  async function prepareSelectedImports() {
    if (!scan) return;
    const items = scan.matches
      .filter((item) => selectedImports.has(item.reference) && item.catalogueState === "to_import")
      .slice(0, 20)
      .map((item) => ({
        reference: item.reference,
        designation: item.designation,
        category: item.category,
        sourceUrl: item.sourceUrl,
      }));
    if (!items.length) return;

    setPreparingImports(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare_import", items }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "La préparation des imports a échoué.");
      const prepared = Number(payload.prepared ?? 0);
      const preparedReferences = new Set<string>(
        Array.isArray(payload.preparedReferences) ? payload.preparedReferences.map((value: unknown) => String(value).trim().toUpperCase()) : [],
      );
      const importErrors = Array.isArray(payload.errors)
        ? payload.errors.filter((entry: unknown): entry is { reference?: unknown; message?: unknown } => Boolean(entry && typeof entry === "object"))
        : [];
      setScan((current) => current ? {
        ...current,
        matches: current.matches.map((item) => preparedReferences.has(item.reference.trim().toUpperCase())
          ? { ...item, importPrepared: true }
          : item),
        differential: current.differential ? {
          ...current.differential,
          preparedForImport: Number(payload.preparedTotal ?? current.differential.preparedForImport + prepared),
        } : current.differential,
      } : current);
      setSelectedImports(new Set());
      const errorDetails = importErrors
        .slice(0, 5)
        .map((entry: { reference?: unknown; message?: unknown }) => `${String(entry.reference ?? "?")}: ${String(entry.message ?? "Erreur inconnue")}`)
        .join(" · ");
      setMessage(
        prepared > 0
          ? `${prepared} brouillon(s) d’import préparé(s) depuis Stockman${importErrors.length ? ` · ${importErrors.length} erreur(s) : ${errorDetails}` : ""}. Aucun produit OYSTE n’a encore été créé.`
          : `Aucun brouillon créé${importErrors.length ? ` · ${importErrors.length} erreur(s) : ${errorDetails}` : ". Vérifiez les données Stockman."}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Préparation des imports impossible.");
    } finally {
      setPreparingImports(false);
    }
  }

  function selectVisibleImports() {
    const refs = visible.filter((item) => item.catalogueState === "to_import" && !item.importPrepared).slice(0, 20).map((item) => item.reference);
    setSelectedImports(new Set(refs));
  }

  function exportCsv() {
    if (!scan) return;
    const rows = [
      ["Référence Stockman", "Désignation", "Catégorie", "Brouillon import", "Statut", "Analyse non reconnue", "Méthode", "Confiance", "Justification", "Référence OYSTE", "Cible OYSTE", "Suggestions", "URL Stockman"],
      ...scan.matches.map((item) => [
        item.reference,
        item.designation,
        item.category ?? "",
        item.importPrepared ? "Oui" : "Non",
        item.catalogueState ? catalogueStateLabel(item.catalogueState) : "",
        statusLabel(item.status),
        item.missingKind ? missingKindLabel(item.missingKind) : "",
        methodLabel(item.matchMethod),
        `${item.confidence}%`,
        item.reason,
        item.targetReference ?? item.equivalentReference ?? "",
        item.targetName ?? "",
        (item.suggestions ?? []).map((suggestion) => `${suggestion.targetReference} - ${suggestion.targetName} (${suggestion.confidence}%)`).join(" | "),
        item.sourceUrl,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stockman-equivalences-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-7 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-black">Découverte du catalogue Stockman</h2>
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-orange-700">V2.10.17.6 · Diagnostic des familles restantes</span>
        </div>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-500">
          Stockman reste la source de vérité. La préparation des brouillons lit maintenant directement la ligne commerciale de chaque variante dans le DOM Stockman afin de récupérer le stock, le prix HT et le poids avant toute création catalogue.
        </p>
      </div>

      <div className="p-5 md:p-6">
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                <ClipboardCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">Audit avant reconstruction Stockman</p>
                <p className="mt-1 max-w-3xl text-xs font-bold leading-5 text-slate-500">
                  Dry-run strict : compte l’ancien catalogue STOCKMAN, les objets déjà reliés au catalogue vivant et les références à reconstruire. Aucune suppression et aucun import ne sont exécutés.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void runRebuildAudit()}
              disabled={!enabled || auditingRebuild || loading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-xs font-black text-white disabled:opacity-50"
            >
              {auditingRebuild ? <LoaderCircle size={16} className="animate-spin" /> : <Database size={16} />}
              {auditingRebuild ? "Audit en cours…" : "Lancer le dry-run"}
            </button>
          </div>

          {rebuildAudit ? (
            <div className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Produits STOCKMAN actuels" value={rebuildAudit.currentCatalogue.products} tone="info" />
                <Metric label="Variantes actuelles" value={rebuildAudit.currentCatalogue.variants} tone="info" />
                <Metric label="Objets legacy potentiels" value={rebuildAudit.rebuildProjection.stockmanObjectsPotentiallyRemoved} tone={rebuildAudit.rebuildProjection.stockmanObjectsPotentiallyRemoved > 0 ? "warning" : "success"} />
                <Metric label="Références vivantes actives" value={rebuildAudit.livingCatalogue.activeReferences} tone="success" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Déjà reliées au vivant" value={rebuildAudit.livingCatalogue.linkedActiveReferences} tone="success" />
                <Metric label="À résoudre avant rebuild" value={rebuildAudit.livingCatalogue.unlinkedActiveReferences} tone={rebuildAudit.livingCatalogue.unlinkedActiveReferences > 0 ? "danger" : "success"} />
                <Metric label="Familles estimées par URL" value={rebuildAudit.livingCatalogue.estimatedFamiliesByUrl} tone="info" />
                <Metric label="Brouillons existants" value={rebuildAudit.livingCatalogue.importDrafts} tone="info" />
              </div>
              {rebuildAudit.resolutionAnalysis ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3">
                    <p className="text-sm font-black text-slate-950">Classification des {rebuildAudit.livingCatalogue.unlinkedActiveReferences} références à résoudre</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">Deuxième passe : référence + famille + désignation + valeurs numériques + contexte parent/variante. Toujours en dry-run : aucun rattachement n'est écrit en base.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <Metric label="Correspondances certaines" value={rebuildAudit.resolutionAnalysis.certain} tone="success" />
                    <Metric label="Correspondances probables" value={rebuildAudit.resolutionAnalysis.probable} tone="warning" />
                    <Metric label="Ambiguïtés levées" value={rebuildAudit.resolutionAnalysis.ambiguitiesResolvedByContext ?? 0} tone="success" />
                    <Metric label="Nouvelles depuis Stockman" value={rebuildAudit.resolutionAnalysis.newFromStockman} tone="info" />
                    <Metric label="Ambiguës restantes" value={rebuildAudit.resolutionAnalysis.ambiguous} tone={rebuildAudit.resolutionAnalysis.ambiguous > 0 ? "danger" : "success"} />
                    <Metric label="Legacy sans match vivant" value={rebuildAudit.resolutionAnalysis.legacyWithoutLivingMatch} tone="warning" />
                  </div>
                  <div className={`mt-3 rounded-xl border p-3 text-[11px] font-black ${rebuildAudit.resolutionAnalysis.safeToExecuteRebuild ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                    {rebuildAudit.resolutionAnalysis.safeToExecuteRebuild
                      ? "Aucune ambiguïté détectée par cette passe. Le rebuild n'est toujours pas exécuté, mais la base est prête pour l'étape suivante."
                      : `${rebuildAudit.resolutionAnalysis.ambiguous} référence(s) ambiguë(s) bloquent encore volontairement le rebuild automatique.`}
                  </div>
                  {[
                    ["Correspondances certaines", "certain"],
                    ["Correspondances probables", "probable"],
                    ["Ambiguïtés levées automatiquement", "ambiguitiesResolved"],
                    ["Nouvelles références Stockman", "newFromStockman"],
                    ["Ambiguïtés à traiter", "ambiguous"],
                    ["Legacy sans correspondance vivante", "orphanLegacy"],
                  ].map(([label, key]) => {
                    const rows = rebuildAudit.resolutionSamples?.[key] ?? [];
                    if (!rows.length) return null;
                    return (
                      <details key={key} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <summary className="cursor-pointer text-xs font-black text-slate-800">{label} · échantillon ({rows.length})</summary>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {rows.map((row: any, index: number) => {
                            const source = row.livingItem ?? row;
                            const candidate = row.candidate;
                            return (
                              <div key={`${key}-${source.reference || source.supplierCode || source.code}-${index}`} className="rounded-lg bg-white p-2 text-[11px] font-bold text-slate-600">
                                <span className="font-black text-slate-950">{source.reference || source.supplierCode || source.code}</span>
                                {source.designation || source.name ? ` · ${source.designation || source.name}` : ""}
                                {candidate ? <div className="mt-1 text-emerald-700">→ {candidate.supplierCode || candidate.code} · {candidate.name} · {row.reason}</div> : row.reason ? <div className="mt-1 text-slate-500">{row.reason}</div> : null}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3 text-[11px] font-bold leading-5 text-amber-900">
                Aucun changement effectué. « Legacy » signifie ici : produit/variante STOCKMAN sans lien direct <code>sourceData.stockman.sourceUrl</code> vers le catalogue vivant. La suppression réelle restera interdite tant qu’on n’aura pas validé ce rapport.
              </div>
              {rebuildAudit.samples?.legacyProducts?.length ? (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-black text-slate-800">Voir un échantillon des produits legacy ({rebuildAudit.samples.legacyProducts.length} affichés)</summary>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {rebuildAudit.samples.legacyProducts.map((item: any) => (
                      <div key={`${item.code}:${item.supplierCode || ""}`} className="rounded-lg bg-slate-50 p-2 text-[11px] font-bold text-slate-600">
                        <span className="font-black text-slate-950">{item.supplierCode || item.code}</span> · {item.name} · {item.variants} variante(s)
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/60 p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">Clean rebuild STOCKMAN</p>
              <p className="mt-1 max-w-4xl text-xs font-bold leading-5 text-slate-600">
                Supprime uniquement l'ancien catalogue rattaché à STOCKMAN. Le référentiel vivant reste intact et servira à reconstruire le catalogue depuis l'intranet.
              </p>
            </div>
            <button type="button" onClick={() => void checkCleanRebuild()} disabled={!enabled || checkingCleanRebuild || executingCleanRebuild}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 text-xs font-black text-red-700 disabled:opacity-50">
              {checkingCleanRebuild ? <LoaderCircle size={16} className="animate-spin" /> : <TriangleAlert size={16} />}
              {checkingCleanRebuild ? "Contrôle…" : "Contrôler avant suppression"}
            </button>
          </div>

          {cleanRebuild ? <div className="mt-4 rounded-2xl border border-red-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Produits à supprimer" value={cleanRebuild.products} tone="danger" />
              <Metric label="Variantes à supprimer" value={cleanRebuild.variants} tone="danger" />
              <Metric label="Références vivantes conservées" value={cleanRebuild.activeLivingReferences} tone="success" />
              <Metric label="Commandes historiques préservées" value={cleanRebuild.historicalOrderItems} tone="success" />
            </div>
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-bold leading-5 text-emerald-900">
              Aucun autre fournisseur n'est touché. Les brouillons Stockman sont vidés et les anciennes associations du référentiel vivant sont remises à zéro.
            </div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="flex-1">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Confirmation obligatoire</span>
                <input value={rebuildConfirmation} onChange={(event) => setRebuildConfirmation(event.target.value)}
                  placeholder="REBUILD STOCKMAN"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black outline-none focus:border-red-400" />
              </label>
              <button type="button" onClick={() => void executeCleanRebuild()}
                disabled={!enabled || executingCleanRebuild || rebuildConfirmation !== "REBUILD STOCKMAN"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                {executingCleanRebuild ? <LoaderCircle size={16} className="animate-spin" /> : <Database size={16} />}
                {executingCleanRebuild ? "Nettoyage…" : "Supprimer l'ancien STOCKMAN"}
              </button>
            </div>
          </div> : null}
        </div>

        <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">Reconstruire depuis le catalogue vivant</p>
              <p className="mt-1 max-w-4xl text-xs font-bold leading-5 text-slate-600">
                V2.10.18.0 · Rebuild final 100 % intranet. Les catégories servent uniquement à naviguer, chaque référence commerciale possède un seul propriétaire canonique et les doublons/accessoires déjà présents sur leur propre fiche ne sont jamais recréés comme variantes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void checkLivingRebuild()}
              disabled={!enabled || checkingLivingRebuild || executingLivingRebuild || loading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-5 py-3 text-xs font-black text-[#007f8f] disabled:opacity-50"
            >
              {checkingLivingRebuild ? <LoaderCircle size={16} className="animate-spin" /> : <PackageSearch size={16} />}
              {checkingLivingRebuild ? "Contrôle…" : "Préparer la reconstruction"}
            </button>
          </div>

          {livingRebuild ? (
            <div className="mt-4 rounded-2xl border border-cyan-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                <Metric label="Références vivantes" value={livingRebuild.activeReferences} tone="success" />
                <Metric label="Familles Stockman" value={livingRebuild.families} tone="info" />
                <Metric label="Familles reconstruites" value={livingRebuild.builtFamilies} tone="success" />
                <Metric label="Navigation ignorée" value={livingRebuild.ignoredFamilies || 0} tone="info" />
                <Metric label="Familles restantes" value={livingRebuild.remainingFamilies} tone={livingRebuild.remainingFamilies > 0 ? "warning" : "success"} />
                <Metric label="Références restantes" value={livingRebuild.remainingReferences} tone={livingRebuild.remainingReferences > 0 ? "warning" : "success"} />
                <Metric label="À vérifier" value={livingRebuild.blockedReferences || 0} tone={livingRebuild.blockedReferences > 0 ? "danger" : "success"} />
              </div>

              {livingRebuild.partiallyLinkedFamilies > 0 ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-black text-red-800">
                  {livingRebuild.partiallyLinkedFamilies} famille(s) partiellement liées : reconstruction bloquée pour éviter les doublons.
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-bold leading-5 text-emerald-900">
                  Structure saine. Pour le rebuild final, réinitialisez une dernière fois le catalogue STOCKMAN avec « Supprimer l'ancien STOCKMAN », puis lancez la reconstruction. Les références vivantes sont conservées : aucun Excel et aucun rescan obligatoire.
                </div>
              )}

              {Number(livingRebuild.remainingFamilies || 0) > 0 ? (
                <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-950">Diagnostic des familles restantes</p>
                      <p className="mt-1 max-w-4xl text-[11px] font-semibold leading-5 text-slate-600">
                        Lecture seule : URL demandée, URL finale, titre, suivi éventuel vers une fiche détail, nombre de lignes commerciales DOM, références lues, stock/prix parsés et raison exacte du rejet.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void diagnoseRemainingLivingRebuild()}
                      disabled={!enabled || diagnosingRemaining || executingLivingRebuild}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                    >
                      {diagnosingRemaining ? <LoaderCircle size={16} className="animate-spin" /> : <ScanSearch size={16} />}
                      {diagnosingRemaining ? "Diagnostic en cours…" : `Diagnostiquer les ${livingRebuild.remainingFamilies} familles restantes`}
                    </button>
                  </div>

                  {remainingDiagnostic ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Metric label="Familles analysées" value={Number(remainingDiagnostic.processedFamilies || 0)} tone={remainingDiagnostic.finished ? "success" : "info"} />
                        <Metric label="Références concernées" value={Number(remainingDiagnostic.totalRemainingReferences || 0)} tone="warning" />
                        <Metric label="Patterns détectés" value={Object.keys(remainingDiagnostic.patternCounts || {}).length} tone="info" />
                      </div>

                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(remainingDiagnostic.patternCounts || {}).map(([pattern, count]) => (
                          <div key={pattern} className="rounded-xl border border-violet-100 bg-white px-3 py-2">
                            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-700">{pattern.replaceAll("_", " ")}</div>
                            <div className="mt-1 text-xl font-black text-slate-950">{String(count)} famille(s)</div>
                          </div>
                        ))}
                      </div>

                      <details className="rounded-xl border border-violet-100 bg-white">
                        <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                          Voir le diagnostic détaillé ({remainingDiagnostic.families?.length || 0} familles)
                        </summary>
                        <div className="max-h-[720px] space-y-3 overflow-auto border-t border-violet-100 p-3">
                          {(remainingDiagnostic.families || []).map((family: any, familyIndex: number) => (
                            <div key={`${family.sourceUrl}-${familyIndex}`} className="rounded-xl border border-slate-200 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-slate-950">{family.familyReference || family.referenceHint}</span>
                                <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black uppercase text-violet-800">{family.kind || "unknown"}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-700">
                                  {family.acceptedCommercialRows || 0}/{family.commercialCandidateRows || 0} lignes acceptées
                                </span>
                              </div>
                              <div className="mt-2 text-xs font-black text-slate-900">{family.pageTitle || "Sans titre H1"}</div>
                              <div className="mt-2 break-all text-[10px] font-semibold text-slate-500">Demandée : {family.requestedUrl || family.sourceUrl}</div>
                              <div className="mt-1 break-all text-[10px] font-semibold text-slate-500">Finale : {family.finalUrl}</div>
                              {family.followedDetailUrl ? (
                                <div className="mt-1 break-all text-[10px] font-bold text-violet-700">Détail suivi : {family.followedDetailUrl}</div>
                              ) : null}
                              <div className="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] font-bold leading-4 text-amber-950">
                                {family.reason}
                              </div>
                              <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[10px]">
                                <b>Références connues ({family.knownReferenceCount || 0}) :</b> {family.knownReferences?.join(", ") || "—"}
                              </div>

                              {family.rows?.length ? (
                                <div className="mt-2 space-y-2">
                                  {family.rows.map((row: any) => (
                                    <div key={row.index} className={`rounded-lg border p-2 text-[10px] ${row.accepted ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}>
                                      <div className="font-black">
                                        Ligne {row.index + 1} · réf. {row.reference || "NON DÉTECTÉE"} · {row.accepted ? "ACCEPTÉE" : `REJETÉE — ${row.rejectionReason}`}
                                      </div>
                                      <div className="mt-1">Stock : “{row.stockText || "—"}” → {row.stockParsed ?? (row.stockOnRequest ? "Nous consulter" : "null")}</div>
                                      <div>Prix : “{row.priceText || "—"}” → {row.priceParsed ?? (row.priceOnRequest ? "Nous consulter" : "null")}</div>
                                      <div className="mt-1 whitespace-pre-wrap break-words text-slate-600">{row.rowText}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {livingRebuild.blockedReferences > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-5 text-amber-900">
                  {livingRebuild.blockedReferences} référence(s) isolée(s) à vérifier. Elles ne bloquent plus la reconstruction des autres familles.
                  {Array.isArray(livingRebuild.blocked) && livingRebuild.blocked.length > 0 ? (
                    <span className="ml-1 font-black">{livingRebuild.blocked.flatMap((entry: any) => entry.references || []).slice(0, 12).join(", ")}</span>
                  ) : null}
                </div>
              ) : null}

              {livingRebuild.blockedReferences > 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-950">Diagnostic exhaustif des familles bloquées</p>
                      <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-600">
                        Relit réellement chaque référence Stockman et compare : attendu / lu / absent / erreur. Aucun produit, prix ou rattachement n'est modifié.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void diagnoseBlockedLivingRebuild()}
                      disabled={!enabled || diagnosingLivingRebuild || executingLivingRebuild}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                    >
                      {diagnosingLivingRebuild ? <LoaderCircle size={16} className="animate-spin" /> : <ScanSearch size={16} />}
                      {diagnosingLivingRebuild ? "Diagnostic en cours…" : "Diagnostiquer les familles bloquées"}
                    </button>
                  </div>

                  {livingDiagnostic ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Metric label="Familles analysées" value={Number(livingDiagnostic.processedFamilies || 0)} tone={livingDiagnostic.finished ? "success" : "info"} />
                        <Metric label="Références concernées" value={livingDiagnostic.totalBlockedReferences} tone="warning" />
                        <Metric label="Patterns détectés" value={Object.keys(livingDiagnostic.patternCounts || {}).length} tone="info" />
                      </div>

                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {Object.entries(livingDiagnostic.patternCounts || {}).map(([pattern, count]) => (
                          <div key={pattern} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{pattern.replaceAll("_", " ")}</div>
                            <div className="mt-1 text-xl font-black text-slate-950">{String(count)} famille(s)</div>
                          </div>
                        ))}
                      </div>

                      <details className="rounded-xl border border-slate-200 bg-white">
                        <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                          Voir le diagnostic détaillé ({livingDiagnostic.families?.length || 0} familles)
                        </summary>
                        <div className="max-h-[620px] space-y-3 overflow-auto border-t border-slate-100 p-3">
                          {(livingDiagnostic.families || []).map((family: any) => (
                            <div key={family.sourceUrl} className="rounded-xl border border-slate-200 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-slate-950">{family.familyCode}</span>
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-800">{String(family.pattern).replaceAll("_", " ")}</span>
                              </div>
                              <div className="mt-2 break-all text-[10px] font-semibold text-slate-500">{family.sourceUrl}</div>
                              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                                <div className="rounded-lg bg-slate-50 p-2 text-[10px]"><b>Attendues ({family.expected?.length || 0})</b><br />{family.expected?.join(", ") || "—"}</div>
                                <div className="rounded-lg bg-emerald-50 p-2 text-[10px] text-emerald-900"><b>Lues ({family.readable?.length || 0})</b><br />{family.readable?.map((item: any) => item.reference).join(", ") || "—"}</div>
                                <div className="rounded-lg bg-red-50 p-2 text-[10px] text-red-900"><b>Absentes ({family.missing?.length || 0})</b><br />{family.missing?.join(", ") || "—"}</div>
                              </div>
                              {family.failures?.length ? (
                                <div className="mt-2 space-y-1">
                                  {family.failures.map((failure: any, index: number) => (
                                    <div key={`${failure.reference}-${index}`} className="rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] leading-4 text-red-900">
                                      <b>{failure.reference} · {String(failure.reason).replaceAll("_", " ")}</b><br />
                                      <span className="whitespace-pre-wrap break-words">{failure.error}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void retryBlockedLivingRebuild()}
                  disabled={!enabled || executingLivingRebuild || Number(livingRebuild?.blockedReferences || 0) === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-xs font-black text-amber-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCcw size={16} />
                  Réparer et rejouer les exceptions
                </button>
                <button
                  type="button"
                  onClick={() => void executeLivingRebuild()}
                  disabled={!enabled || executingLivingRebuild || livingRebuild.partiallyLinkedFamilies > 0 || livingRebuild.remainingFamilies === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {executingLivingRebuild ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {executingLivingRebuild ? "Rebuild final en cours…" : "Lancer le rebuild final STOCKMAN"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">V2.10.21.0 · Résolution taxonomie breadcrumb Stockman</p>
              <p className="mt-1 max-w-4xl text-xs font-bold leading-5 text-slate-600">
                Lecture seule : OYSTE reconnaît désormais aussi les branches parentes existantes de sa taxonomie et résout les derniers mappings Stockman sûrs (stockage, quai, dévidoirs et chariots porte-palans). Les catégories sans équivalent métier OYSTE restent volontairement à vérifier. Aucune écriture n’est effectuée en base.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runClassificationAudit()}
              disabled={!enabled || auditingClassification}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40"
            >
              {auditingClassification ? <LoaderCircle size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
              {auditingClassification ? "Audit en cours…" : "Auditer le catalogue STOCKMAN"}
            </button>
          </div>

          {classificationAudit ? (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                <Metric label="Produits analysés" value={classificationAudit.totals?.products || 0} tone="info" />
                <Metric label="Catégories à corriger" value={classificationAudit.totals?.categoryChangesProposed || 0} tone="warning" />
                <Metric label="Catégories déjà plus précises" value={classificationAudit.totals?.categoriesKeptMoreSpecific || 0} tone="success" />
                <Metric label="Propositions bloquées" value={classificationAudit.totals?.categorySuggestionsBlocked || 0} tone="info" />
                <Metric label="Catégories non résolues" value={classificationAudit.totals?.categoryUnresolved || 0} tone={classificationAudit.totals?.categoryUnresolved ? "danger" : "success"} />
                <Metric label="Accessoires probables" value={classificationAudit.totals?.accessoryCandidates || 0} tone="warning" />
                <Metric label="Produits arrêtés" value={classificationAudit.totals?.discontinuedTotal || 0} tone="info" />
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-950">Fil d’Ariane Stockman réel</p>
                    <p className="mt-1 max-w-4xl text-[11px] font-semibold leading-5 text-slate-600">
                      Lit désormais tous les liens <code>&lt;a&gt;</code> présents dans <code>.container.content-ariane</code> : Stockman n’applique la classe <code>ariane-link</code> qu’à Accueil/Produits, pas aux niveaux métier, puis propose uniquement une branche déjà existante dans la taxonomie OYSTE.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => void runBreadcrumbDebug()} disabled={!enabled || debuggingBreadcrumb}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black text-white disabled:opacity-40">
                      {debuggingBreadcrumb ? <LoaderCircle size={16} className="animate-spin" /> : <ScanSearch size={16} />}
                      {debuggingBreadcrumb ? "Diagnostic LFC300…" : "Diagnostiquer LFC300"}
                    </button>
                  <button
                    type="button"
                    onClick={() => void runBreadcrumbAudit()}
                    disabled={!enabled || auditingBreadcrumbs}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                  >
                    {auditingBreadcrumbs ? <LoaderCircle size={16} className="animate-spin" /> : <ScanSearch size={16} />}
                    {auditingBreadcrumbs ? "Lecture des breadcrumbs…" : "Auditer les breadcrumbs STOCKMAN"}
                  </button>
                  </div>
                </div>

                {breadcrumbDebug ? (
                  <div className="mt-4 rounded-xl border border-slate-300 bg-white p-4 text-[11px] text-slate-700">
                    <div className="font-black text-slate-950">Diagnostic brut · {breadcrumbDebug.code}</div>
                    <div className="mt-2 grid gap-1">
                      <div><b>URL demandée :</b> {breadcrumbDebug.requestedUrl || "—"}</div>
                      <div><b>URL finale :</b> {breadcrumbDebug.finalUrl || "—"}</div>
                      <div><b>HTTP :</b> {breadcrumbDebug.httpStatus ?? "—"}</div>
                      <div><b>Titre :</b> {breadcrumbDebug.diagnostic?.title || "—"}</div>
                      <div><b>readyState :</b> {breadcrumbDebug.diagnostic?.readyState || "—"}</div>
                      <div><b>#div_ariane_content :</b> {breadcrumbDebug.diagnostic?.rootFound ? "OUI" : "NON"}</div>
                      <div><b>.container.content-ariane :</b> {breadcrumbDebug.diagnostic?.exactContainerFound ? "OUI" : "NON"}</div>
                      <div><b>Liens dans le bloc :</b> {breadcrumbDebug.diagnostic?.allLinksCount ?? 0}</div>
                      <div><b>a.ariane-link :</b> {breadcrumbDebug.diagnostic?.arianeLinksCount ?? 0}</div>
                    </div>
                    <div className="mt-3 font-black">Texte du conteneur</div>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{breadcrumbDebug.diagnostic?.containerText || "—"}</pre>
                    <div className="mt-3 font-black">innerHTML du conteneur</div>
                    <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2">{breadcrumbDebug.diagnostic?.containerHtml || "—"}</pre>
                    <div className="mt-3 font-black">Début du texte de la page</div>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{breadcrumbDebug.diagnostic?.bodyTextStart || "—"}</pre>
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-xs font-black text-slate-950">Taxonomie OYSTE à compléter · V2.10.21.0</div>
                          <div className="mt-1 text-[11px] font-semibold leading-5 text-slate-600">
                            Ce bloc reste visible même avant l’audit. Crée ou confirme les deux branches manquantes : Équipement d’atelier → Presse hydraulique et Manutention au sol → Chariot élévateur → Chariot à mât rétractable. Les rares exceptions restantes pourront ensuite être classées manuellement dans la liste « À vérifier ».
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void createMissingStockmanTaxonomy()}
                          disabled={creatingMissingTaxonomy}
                          className="shrink-0 rounded-xl bg-violet-700 px-4 py-2.5 text-[11px] font-black text-white disabled:opacity-40"
                        >
                          {creatingMissingTaxonomy ? "Création…" : "Créer / confirmer les 2 branches"}
                        </button>
                      </div>
                    </div>
                </div>

                {breadcrumbAudit ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                      <Metric label="Fiches lues" value={Number(breadcrumbAudit.processed || 0)} tone={breadcrumbAudit.finished ? "success" : "info"} />
                      <Metric label="Catégories trouvées" value={breadcrumbAudit.proposed || 0} tone="success" />
                      <Metric label="Accessoires détectés" value={breadcrumbAudit.accessories || 0} tone="info" />
                      <Metric label="Produits arrêtés" value={breadcrumbAudit.discontinued || 0} tone="info" />
                      <Metric label="À vérifier" value={breadcrumbAudit.unresolved || 0} tone={breadcrumbAudit.unresolved ? "warning" : "success"} />
                      <Metric label="Erreurs de lecture" value={breadcrumbAudit.errors || 0} tone={breadcrumbAudit.errors ? "danger" : "success"} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500">
                      Progression : {breadcrumbAudit.processed || 0} / {breadcrumbAudit.total || 0} fiche(s)
                    </p>

                    <details className="rounded-xl border border-sky-100 bg-white">
                      <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                        Voir les propositions issues du breadcrumb ({(breadcrumbAudit.rows || []).filter((row: any) => row.breadcrumbKind === "category" && row.proposedCategory).length})
                      </summary>
                      <div className="max-h-[620px] overflow-auto border-t border-sky-100 p-3">
                        <div className="grid gap-2">
                          {(breadcrumbAudit.rows || [])
                            .filter((row: any) => row.breadcrumbKind === "category" && row.proposedCategory)
                            .map((row: any) => (
                              <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-[11px]">
                                <div className="font-black text-slate-950">{row.code} · {row.name}</div>
                                <div className="mt-1 text-slate-500">Breadcrumb : <span className="font-bold">{(row.breadcrumb || []).join(" → ") || "—"}</span></div>
                                <div className="mt-1 text-slate-500">Actuelle : <span className="font-bold">{row.currentCategory || "—"}</span></div>
                                <div className="mt-1 text-sky-700">Proposée : <span className="font-black">{row.proposedCategory}</span></div>
                                <div className="mt-1 text-slate-400">{row.reason}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </details>

                    <details className="rounded-xl border border-amber-200 bg-amber-50/40">
                      <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                        Accessoires détectés par le breadcrumb ({(breadcrumbAudit.rows || []).filter((row: any) => row.breadcrumbKind === "accessory").length})
                      </summary>
                      <div className="max-h-[520px] overflow-auto border-t border-amber-200 p-3">
                        <div className="grid gap-2">
                          {(breadcrumbAudit.rows || [])
                            .filter((row: any) => row.breadcrumbKind === "accessory")
                            .map((row: any) => (
                              <div key={row.id} className="rounded-xl border border-amber-200 bg-white p-3 text-[11px]">
                                <div className="font-black text-slate-950">{row.code} · {row.name}</div>
                                <div className="mt-1 text-slate-500">Breadcrumb : <span className="font-bold">{(row.breadcrumb || []).join(" → ") || "—"}</span></div>
                                <div className="mt-1 font-bold text-amber-700">Accessoire Stockman détecté · aucune catégorie machine imposée</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </details>

                    <details className="rounded-xl border border-slate-200 bg-white">
                      <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                        Breadcrumbs non mappés / erreurs ({(breadcrumbAudit.rows || []).filter((row: any) => row.breadcrumbKind === "review" || row.error).length})
                      </summary>
                      <div className="max-h-[520px] overflow-auto border-t border-slate-200 p-3">
                        <div className="grid gap-2">
                          {(breadcrumbAudit.rows || [])
                            .filter((row: any) => row.breadcrumbKind === "review" || row.error)
                            .map((row: any) => (
                              <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-[11px]">
                                <div className="font-black text-slate-950">{row.code} · {row.name}</div>
                                <div className="mt-1 text-slate-500">Breadcrumb : <span className="font-bold">{(row.breadcrumb || []).join(" → ") || "—"}</span></div>
                                <div className={`mt-1 font-bold ${row.error ? "text-red-700" : "text-slate-500"}`}>{row.error || row.reason}</div>
                                {!row.error ? (
                                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    <select
                                      value={manualCategorySelection[row.id] || ""}
                                      onChange={(event) =>
                                        setManualCategorySelection((current) => ({ ...current, [row.id]: event.target.value }))
                                      }
                                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-800"
                                    >
                                      <option value="">Choisir une catégorie OYSTE manuellement…</option>
                                      {breadcrumbCategoryOptions.map((category) => (
                                        <option key={category.id} value={category.id}>{category.path}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => void saveManualBreadcrumbCategory(row)}
                                      disabled={!manualCategorySelection[row.id] || savingManualCategory === row.id}
                                      className="rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-black text-white disabled:opacity-40"
                                    >
                                      {savingManualCategory === row.id ? "Enregistrement…" : "Mémoriser l’override"}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                        </div>
                      </div>
                    </details>
                  </div>
                ) : null}

                {breadcrumbAudit?.finished ? (
                  <div className="mt-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-black text-slate-950">Application sécurisée des catégories · V2.10.22.1</div>
                        <div className="mt-1 max-w-4xl text-[11px] font-semibold leading-5 text-slate-600">
                          La sélection compare toujours la catégorie OYSTE actuelle avec la catégorie issue du breadcrumb Stockman. V2.10.22.1 autorise maintenant l’application réelle des seules lignes cochées, avec contrôle anti-dérive, transaction tout-ou-rien et historique avant/après dans les données source Stockman. Les branches OYSTE historiques manquantes en base sont créées dans la même transaction avant affectation.
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-amber-800">
                        Écriture réelle protégée
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                      <Metric label="À reclasser" value={breadcrumbChangePreview.changed.length} tone={breadcrumbChangePreview.changed.length ? "warning" : "success"} />
                      <Metric label="Déjà corrects" value={breadcrumbChangePreview.unchanged.length} tone="success" />
                      <Metric label="Catégories reconnues" value={breadcrumbChangePreview.categoryRows.length} tone="info" />
                      <Metric label="Accessoires exclus" value={breadcrumbChangePreview.accessories.length} tone="info" />
                      <Metric label="Produits arrêtés" value={breadcrumbChangePreview.discontinued.length} tone="info" />
                      <Metric label="Blocages" value={breadcrumbChangePreview.unresolved.length + breadcrumbChangePreview.errors.length} tone={(breadcrumbChangePreview.unresolved.length + breadcrumbChangePreview.errors.length) ? "danger" : "success"} />
                    </div>

                    <details className="mt-4 rounded-xl border border-emerald-200 bg-white" open>
                      <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                        Valider la sélection avant application ({breadcrumbPreviewSelected.size} / {breadcrumbChangePreview.changed.length})
                      </summary>
                      <div className="border-t border-emerald-200 p-3">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          {([
                            ["all", `Tous (${breadcrumbChangePreview.changed.length})`],
                            ["uncategorized", `Sans catégorie (${breadcrumbChangePreview.changed.filter((row: any) => !String(row.currentCategory || "").trim()).length})`],
                            ["recategorized", `Déjà catégorisés (${breadcrumbChangePreview.changed.filter((row: any) => Boolean(String(row.currentCategory || "").trim())).length})`],
                          ] as const).map(([value, label]) => (
                            <button key={value} type="button" onClick={() => setBreadcrumbPreviewFilter(value)} className={`rounded-lg border px-3 py-2 text-[10px] font-black ${breadcrumbPreviewFilter === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>
                          ))}
                          <span className="mx-1 h-6 w-px bg-slate-200" />
                          <button type="button" onClick={selectVisibleBreadcrumbChanges} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700">Tout sélectionner</button>
                          <button type="button" onClick={deselectVisibleBreadcrumbChanges} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600">Tout désélectionner</button>
                          <div className="ml-auto rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-black text-indigo-700">{breadcrumbPreviewSelected.size} changement(s) validé(s)</div>
                        </div>
                        <div className="mb-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
                          <div className="text-[11px] font-black text-amber-950">Application réelle · {breadcrumbPreviewSelected.size} produit(s)</div>
                          <div className="mt-1 text-[10px] font-semibold leading-5 text-amber-800">
                            Vérifie la sélection avant de continuer. Si une catégorie a changé depuis l’audit ou si une cible n’existe plus, toute l’opération est annulée sans écriture partielle.
                          </div>
                          <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                            <input
                              value={breadcrumbApplyConfirmation}
                              onChange={(event) => setBreadcrumbApplyConfirmation(event.target.value)}
                              placeholder={`Taper APPLIQUER ${breadcrumbPreviewSelected.size}`}
                              disabled={applyingBreadcrumbCategories || breadcrumbPreviewSelected.size === 0}
                              className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={applySelectedBreadcrumbCategories}
                              disabled={applyingBreadcrumbCategories || breadcrumbPreviewSelected.size === 0 || breadcrumbApplyConfirmation.trim() !== `APPLIQUER ${breadcrumbPreviewSelected.size}`}
                              className="rounded-lg bg-amber-600 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {applyingBreadcrumbCategories ? "Application…" : `Appliquer ${breadcrumbPreviewSelected.size} catégorie(s)`}
                            </button>
                          </div>
                        </div>

                        <div className="max-h-[680px] overflow-auto">
                        {filteredBreadcrumbChanges.length ? (
                          <div className="grid gap-2">
                            {filteredBreadcrumbChanges.map((row: any) => (
                              <label key={`preview-${row.id}`} className={`cursor-pointer rounded-xl border p-3 text-[11px] ${breadcrumbPreviewSelected.has(String(row.id)) ? "border-emerald-300 bg-emerald-50/30" : "border-slate-200 bg-white opacity-70"}`}>
                                <div className="flex items-start gap-3">
                                  <input type="checkbox" checked={breadcrumbPreviewSelected.has(String(row.id))} onChange={() => toggleBreadcrumbPreviewRow(String(row.id))} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                                  <div className="min-w-0 flex-1">
                                <div className="font-black text-slate-950">{row.code} · {row.name}</div>
                                <div className="mt-1 text-slate-500">Breadcrumb Stockman : <span className="font-bold">{(row.breadcrumb || []).join(" → ") || "—"}</span></div>
                                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                                    <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Catégorie actuelle</div>
                                    <div className="mt-1 font-bold text-slate-700">{row.currentCategory || "Aucune catégorie"}</div>
                                  </div>
                                  <div className="rounded-lg bg-emerald-50 px-3 py-2">
                                    <div className="text-[9px] font-black uppercase tracking-wide text-emerald-600">Nouvelle catégorie proposée</div>
                                    <div className="mt-1 font-black text-emerald-800">{row.proposedCategory}</div>
                                  </div>
                                </div>
                                <div className="mt-2 text-slate-400">{row.reason}</div>
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-600">
                            Aucun changement dans ce filtre.
                          </div>
                        )}
                        </div>
                      </div>
                    </details>

                    <details className="mt-3 rounded-xl border border-slate-200 bg-white">
                      <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                        Voir les catégories déjà correctes ({breadcrumbChangePreview.unchanged.length})
                      </summary>
                      <div className="max-h-[520px] overflow-auto border-t border-slate-200 p-3">
                        <div className="grid gap-2">
                          {breadcrumbChangePreview.unchanged.map((row: any) => (
                            <div key={`unchanged-${row.id}`} className="rounded-xl border border-slate-200 p-3 text-[11px]">
                              <div className="font-black text-slate-950">{row.code} · {row.name}</div>
                              <div className="mt-1 text-emerald-700">Conservée : <span className="font-black">{row.proposedCategory}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>
                ) : null}
              </div>

              <details className="rounded-xl border border-indigo-100 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                  Catégories proposées ({(classificationAudit.rows || []).filter((row: any) => row.categoryNeedsReview).length})
                </summary>
                <div className="max-h-[520px] overflow-auto border-t border-indigo-100 p-3">
                  <div className="grid gap-2">
                    {(classificationAudit.rows || [])
                      .filter((row: any) => row.categoryNeedsReview)
                      .map((row: any) => (
                        <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-[11px]">
                          <div className="font-black text-slate-950">{row.code} · {row.name}</div>
                          <div className="mt-1 text-slate-500">Actuelle : <span className="font-bold">{row.currentCategory || "—"}</span></div>
                          <div className="mt-1 text-emerald-700">Proposée : <span className="font-black">{row.proposedCategory}</span></div>
                          <div className="mt-1 text-slate-400">{row.categoryReason}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-cyan-100 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                  Propositions bloquées par le veto métier ({(classificationAudit.rows || []).filter((row: any) => row.categoryVeto).length})
                </summary>
                <div className="max-h-[420px] overflow-auto border-t border-cyan-100 p-3">
                  <div className="grid gap-2">
                    {(classificationAudit.rows || [])
                      .filter((row: any) => row.categoryVeto)
                      .map((row: any) => (
                        <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-[11px]">
                          <div className="font-black text-slate-950">{row.code} · {row.name}</div>
                          <div className="mt-1 text-slate-500">Actuelle : <span className="font-bold">{row.currentCategory || "—"}</span></div>
                          <div className="mt-1 text-slate-400">Suggestion Stockman bloquée : <span className="font-bold">{row.proposedCategory || "—"}</span></div>
                          <div className="mt-1 font-bold text-cyan-800">{row.categoryVeto}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-rose-100 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                  Catégories non résolues ({(classificationAudit.rows || []).filter((row: any) => row.categoryConfidence === "unresolved").length})
                </summary>
                <div className="max-h-[620px] overflow-auto border-t border-rose-100 p-3">
                  <div className="grid gap-2">
                    {(classificationAudit.rows || [])
                      .filter((row: any) => row.categoryConfidence === "unresolved")
                      .map((row: any) => (
                        <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-[11px]">
                          <div className="font-black text-slate-950">{row.code} · {row.name}</div>
                          <div className="mt-1 text-slate-500">Catégorie OYSTE actuelle : <span className="font-bold">{row.currentCategory || "—"}</span></div>
                          <div className="mt-1 text-rose-700">Proposition : <span className="font-black">aucune</span></div>
                          <div className="mt-1 font-bold text-slate-600">Raison : {row.categoryReason || "aucune règle de classification correspondante"}</div>
                          <div className="mt-1 break-all text-[10px] text-slate-400">Chemin/source Stockman : {row.sourceUrl || "—"}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-orange-100 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                  Produits autonomes reclassés hors audit catégorie ({(classificationAudit.rows || []).filter((row: any) => row.productKind === "accessory" || row.productKind === "discontinued").length})
                </summary>
                <div className="max-h-[520px] overflow-auto border-t border-orange-100 p-3">
                  <div className="grid gap-2">
                    {(classificationAudit.rows || [])
                      .filter((row: any) => row.productKind === "accessory" || row.productKind === "discontinued")
                      .map((row: any) => (
                        <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-[11px]">
                          <div className="font-black text-slate-950">{row.code} · {row.name}</div>
                          <div className={`mt-1 font-black ${row.productKind === "discontinued" ? "text-slate-500" : "text-orange-700"}`}>
                            {row.productKind === "discontinued" ? "Produit arrêté" : "Accessoire autonome haute confiance"}
                          </div>
                          <div className="mt-1 text-slate-400">{row.sourceUrl || "—"}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-amber-100 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">
                  Accessoires haute confiance / produits arrêtés détectés
                </summary>
                <div className="max-h-[620px] overflow-auto border-t border-amber-100 p-3">
                  <div className="grid gap-2">
                    {(classificationAudit.rows || [])
                      .filter((row: any) => row.accessoryCandidates?.length || row.discontinued?.length)
                      .map((row: any) => (
                        <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="text-xs font-black text-slate-950">{row.code} · {row.name}</div>
                          {row.accessoryCandidates?.length ? (
                            <div className="mt-2 text-[11px] font-bold text-amber-800">
                              Accessoires haute confiance ({row.accessoryCandidates.length}) : {row.accessoryCandidates.map((item: any) => item.code).join(", ")}
                            </div>
                          ) : null}
                          {row.discontinued?.length ? (
                            <div className="mt-1 text-[11px] font-bold text-slate-500">
                              Arrêtés ({row.discontinued.length}) : {row.discontinued.map((item: any) => item.code).join(", ")}
                            </div>
                          ) : null}
                          <div className="mt-1 text-[10px] text-slate-400">{row.normalVariants} variante(s) métier conservée(s) dans le diagnostic.</div>
                        </div>
                      ))}
                  </div>
                </div>
              </details>

              <div className="rounded-xl border border-indigo-200 bg-white p-3 text-[11px] font-bold leading-5 text-indigo-900">
                Diagnostic uniquement : aucune catégorie, variante ou accessoire n'est modifié automatiquement dans cette version.
              </div>
            </div>
          ) : null}
        </div>

<label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">URL de départ</span>
            <input value={seedUrl} onChange={(event) => setSeedUrl(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-50" />
          </label>
          <button type="button" onClick={() => void runScan()} disabled={!enabled || loading || linking || restoringPersistentAudit} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-xs font-black text-white disabled:opacity-50">
            {loading ? <LoaderCircle size={17} className="animate-spin" /> : <ScanSearch size={17} />}
            {loading ? "Audit exhaustivité en cours…" : restoringPersistentAudit ? "Restauration du dernier audit…" : "Auditer tout l’intranet STOCKMAN"}
          </button>
          {persistentAuditDate ? <p className="mt-2 text-[10px] font-bold text-emerald-700">V2.12.8.2 · Audit persistant restauré depuis PostgreSQL · {new Date(persistentAuditDate).toLocaleString("fr-FR")}</p> : null}
        </div>
        {loading && progress ? <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-cyan-900">
          <div className="flex items-center justify-between gap-3 text-xs font-black">
            <span>{progress.message}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-cyan-100">
            <div className="h-full rounded-full bg-[#00a1b5] transition-all duration-500" style={{ width: `${Math.max(2, Math.min(100, progress.percent))}%` }} />
          </div>
          <div className="mt-3 grid gap-2 text-[10px] font-bold text-cyan-800 sm:grid-cols-2 lg:grid-cols-5">
            <span>Pages : {progress.pagesVisited}</span>
            <span>Fiches trouvées : {progress.productUrlsFound}</span>
            <span>Fiches lues : {progress.productPagesProcessed}</span>
            <span>Références : {progress.referencesFound}</span>
            <span>Échecs : {progress.failures}</span>
          </div>
        </div> : loading ? <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-xs font-bold text-cyan-800">Démarrage du job Stockman…</div> : null}
        {message ? <div className="mt-4 flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700"><AlertCircle size={18} className="shrink-0" /><pre className="min-w-0 whitespace-pre-wrap break-words font-sans">{message}</pre></div> : null}

        {scan ? <>
          <div className={`mt-5 rounded-2xl border p-4 ${scan.diagnostics.scanComplete ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <p className="text-xs font-black uppercase tracking-[0.14em]">Audit exhaustivité STOCKMAN · V2.12.3</p>
            <p className="mt-2 text-sm font-black">
              {scan.diagnostics.scanComplete
                ? `Scan complet : ${scan.totals.discovered} référence(s) Stockman détectée(s).`
                : `Scan incomplet : ${scan.totals.discovered} référence(s) détectée(s), mais au moins une limite ou un échec empêche de certifier l'exhaustivité.`}
            </p>
            <p className="mt-1 text-xs font-bold opacity-80">
              {scan.pagesVisited} page(s) explorée(s) · {scan.diagnostics.uniqueProductUrls} fiche(s) produit détectée(s) · {scan.diagnostics.browseQueueRemaining ?? 0} page(s) encore en attente.
            </p>
          </div>
          {scan.differential ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Déjà présent dans OYSTE" value={scan.differential.presentInOyste} tone="success" />
              <Metric label="À préparer pour import" value={scan.differential.toImport} tone="warning" />
              <Metric label="À vérifier avant décision" value={scan.differential.toReview} tone="info" />
              <Metric label="Disparu de Stockman" value={scan.differential.disappearedFromStockman} tone={scan.differential.disappearedFromStockman > 0 ? "danger" : "success"} />
              <Metric label="Brouillons d’import préparés" value={scan.differential.preparedForImport ?? 0} tone="info" />
            </div>
          ) : null}

          {scan.differential && (scan.differential.toImport + scan.differential.toReview) > 0 ? (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 md:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-800">V2.12.6 · Résolution finale + contrôle structurel des références</p>
                  <p className="mt-2 max-w-4xl text-sm font-bold leading-6 text-slate-700">
                    Règle finale : une référence STOCKMAN différente est un article fournisseur distinct à importer. Les références identiques déjà présentes ne sont jamais réimportées ; lorsqu'elles apparaissent sur plusieurs objets OYSTE, un second audit distingue une structure parent/variante normale d'un vrai doublon. Dry-run strict : aucune donnée n'est modifiée.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void auditUnresolvedReferences()}
                  disabled={auditingUnresolved || loading}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-xs font-black text-white disabled:opacity-50"
                >
                  {auditingUnresolved ? <LoaderCircle size={16} className="animate-spin" /> : <ScanSearch size={16} />}
                  {auditingUnresolved ? "Analyse des références…" : `Analyser les ${scan.differential.toImport + scan.differential.toReview} restantes`}
                </button>
              </div>

              {unresolvedAudit ? (
                <div className="mt-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="À importer" value={unresolvedAudit.toImport} tone="warning" />
                    <Metric label="Déjà présentes / doublons" value={unresolvedAudit.existing} tone="success" />
                    <Metric label="Encore ambiguës" value={unresolvedAudit.ambiguous} tone={unresolvedAudit.ambiguous ? "danger" : "success"} />
                  </div>

                  {unresolvedAudit.toImport > 0 ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xs font-black text-emerald-950">V2.12.7 · Préparer les {unresolvedAudit.toImport} références manquantes</p>
                          <p className="mt-1 text-[11px] font-bold leading-5 text-emerald-800">
                            Relit STOCKMAN par lots de 20 et prépare les brouillons avec PA HT, stock, poids et source. Les références déjà présentes sont bloquées côté serveur.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void prepareResolvedImports()}
                          disabled={preparingImports}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                        >
                          {preparingImports ? <LoaderCircle size={15} className="animate-spin" /> : <Database size={15} />}
                          {preparingImports ? "Préparation…" : `Préparer les ${unresolvedAudit.toImport}`}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {unresolvedAudit.existing > 0 ? (
                    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xs font-black text-indigo-950">Contrôle des références portées par plusieurs objets OYSTE</p>
                          <p className="mt-1 text-[11px] font-bold leading-5 text-indigo-800">
                            Vérifie si les occurrences identiques sont simplement un produit parent + sa variante principale, ou de vrais doublons entre plusieurs produits.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void auditDuplicateStructure()}
                          disabled={auditingDuplicateStructure}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                        >
                          {auditingDuplicateStructure ? <LoaderCircle size={15} className="animate-spin" /> : <Database size={15} />}
                          {auditingDuplicateStructure ? "Contrôle…" : `Auditer les ${unresolvedAudit.existing}`}
                        </button>
                      </div>

                      {duplicateStructureAudit ? (
                        <div className="mt-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Metric label="Parent + variante normale" value={duplicateStructureAudit.parentVariantStructures} tone="success" />
                            <Metric label="Vrais doublons" value={duplicateStructureAudit.realDuplicates} tone={duplicateStructureAudit.realDuplicates ? "danger" : "success"} />
                            <Metric label="Structure inhabituelle" value={duplicateStructureAudit.sameProductDuplicates} tone={duplicateStructureAudit.sameProductDuplicates ? "warning" : "success"} />
                            <Metric label="Plus doublonnées" value={duplicateStructureAudit.notDuplicates} tone="info" />
                          </div>
                          <div className="mt-3 grid gap-2">
                            {duplicateStructureAudit.rows.map((row) => (
                              <div key={`dup-${row.reference}`} className="rounded-xl border border-indigo-100 bg-white p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-black text-slate-950">{row.reference}</p>
                                  <span className="text-[10px] font-black uppercase tracking-wide text-indigo-700">
                                    {row.classification === "parent_variant_structure"
                                      ? "Structure parent / variante"
                                      : row.classification === "real_duplicate"
                                        ? "Vrai doublon"
                                        : row.classification === "same_product_duplicate"
                                          ? "À contrôler"
                                          : "Pas de doublon"}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] font-bold leading-5 text-slate-600">{row.reason}</p>
                                <p className="mt-1 text-[10px] font-bold text-slate-500">
                                  {row.objects.map((item) => `${item.targetType === "product" ? "Produit" : "Variante"} · ${item.name}`).join(" · ")}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {(["to_import", "existing", "ambiguous"] as const).map((decision) => {
                    const rows = unresolvedAudit.rows.filter((row) => row.decision === decision);
                    if (!rows.length) return null;
                    const label = decision === "to_import" ? "À importer" : decision === "existing" ? "Déjà présentes / doublons OYSTE" : "Encore ambiguës";
                    return (
                      <details key={decision} className="mt-3 rounded-xl border border-violet-100 bg-white p-3">
                        <summary className="cursor-pointer text-xs font-black text-slate-900">{label} · {rows.length}</summary>
                        <div className="mt-3 grid gap-2">
                          {rows.map((row) => (
                            <div key={`${decision}-${row.reference}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-[#007f8f] hover:underline">
                                  {row.reference} · {row.designation}
                                </a>
                                <span className="text-[10px] font-black text-slate-400">confiance {row.confidence}%</span>
                              </div>
                              <p className="mt-1 text-[11px] font-bold leading-5 text-slate-600">{row.reason}</p>
                              {row.candidate ? (
                                <p className="mt-1 text-[10px] font-bold text-emerald-700">
                                  Cible : {row.candidate.targetReference} · {row.candidate.targetName}
                                </p>
                              ) : null}
                              {row.candidates?.length ? (
                                <p className="mt-1 text-[10px] font-bold text-slate-500">
                                  Candidats : {row.candidates.slice(0, 3).map((candidate) => `${candidate.targetReference} (${candidate.score}%)`).join(" · ")}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {scan.livingReference ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Référentiel connu" value={scan.livingReference.totalKnown} tone="info" />
              <Metric label="Vues ce scan" value={scan.livingReference.seenThisScan} tone="success" />
              <Metric label="Nouvelles références" value={scan.livingReference.newThisScan} tone={scan.livingReference.newThisScan > 0 ? "warning" : "success"} />
              <Metric label="Références modifiées" value={scan.livingReference.changedThisScan} tone={scan.livingReference.changedThisScan > 0 ? "warning" : "success"} />
              <Metric label="Disparues depuis le scan précédent" value={scan.livingReference.disappearedSincePreviousScan} tone={scan.livingReference.disappearedSincePreviousScan > 0 ? "danger" : "success"} />
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Metric label="Références Stockman" value={scan.totals.discovered} />
            <Metric label="Exactes" value={scan.totals.exact} tone="success" />
            <Metric label="Normalisées" value={scan.totals.normalized} tone="success" />
            <Metric label="Équivalences Excel" value={scan.totals.equivalence} tone="success" />
            <Metric label="Suggestions" value={scan.totals.suggested} tone="info" />
            <Metric label="Ambiguës" value={scan.totals.ambiguous} tone="danger" />
            <Metric label="Non reconnues" value={scan.totals.missing} tone="warning" />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Excel sans cible OYSTE" value={scan.totals.missingAnalysis?.excelUnmapped ?? 0} tone="info" />
            <Metric label="Référence proche" value={scan.totals.missingAnalysis?.referenceClose ?? 0} tone="warning" />
            <Metric label="Désignation proche" value={scan.totals.missingAnalysis?.designationClose ?? 0} tone="warning" />
            <Metric label="Famille probable" value={scan.totals.missingAnalysis?.familyProbable ?? 0} tone="info" />
            <Metric label="Absence confirmée" value={scan.totals.missingAnalysis?.confirmedMissing ?? scan.totals.missing} tone="danger" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Metric label="Liens produit détectés" value={scan.diagnostics.productLinksCollected} tone="info" />
            <Metric label="URL produit uniques" value={scan.diagnostics.uniqueProductUrls} tone="info" />
            <Metric label="Ouvertures tentées" value={scan.diagnostics.productPageAttempts} />
            <Metric label="Fiches ouvertes" value={scan.diagnostics.productPagesOpened} tone="success" />
            <Metric label="Ouvertures échouées" value={scan.diagnostics.productPageFailures} tone={scan.diagnostics.productPageFailures > 0 ? "danger" : "success"} />
            <Metric label="Redirections" value={scan.diagnostics.productPageRedirects} tone={scan.diagnostics.productPageRedirects > 0 ? "warning" : "default"} />
            <Metric label="Fiches avec référence" value={scan.diagnostics.productPagesWithReferences} tone="success" />
            <Metric label="Fiches sans référence" value={scan.diagnostics.productPagesWithoutReferences} tone={scan.diagnostics.productPagesWithoutReferences > 0 ? "danger" : "success"} />
            <Metric label="Occurrences extraites" value={scan.diagnostics.extractedOccurrences} tone="info" />
            <Metric label="Doublons référence" value={scan.diagnostics.duplicateReferences} />
            <Metric label="Détections tableau" value={scan.diagnostics.extractedFromRows} tone="info" />
            <Metric label="Détections texte" value={scan.diagnostics.extractedFromBody} tone="info" />
          </div>

          {scan.diagnostics.noReferenceSamples.length > 0 ? (
            <details className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-xs text-orange-900">
              <summary className="cursor-pointer font-black">Diagnostic : exemples de fiches sans référence ({scan.diagnostics.noReferenceSamples.length})</summary>
              <div className="mt-3 grid gap-1">
                {scan.diagnostics.noReferenceSamples.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="truncate font-semibold text-orange-800 hover:underline">{url}</a>)}
              </div>
            </details>
          ) : null}

          {scan.diagnostics.failedPageSamples.length > 0 ? (
            <details className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900">
              <summary className="cursor-pointer font-black">Diagnostic : exemples d’ouvertures échouées ({scan.diagnostics.failedPageSamples.length})</summary>
              <div className="mt-3 grid gap-1">
                {scan.diagnostics.failedPageSamples.map((entry) => <p key={entry} className="break-all font-semibold text-red-800">{entry}</p>)}
              </div>
            </details>
          ) : null}

          {scan.livingReference?.disappearanceCheckSkipped ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">
              {scan.livingReference.disappearanceCheckReason ?? "Le contrôle des disparitions a été neutralisé pour ce scan incomplet."}
            </div>
          ) : null}

          {scan.livingReference?.disappearedReferences?.length ? (
            <details className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900">
              <summary className="cursor-pointer font-black">Références disparues de Stockman ({scan.livingReference.disappearedSincePreviousScan})</summary>
              <div className="mt-3 grid gap-2">
                {scan.livingReference.disappearedReferences.map((item) => (
                  <a key={item.reference} href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-red-800 hover:underline">
                    {item.reference} · {item.designation}
                  </a>
                ))}
              </div>
            </details>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-950 p-5 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Résultat du rapprochement</p>
              <p className="mt-2 text-sm font-bold">{scan.pagesVisited} pages · {scan.productPages} fiches · {scan.totals.matched} association(s) sûre(s) à valider · {scan.totals.alreadyLinked} déjà liée(s)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-xs font-black"><Download size={15} />Exporter CSV</button>
              <button type="button" onClick={() => void prepareSelectedImports()} disabled={preparingImports || selectedImports.size === 0} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-40">
                {preparingImports ? <LoaderCircle size={15} className="animate-spin" /> : <PackageSearch size={15} />}
                Préparer {selectedImports.size} import(s)
              </button>
              <button type="button" onClick={() => void linkSelected()} disabled={linking || selected.size === 0} className="inline-flex items-center gap-2 rounded-xl bg-[#00a1b5] px-4 py-2.5 text-xs font-black disabled:opacity-40">
                {linking ? <LoaderCircle size={15} className="animate-spin" /> : <Link2 size={15} />}
                Valider {selected.size} association(s)
              </button>
            </div>
          </div>

          {scan.differential ? <div className="mt-4 flex flex-wrap gap-2">
            {([
              ["present", "Déjà dans OYSTE"],
              ["to_import", "À importer"],
              ["to_review", "À vérifier"],
            ] as const).map(([state, label]) => {
              const key = `catalogue:${state}` as CatalogueFilter;
              const count = scan.matches.filter((match) => match.catalogueState === state).length;
              return <button key={state} type="button" onClick={() => setFilter(key)} className={`rounded-full border px-3 py-2 text-[10px] font-black ${filter === key ? "border-cyan-500 bg-cyan-600 text-white" : "border-cyan-100 bg-cyan-50 text-cyan-800"}`}>
                {label} ({count})
              </button>;
            })}
          </div> : null}

          {filter === "catalogue:to_import" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={selectVisibleImports} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-800">
                Sélectionner jusqu’à 20 imports non préparés
              </button>
              {selectedImports.size > 0 ? <button type="button" onClick={() => setSelectedImports(new Set())} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600">Vider la sélection import</button> : null}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            {(["all", "matched", "already_linked", "suggested", "missing", "ambiguous"] as Filter[]).map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-2 text-[10px] font-black ${filter === item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
                {filterLabel(item)} ({item === "all" ? scan.matches.length : scan.matches.filter((match) => match.status === item).length})
              </button>
            ))}
          </div>
          {scan.totals.missing > 0 ? <div className="mt-2 flex flex-wrap gap-2">
            {([
              "excel_unmapped",
              "reference_close",
              "designation_close",
              "family_probable",
              "confirmed_missing",
            ] as StockmanMissingKind[]).map((kind) => {
              const key = `missing:${kind}` as MissingFilter;
              const count = scan.matches.filter((match) => match.status === "missing" && match.missingKind === kind).length;
              return <button key={kind} type="button" onClick={() => setFilter(key)} className={`rounded-full border px-3 py-2 text-[10px] font-black ${filter === key ? "border-orange-400 bg-orange-500 text-white" : "border-orange-100 bg-orange-50 text-orange-800"}`}>
                {missingKindLabel(kind)} ({count})
              </button>;
            })}
          </div> : null}

          <div className="mt-3 max-h-[620px] overflow-auto rounded-2xl border border-slate-200">
            {visible.map((item) => {
              const canLink = item.status === "matched";
              const canPrepare = item.catalogueState === "to_import" && !item.importPrepared;
              const isChecked = canLink ? selected.has(item.reference) : selectedImports.has(item.reference);
              return <div key={item.reference} className="flex items-start gap-3 border-b border-slate-100 p-4 last:border-0">
                <input type="checkbox" checked={isChecked} disabled={!canLink && !canPrepare} onChange={() => {
                  if (canLink) {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(item.reference)) next.delete(item.reference); else next.add(item.reference);
                      return next;
                    });
                  } else if (canPrepare) {
                    setSelectedImports((current) => {
                      const next = new Set(current);
                      if (next.has(item.reference)) next.delete(item.reference); else next.add(item.reference);
                      return next;
                    });
                  }
                }} className="mt-1 h-4 w-4 accent-[#007f8f]" />
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900">{item.reference} · {item.designation}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${methodClass(item.matchMethod)}`}>{methodLabel(item.matchMethod)} · {item.confidence}%</span>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.targetName
                      ? `OYSTE : ${item.targetName}${item.targetReference ? ` · réf. ${item.targetReference}` : ""}`
                      : item.candidateCount
                        ? `${item.candidateCount} correspondances possibles`
                        : item.category
                          ? `Catégorie : ${item.category}`
                          : "Aucune correspondance fiable"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.catalogueState ? <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${catalogueStateClass(item.catalogueState)}`}>{catalogueStateLabel(item.catalogueState)}</span> : null}
                    {item.importPrepared ? <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-800">Brouillon import prêt</span> : null}
                    {item.missingKind ? <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-orange-800">{missingKindLabel(item.missingKind)}</span> : null}
                  </div>
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-600">
                    <span className="font-black text-slate-800">Pourquoi :</span> {item.reason}
                  </p>
                  {item.equivalentReference && item.equivalentReference !== item.reference ? <p className="mt-1 text-[10px] font-bold text-orange-700">Équivalence utilisée : {item.reference} → {item.equivalentReference}</p> : null}
                  {item.suggestions && item.suggestions.length > 0 && (item.status === "ambiguous" || item.status === "suggested" || item.status === "missing") ? (
                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {item.suggestions.slice(0, 3).map((suggestion, index) => (
                        <div key={`${suggestion.targetType}:${suggestion.targetId}`} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Option {index + 1}</span>
                            <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-700">{suggestion.confidence}%</span>
                          </div>
                          <p className="mt-1 text-xs font-black text-slate-800">{suggestion.targetReference} · {suggestion.targetName}</p>
                          <p className="mt-1 text-[10px] leading-4 text-slate-500">{suggestion.reason}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate text-[10px] font-bold text-[#007f8f] hover:underline">{item.sourceUrl}</a>
                </div>
              </div>;
            })}
          </div>
        </> : null}
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warning" | "danger" | "info" }) {
  const classes = tone === "success"
    ? "border-emerald-200 bg-emerald-50"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : tone === "danger"
        ? "border-red-200 bg-red-50"
        : tone === "info"
          ? "border-cyan-200 bg-cyan-50"
          : "border-slate-200 bg-slate-50";
  return <div className={`rounded-2xl border p-4 ${classes}`}><p className="text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</p></div>;
}

function StatusIcon({ status }: { status: StockmanCatalogMatch["status"] }) {
  if (status === "matched" || status === "already_linked") return <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />;
  if (status === "suggested") return <Sparkles size={18} className="mt-0.5 shrink-0 text-cyan-500" />;
  if (status === "ambiguous") return <TriangleAlert size={18} className="mt-0.5 shrink-0 text-orange-500" />;
  return <PackageSearch size={18} className="mt-0.5 shrink-0 text-slate-400" />;
}

function statusLabel(status: StockmanCatalogMatch["status"]) {
  return status === "matched" ? "À associer" : status === "already_linked" ? "Déjà liée" : status === "suggested" ? "À vérifier" : status === "ambiguous" ? "Ambiguë" : "Non reconnue";
}
function statusClass(status: StockmanCatalogMatch["status"]) {
  return status === "matched" ? "bg-emerald-50 text-emerald-700" : status === "already_linked" ? "bg-cyan-50 text-cyan-700" : status === "suggested" ? "bg-violet-50 text-violet-700" : status === "ambiguous" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-600";
}
function methodLabel(method: StockmanMatchMethod) {
  return method === "exact" ? "Exacte" : method === "normalized" ? "Normalisée" : method === "excel" ? "Équivalence Excel" : method === "suggestion" ? "Suggestion" : "Aucune";
}
function methodClass(method: StockmanMatchMethod) {
  return method === "exact" ? "bg-emerald-100 text-emerald-800" : method === "normalized" ? "bg-cyan-100 text-cyan-800" : method === "excel" ? "bg-orange-100 text-orange-800" : method === "suggestion" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-600";
}
function missingKindLabel(kind: StockmanMissingKind) {
  return kind === "excel_unmapped" ? "Excel sans cible OYSTE"
    : kind === "reference_close" ? "Référence proche"
      : kind === "designation_close" ? "Désignation proche"
        : kind === "family_probable" ? "Famille probable"
          : "Absence confirmée";
}
function catalogueStateLabel(state: StockmanCatalogueState) {
  return state === "present" ? "Déjà dans OYSTE" : state === "to_import" ? "À préparer pour import" : "À vérifier";
}
function catalogueStateClass(state: StockmanCatalogueState) {
  return state === "present" ? "bg-emerald-50 text-emerald-700"
    : state === "to_import" ? "bg-amber-50 text-amber-800"
      : "bg-cyan-50 text-cyan-800";
}
function filterLabel(filter: Filter) {
  if (filter === "all") return "Tout";
  if (filter.startsWith("missing:")) return missingKindLabel(filter.slice("missing:".length) as StockmanMissingKind);
  if (filter.startsWith("catalogue:")) return catalogueStateLabel(filter.slice("catalogue:".length) as StockmanCatalogueState);
  return statusLabel(filter as StockmanCatalogMatch["status"]);
}
function csvCell(value: string) { return `"${value.replace(/"/g, '""')}"`; }
