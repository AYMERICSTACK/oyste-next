import path from "node:path";
import { getStockmanAuthFile, stockmanAuthFileExists } from "@/lib/suppliers/stockman/browser";
import type { StockmanConnectionStatus } from "@/lib/suppliers/stockman/types";

export async function getStockmanConnectionStatus(): Promise<StockmanConnectionStatus> {
  const authFile = getStockmanAuthFile();
  const authFileExists = await stockmanAuthFileExists();
  return {
    configured: authFileExists,
    authFile: path.basename(authFile),
    authFileExists,
    message: authFileExists
      ? "Fichier de session locale détecté. OYSTE vérifie séparément si l’accès revendeur est encore actif."
      : `Ajoutez ${path.basename(authFile)} à la racine du projet avant de tester une fiche.`,
  };
}
