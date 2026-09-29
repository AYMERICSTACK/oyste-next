export type StockmanCompletenessInput = {
  scanComplete?: boolean;
  browseLimitReached?: boolean;
  productLimitReached?: boolean;
  queueLimitReached?: boolean;
  discardedUrls?: number;
  unvisitedUrls?: number;
  navigationErrors?: number;
  productErrors?: number;
};

export function hasProvenCompleteStockmanScan(diagnostics: StockmanCompletenessInput) {
  return diagnostics.scanComplete === true
    && diagnostics.browseLimitReached !== true
    && diagnostics.productLimitReached !== true
    && diagnostics.queueLimitReached !== true
    && (diagnostics.discardedUrls ?? 0) === 0
    && (diagnostics.unvisitedUrls ?? 0) === 0
    && (diagnostics.navigationErrors ?? 0) === 0
    && (diagnostics.productErrors ?? 0) === 0;
}
