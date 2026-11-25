import assert from "node:assert/strict";
import { Client } from "pg";
import { verifiedDatabaseUrl } from "../lib/db/verified-database-url";

assert.equal(process.env.VERCEL_ENV, "preview", "Recette Vercel uniquement");
assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "recette-stockman-isolee");
assert.equal(process.env.OYSTE_STOCKMAN_TEST, "true");
for (const key of ["CRON_SECRET", "STRIPE_SECRET_KEY", "SENDCLOUD_SECRET_KEY", "UPSTASH_REDIS_REST_TOKEN", "BLOB_READ_WRITE_TOKEN"]) {
  assert(!process.env[key], `Le service ${key} doit être déconnecté en recette`);
}
for (const key of ["STOCKMAN_SCHEDULED_COMMERCIAL_READS", "STOCKMAN_SCHEDULED_COMMERCIAL_SYNC", "STOCKMAN_V297_IMPORT_ENABLED", "STOCKMAN_V298_APPLY_APPROVED"]) {
  assert.notEqual(process.env[key], "true", `${key} doit être désactivé en recette`);
}

const db = new Client({ connectionString: verifiedDatabaseUrl(), connectionTimeoutMillis: 10000, query_timeout: 10000 });
try {
  await db.connect();
  const { rows } = await db.query(`
    SELECT p.code, price."priceHt"::text AS price, p."shippingMode"::text AS transport
    FROM "OysteQaMarker" marker
    JOIN "Product" p ON p.code = $2
    JOIN "StockmanSalePrice" price ON price.reference = p.code
    WHERE marker.environment = $1 AND price."sourceVersion" = 'RECETTE'
  `, ["recette-stockman-isolee", "QASTOCK1"]);
  assert.deepEqual(rows, [{ code: "QASTOCK1", price: "119.00", transport: "QUOTE" }]);
  console.log("STOCKMAN QA: isolated Neon marker and synthetic product verified");
} catch {
  throw new Error("STOCKMAN QA: the expected isolated Neon fixture could not be verified");
} finally {
  await db.end();
}
