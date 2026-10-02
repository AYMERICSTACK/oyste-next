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
    && diagnostics.browseQueueRemaining === 0;
}
