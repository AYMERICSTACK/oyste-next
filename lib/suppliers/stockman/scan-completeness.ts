export type StockmanCompletenessInput = {
  scanComplete?: boolean;
  browseLimitReached?: boolean;
  productLimitReached?: boolean;
  queueLimitReached?: boolean;
  discardedUrls?: number;
  unvisitedUrls?: number;
  navigationErrors?: number;
  productErrors?: number;
  productPageFailures?: number;
  browseQueueRemaining?: number;
  globalIncidentActive?: boolean;
};

export function hasProvenCompleteStockmanScan(diagnostics: StockmanCompletenessInput) {
  return diagnostics.scanComplete === true
    && diagnostics.browseLimitReached === false
    && diagnostics.productLimitReached === false
    && diagnostics.queueLimitReached === false
    && diagnostics.discardedUrls === 0
    && diagnostics.unvisitedUrls === 0
    && diagnostics.navigationErrors === 0
    && diagnostics.productErrors === 0
    && diagnostics.productPageFailures === 0
    && diagnostics.browseQueueRemaining === 0
    && diagnostics.globalIncidentActive !== true;
}

export function stockmanPartialReasons(diagnostics: StockmanCompletenessInput) {
  const reasons: string[] = [];
  if (diagnostics.browseLimitReached) reasons.push("Limite de pages browse atteinte");
  if (diagnostics.productLimitReached) reasons.push("Limite de fiches produit atteinte");
  if (diagnostics.queueLimitReached) reasons.push("Limite de capacité de queue atteinte");
  if ((diagnostics.discardedUrls ?? 0) > 0) reasons.push(`${diagnostics.discardedUrls} URL(s) rejetée(s) sans visite`);
  if ((diagnostics.unvisitedUrls ?? 0) > 0) reasons.push(`${diagnostics.unvisitedUrls} URL(s) non terminée(s)`);
  if ((diagnostics.navigationErrors ?? 0) > 0) reasons.push(`${diagnostics.navigationErrors} erreur(s) de navigation browse`);
  if ((diagnostics.productErrors ?? 0) > 0 || (diagnostics.productPageFailures ?? 0) > 0) {
    reasons.push(`${Math.max(diagnostics.productErrors ?? 0, diagnostics.productPageFailures ?? 0)} erreur(s) de fiche produit`);
  }
  if ((diagnostics.browseQueueRemaining ?? 0) > 0) reasons.push(`${diagnostics.browseQueueRemaining} page(s) browse encore en attente`);
  if (diagnostics.globalIncidentActive) reasons.push("Incident global HTTP 500 Stockman actif");
  if (diagnostics.scanComplete !== true && reasons.length === 0) reasons.push("Preuve stricte de couverture globale absente");
  return reasons;
}
