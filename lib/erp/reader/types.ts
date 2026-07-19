import type { ErpSnapshot } from "../types";

export type ErpRawRow = Record<string, unknown>;
export type ErpSheetName = keyof ErpSnapshot["sheets"];

export type ErpRawWorkbook = {
  source: string;
  sheets: ErpSnapshot["sheets"];
  ouvragesRows: ErpRawRow[];
  detailsRows: ErpRawRow[];
  productsRows: ErpRawRow[];
  joinedRows: ErpRawRow[];
};

export type ErpSheetDetectionResult = {
  sheets: Partial<ErpSnapshot["sheets"]>;
  missing: ErpSheetName[];
};
