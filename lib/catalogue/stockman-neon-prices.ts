import "server-only";
import { verifiedDatabaseUrl } from "@/lib/db/verified-database-url";
import { Pool } from "pg";

const globalPool=globalThis as unknown as {__stockmanSalePricePool?:Pool};
const pool = globalPool.__stockmanSalePricePool ?? new Pool({
  connectionString: verifiedDatabaseUrl(),
  max: 3,
  query_timeout:10000,
  allowExitOnIdle:true,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
});

if(!globalPool.__stockmanSalePricePool){pool.on("error",()=>console.warn("[STOCKMAN_PRICE_POOL_ERROR]"));globalPool.__stockmanSalePricePool=pool;}

export async function getStockmanNeonPrices(
  references: string[]
): Promise<Map<string, number>> {
  const normalized = [...new Set(
    references.map(ref => ref.trim().toUpperCase()).filter(Boolean)
  )];

  if (normalized.length === 0) {
    return new Map();
  }

  const result = await pool.query<{
    reference: string;
    priceHt: string;
  }>(
    `SELECT "reference", "priceHt"
     FROM "StockmanSalePrice"
     WHERE "reference" = ANY($1::text[])`,
    [normalized]
  );

  return new Map(
    result.rows
      .map(row => [row.reference, Number(row.priceHt)] as const)
      .filter(([, price]) => Number.isFinite(price) && price > 0)
  );
}

export function formatStockmanNeonPrice(
  price: number | undefined
): string {
  if (price === undefined || !Number.isFinite(price) || price <= 0) {
    return "Nous consulter";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price) + " HT";
}