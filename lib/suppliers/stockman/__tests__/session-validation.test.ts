import assert from "node:assert/strict";
import test from "node:test";

import { validateSanitizedStockmanSession } from "../session-validation";
import type { StockmanStorageStateLike } from "../session-state";

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

function state(cookies: StockmanStorageStateLike["cookies"]): StockmanStorageStateLike {
  return { cookies, origins: [] };
}

function simulatedBrowser(refreshedState: StockmanStorageStateLike) {
  let receivedState: StockmanStorageStateLike | null = null;
  let closed = false;
  return {
    browser: {
      async newContext(options: { storageState: StockmanStorageStateLike }) {
        receivedState = options.storageState;
        return {
          async newPage() {
            return {};
          },
          async storageState() {
            return refreshedState;
          },
          async close() {
            closed = true;
          },
        };
      },
    },
    receivedState: () => receivedState,
    closed: () => closed,
  };
}

test("valide exactement un état assaini dans un nouveau contexte", async () => {
  const source = state([
    cookie("ASP.NET_SessionId", "volatile-old", -1),
    cookie("cookie_customer", "customer", 1_800_000_000),
    cookie("cookie_internal", "internal", 1_800_000_000),
  ]);
  const simulated = simulatedBrowser(source);

  await validateSanitizedStockmanSession({
    browser: simulated.browser,
    candidateState: source,
    async checkCommercialAccess() {
      return {
        referenceFound: true,
        stockFound: true,
        priceFound: true,
        url: "https://www.stockman.fr/fr/catalogue/produit--CHM.aspx",
      };
    },
  });

  assert.deepEqual(
    simulated.receivedState()?.cookies.map((item) => item.name),
    ["cookie_customer", "cookie_internal"],
  );
  assert.equal(simulated.closed(), true);
});

test("refuse une redirection vers l'accueil avant toute persistance", async () => {
  const source = state([cookie("cookie_customer", "customer", 1_800_000_000)]);
  const simulated = simulatedBrowser(source);
  let persisted = false;

  await assert.rejects(
    async () => {
      const validated = await validateSanitizedStockmanSession({
        browser: simulated.browser,
        candidateState: source,
        async checkCommercialAccess() {
          return {
            referenceFound: false,
            stockFound: false,
            priceFound: false,
            url: "https://www.stockman.fr/fr/",
          };
        },
      });
      persisted = Boolean(validated.persistedState);
    },
    /routeProduit=non/,
  );

  assert.equal(persisted, false);
  assert.equal(simulated.closed(), true);
});

test("refuse une fiche sans prix ou sans stock", async () => {
  const source = state([cookie("cookie_customer", "customer", 1_800_000_000)]);
  const simulated = simulatedBrowser(source);

  await assert.rejects(
    validateSanitizedStockmanSession({
      browser: simulated.browser,
      candidateState: source,
      async checkCommercialAccess() {
        return {
          referenceFound: true,
          stockFound: true,
          priceFound: false,
          url: "https://www.stockman.fr/fr/catalogue/produit--CHM.aspx",
        };
      },
    }),
    /prix=non/,
  );
});

test("conserve le renouvellement persistant et retire la nouvelle session ASP.NET", async () => {
  const source = state([
    cookie("cookie_customer", "old-customer", 1_800_000_000),
    cookie("cookie_internal", "old-internal", 1_800_000_000),
  ]);
  const refreshed = state([
    cookie("ASP.NET_SessionId", "volatile-new", -1),
    cookie("cookie_customer", "new-customer", 1_810_000_000),
    cookie("cookie_internal", "new-internal", 1_810_000_000),
  ]);
  const simulated = simulatedBrowser(refreshed);

  const result = await validateSanitizedStockmanSession({
    browser: simulated.browser,
    candidateState: source,
    async checkCommercialAccess() {
      return {
        referenceFound: true,
        stockFound: true,
        priceFound: true,
        url: "https://www.stockman.fr/fr/catalogue/produit--CHM.aspx",
      };
    },
  });

  assert.deepEqual(
    result.persistedState.cookies.map((item) => [item.name, item.value]),
    [
      ["cookie_customer", "new-customer"],
      ["cookie_internal", "new-internal"],
    ],
  );
});
