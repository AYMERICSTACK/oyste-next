export type StockmanProduct = {
  reference: string;
  designation: string;
  purchasePriceExVat: number;
  priceOnRequest?: boolean;
  stock: number;
  weightKg: number | null;
  stockOnRequest?: boolean;
  sourceUrl: string;
  readAt: string;
  shortDescription?: string | null;
  detailedDescription?: string | null;
  images?: Array<{ url: string; altText?: string | null }>;
  documents?: Array<{ name: string; url: string; type: "TECHNICAL_SHEET" | "INSTALLATION_MANUAL" | "DIMENSION_DRAWING" | "CERTIFICATE" | "COMMERCIAL_DOCUMENT" | "OTHER" }>;
  features?: Array<{ label: string; value: string }>;
};

export type StockmanCommercialFamily = {
  sourceUrl: string;
  pageUrl: string;
  familyReference: string;
  familyDesignation: string;
  products: StockmanProduct[];
  kind: "product_page" | "category_or_non_commercial";
};

export type StockmanConnectionStatus = {
  configured: boolean;
  authFile: string;
  authFileExists: boolean;
  message: string;
};

export type StockmanSessionHealth = {
  state: "missing" | "valid" | "expired";
  valid: boolean;
  message: string;
};

export type StockmanSyncField = "price" | "stock" | "weight";

export type StockmanSyncResult = {
  targetType: "product" | "variant";
  targetId: string;
  productId: string;
  name: string;
  reference: string;
  previous: { stock: number; weightKg: number | null; purchasePriceExVat: number | null };
  current: { stock: number; weightKg: number | null; purchasePriceExVat: number };
  syncedAt: string;
  status: "updated" | "unchanged";
  changedFields: StockmanSyncField[];
};

export type StockmanProductSyncTarget = {
  targetType: "product" | "variant";
  targetId: string;
  productId?: string;
  name: string;
  reference: string;
  designation: string;
  stock: number;
  weightKg: number | null;
  purchasePriceExVat: number | null;
  sourceUrl: string;
  syncedAt: string | null;
};

export type StockmanBulkTarget = Pick<StockmanProductSyncTarget,
  "targetType" | "targetId" | "name" | "reference" | "sourceUrl" | "syncedAt"
> & {
  productId: string;
};


export type StockmanBulkDashboard = {
  linked: number;
  synchronized: number;
  neverSynchronized: number;
  stale: number;
  latestSyncAt: string | null;
};

export type StockmanBulkRunSummary = {
  startedAt?: string;
  finishedAt: string;
  durationSeconds?: number;
  total: number;
  processed: number;
  updated: number;
  unchanged: number;
  errors: number;
  stopped: boolean;
};

export type StockmanBulkItemResult = {
  target: StockmanBulkTarget;
  status: "updated" | "unchanged" | "error";
  changedFields: StockmanSyncField[];
  message?: string;
  sync?: StockmanSyncResult;
};

export type StockmanMatchMethod = "exact" | "normalized" | "excel" | "suggestion" | "none";

export type StockmanMissingKind =
  | "excel_unmapped"
  | "reference_close"
  | "designation_close"
  | "family_probable"
  | "confirmed_missing";

export type StockmanMatchSuggestion = {
  targetType: "product" | "variant";
  targetId: string;
  productId: string;
  targetName: string;
  targetReference: string;
  confidence: number;
  reason: string;
  equivalentReference?: string;
};

export type StockmanCatalogMatch = {
  reference: string;
  designation: string;
  sourceUrl: string;
  category: string | null;
  status: "matched" | "missing" | "ambiguous" | "already_linked" | "suggested";
  matchMethod: StockmanMatchMethod;
  confidence: number;
  reason: string;
  suggestions?: StockmanMatchSuggestion[];
  missingKind?: StockmanMissingKind;
  equivalentReference?: string;
  targetReference?: string;
  candidateCount?: number;
  targetType?: "product" | "variant";
  targetId?: string;
  productId?: string;
  targetName?: string;
  catalogueState?: StockmanCatalogueState;
  importPrepared?: boolean;
};

export type StockmanCatalogScanDiagnostics = {
  productLinksCollected: number;
  uniqueProductUrls: number;
  productPageAttempts: number;
  productPagesOpened: number;
  productPageFailures: number;
  productPageRedirects: number;
  productPagesWithReferences: number;
  productPagesWithoutReferences: number;
  extractedOccurrences: number;
  duplicateReferences: number;
  extractedFromRows: number;
  extractedFromBody: number;
  noReferenceSamples: string[];
  failedPageSamples: string[];
  browseQueueRemaining?: number;
  browseLimitReached?: boolean;
  productLimitReached?: boolean;
  scanComplete?: boolean;
};



