import path from "node:path";
import { getStockmanAuthFile, stockmanAuthFileExists } from "@/lib/suppliers/stockman/browser";
import { inspectStockmanSessionPersistence } from "@/lib/suppliers/stockman/session-store";
import type { StockmanConnectionStatus } from "@/lib/suppliers/stockman/types";

export async function getStockmanConnectionStatus(): Promise<StockmanConnectionStatus> {
  const authFile = getStockmanAuthFile();
  const authFileExists = await stockmanAuthFileExists();
  const persistence = await inspectStockmanSessionPersistence();
  const configured = authFileExists || (persistence.dbFound && persistence.decryptOk);
  return {
    configured,
    authFile: path.basename(authFile),
    authFileExists,
    message: configured
      ? "Session Stockman détectée (locale ou persistée). Vérifiez sa validité avant le scan."
      : "Aucune session Stockman détectée : reconnectez-vous depuis le BO.",
  };
}
