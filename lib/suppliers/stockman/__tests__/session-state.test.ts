import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeStockmanStorageState } from "../session-state";

const cookie = (name: string, value: string, expires: number) => ({
  name,
  value,
  domain: "www.stockman.fr",
  path: "/",
  expires,
  httpOnly: false,
  secure: false,
  sameSite: "Lax" as const,
});

test("retire uniquement le contexte ASP.NET éphémère de la session persistée", () => {
  const source = {
    cookies: [
      cookie("ASP.NET_SessionId", "volatile-secret", -1),
      cookie("cookie_customer", "durable-secret", 1_800_000_000),
      cookie("cookie_internal", "durable-internal-secret", 1_800_000_000),
    ],
    origins: [
      {
        origin: "https://www.stockman.fr",
        localStorage: [{ name: "preference", value: "fr" }],
      },
    ],
  };

  const result = sanitizeStockmanStorageState(source);

  assert.equal(result.removedVolatileCookies, 1);
  assert.deepEqual(
    result.state.cookies.map((item) => item.name),
    ["cookie_customer", "cookie_internal"],
  );
  assert.deepEqual(result.state.origins, source.origins);
  assert.equal(source.cookies.length, 3, "la valeur source ne doit pas être mutée");
});

test("la normalisation est idempotente et insensible à la casse", () => {
  const source = {
    cookies: [cookie("asp.net_SESSIONid", "volatile-secret", -1)],
    origins: [],
  };

  const first = sanitizeStockmanStorageState(source);
  const second = sanitizeStockmanStorageState(first.state);

  assert.equal(first.removedVolatileCookies, 1);
  assert.equal(second.removedVolatileCookies, 0);
  assert.deepEqual(second.state, first.state);
});
