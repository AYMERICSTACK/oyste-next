export type StockmanStorageCookie = {
  name: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
  value: string;
};

export type StockmanStorageStateLike = {
  cookies: StockmanStorageCookie[];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

// ASP.NET_SessionId est necessaire a la session revendeur STOCKMAN.
// Il reste chiffre cote serveur dans le stockage Neon.
const VOLATILE_STOCKMAN_COOKIE_NAMES = new Set<string>();

export function sanitizeStockmanStorageState<T extends StockmanStorageStateLike>(
  state: T,
): { state: T; removedVolatileCookies: number } {
  const cookies = state.cookies.filter(
    (cookie) =>
      !VOLATILE_STOCKMAN_COOKIE_NAMES.has(cookie.name.trim().toLowerCase()),
  );

  return {
    state: { ...state, cookies } as T,
    removedVolatileCookies: state.cookies.length - cookies.length,
  };
}
