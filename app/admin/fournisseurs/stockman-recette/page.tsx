import { notFound } from "next/navigation";
import StockmanQaImport from "./stockman-qa-import";

export const dynamic = "force-dynamic";

export default function StockmanQaImportPage() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "recette-stockman-isolee"
    || process.env.OYSTE_STOCKMAN_TEST !== "true") notFound();
  return <StockmanQaImport />;
}
