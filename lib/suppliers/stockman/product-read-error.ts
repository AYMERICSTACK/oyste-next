export type StockmanProductReadErrorKind =
  | "supplier_unavailable"
  | "authentication"
  | "invalid_source"
  | "product_read";

export class StockmanProductReadError extends Error {
  constructor(
    message: string,
    readonly kind: StockmanProductReadErrorKind,
  ) {
    super(message);
    this.name = "StockmanProductReadError";
  }
}

export function assertStockmanDocumentStatus(status: number | null) {
  if (status === null) {
    throw new StockmanProductReadError(
      "STOCKMAN n’a renvoyé aucune réponse HTTP exploitable.",
      "supplier_unavailable",
    );
  }
  if (status >= 500) {
    throw new StockmanProductReadError(
      `STOCKMAN est temporairement indisponible (HTTP ${status}).`,
      "supplier_unavailable",
    );
  }
  if (status >= 400) {
    throw new StockmanProductReadError(
      `La fiche STOCKMAN demandée est inaccessible (HTTP ${status}).`,
      "invalid_source",
    );
  }
}

export function classifyStockmanProductReadError(error: unknown): {
  error: string;
  errorKind: StockmanProductReadErrorKind;
} {
  if (error instanceof StockmanProductReadError) {
    return { error: error.message, errorKind: error.kind };
  }
  const message = error instanceof Error ? error.message : "Lecture Stockman impossible.";
  if (/session Stockman a expiré|connexion non authentifié/i.test(message)) {
    return { error: message, errorKind: "authentication" };
  }
  return { error: message, errorKind: "product_read" };
}

export function stockmanPreparationHttpStatus(input: {
  prepared: number;
  errors: Array<{ errorKind?: StockmanProductReadErrorKind }>;
}) {
  if (input.prepared > 0 || input.errors.length === 0) return 200;
  if (input.errors.some((item) => item.errorKind === "supplier_unavailable")) return 503;
  if (input.errors.some((item) => item.errorKind === "authentication")) return 401;
  return 422;
}
