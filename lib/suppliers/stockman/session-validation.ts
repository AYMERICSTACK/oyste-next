import {
  sanitizeStockmanStorageState,
  type StockmanStorageStateLike,
} from "@/lib/suppliers/stockman/session-state";

type CommercialAccessResult = {
  referenceFound: boolean;
  stockFound: boolean;
  priceFound: boolean;
  url: string;
};

type ValidationPage = object;

type ValidationContext<TState extends StockmanStorageStateLike> = {
  newPage(): Promise<ValidationPage>;
  storageState(): Promise<TState>;
  close(): Promise<void>;
};

type ValidationBrowser<TState extends StockmanStorageStateLike> = {
  newContext(options: { storageState: TState }): Promise<ValidationContext<TState>>;
};

function isProductPage(urlValue: string) {
  try {
    const url = new URL(urlValue);
    return (
      /(^|\.)stockman\.fr$/i.test(url.hostname) &&
      url.pathname !== "/" &&
      !/^\/(?:fr|en)\/?$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function assertValidStockmanCommercialAccess(
  access: CommercialAccessResult,
) {
  if (
    !access.referenceFound ||
    !access.stockFound ||
    !access.priceFound ||
    !isProductPage(access.url)
  ) {
    throw new Error(
      [
        "La session assainie ne restitue pas l’accès revendeur sur la fiche témoin.",
        `fiche=${access.referenceFound ? "oui" : "non"}`,
        `stock=${access.stockFound ? "oui" : "non"}`,
        `prix=${access.priceFound ? "oui" : "non"}`,
        `routeProduit=${isProductPage(access.url) ? "oui" : "non"}`,
      ].join(" "),
    );
  }
}

export async function validateSanitizedStockmanSession<
  TState extends StockmanStorageStateLike,
>(input: {
  browser: ValidationBrowser<TState>;
  candidateState: TState;
  checkCommercialAccess(page: ValidationPage): Promise<CommercialAccessResult>;
}) {
  const candidate = sanitizeStockmanStorageState(input.candidateState).state;
  const context = await input.browser.newContext({ storageState: candidate });

  try {
    const page = await context.newPage();
    const access = await input.checkCommercialAccess(page);
    assertValidStockmanCommercialAccess(access);

    // STOCKMAN peut renouveler ses cookies persistants pendant la validation.
    // On conserve cet état post-validation, puis on retire à nouveau uniquement
    // la session ASP.NET volatile avant toute persistance.
    const refreshedState = await context.storageState();
    const persistedState = sanitizeStockmanStorageState(refreshedState).state;

    return { access, persistedState };
  } finally {
    await context.close().catch(() => undefined);
  }
}