export type StockmanLivingDisappearedReference = {
  reference: string;
  designation: string;
  sourceUrl: string;
  lastSeenAt: string;
};

export type StockmanLivingReferenceStats = {
  totalKnown: number;
  seenThisScan: number;
  newThisScan: number;
  changedThisScan: number;
  disappearedSincePreviousScan: number;
  disappearedReferences: StockmanLivingDisappearedReference[];
  disappearanceCheckSkipped?: boolean;
  disappearanceCheckReason?: string;
};


export type StockmanUnresolvedAuditDecision = "existing" | "to_import" | "ambiguous";

export type StockmanUnresolvedAuditCandidate = {
  targetType: "product" | "variant";
  targetId: string;
  productId: string;
  targetReference: string;
  targetName: string;
  category: string;
  score: number;
  referenceScore: number;
  designationScore: number;
};

export type StockmanUnresolvedAuditRow = {
  reference: string;
  designation: string;
  sourceUrl: string;
  category: string | null;
  previousState: StockmanCatalogueState;
  decision: StockmanUnresolvedAuditDecision;
  confidence: number;
  reason: string;
  candidate?: StockmanUnresolvedAuditCandidate;
  candidates?: StockmanUnresolvedAuditCandidate[];
};

export type StockmanUnresolvedAudit = {
  version: "V2.12.6";
  auditedAt: string;
  total: number;
  existing: number;
  toImport: number;
  ambiguous: number;
  rows: StockmanUnresolvedAuditRow[];
  dryRun: true;
};


export type StockmanDuplicateStructureObject = {
  targetType: "product" | "variant";
  targetId: string;
  productId: string;
  reference: string;
  name: string;
  category: string;
  publicationStatus: string;
  mediaCount: number;
  documentCount: number;
  featureCount: number;
  variantCount: number;
  hasSourceData: boolean;
  priceHt: number | null;
  stock: number;
  weightKg: number | null;
};

export type StockmanDuplicateStructureClassification =
  | "parent_variant_structure"
  | "real_duplicate"
  | "same_product_duplicate"
  | "not_duplicate";

export type StockmanDuplicateStructureRow = {
  reference: string;
  classification: StockmanDuplicateStructureClassification;
  reason: string;
  objectCount: number;
  productCount: number;
  recommendedKeepTargetId: string | null;
  objects: StockmanDuplicateStructureObject[];
};

export type StockmanDuplicateStructureAudit = {
  version: "V2.12.6";
  auditedAt: string;
  totalReferences: number;
  parentVariantStructures: number;
  realDuplicates: number;
  sameProductDuplicates: number;
  notDuplicates: number;
  rows: StockmanDuplicateStructureRow[];
  dryRun: true;
};

export type StockmanCatalogueState = "present" | "to_import" | "to_review";

export type StockmanCatalogueDifferential = {
  presentInOyste: number;
  toImport: number;
  toReview: number;
  disappearedFromStockman: number;
  preparedForImport: number;
};

export type StockmanCatalogDiscovery = {
  startedAt: string;
  finishedAt: string;
  pagesVisited: number;
  productPages: number;
  diagnostics: StockmanCatalogScanDiagnostics;
  totals: {
    discovered: number;
    matched: number;
    exact: number;
    normalized: number;
    equivalence: number;
    suggested: number;
    missing: number;
    ambiguous: number;
    missingAnalysis: {
      excelUnmapped: number;
      referenceClose: number;
      designationClose: number;
      familyProbable: number;
      confirmedMissing: number;
    };
    alreadyLinked: number;
  };
  matches: StockmanCatalogMatch[];
  warnings: string[];
  livingReference?: StockmanLivingReferenceStats;
  differential?: StockmanCatalogueDifferential;
};

export type StockmanDiscoveryJobPhase = "queued" | "catalogue" | "products" | "matching" | "completed" | "failed";

export type StockmanDiscoveryJobProgress = {
  phase: StockmanDiscoveryJobPhase;
  percent: number;
  message: string;
  pagesVisited: number;
  productUrlsFound: number;
  productPagesProcessed: number;
  referencesFound: number;
  failures: number;
  updatedAt: string;
};

export type StockmanDiscoveryJobStatus = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: StockmanDiscoveryJobProgress;
  result?: StockmanCatalogDiscovery;
  error?: string;
};
