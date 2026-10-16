type StockmanDocument = {
  name: string;
  type: string;
  url: string;
};

function documentIdentity(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    if (!["stockman.fr", "www.stockman.fr"].includes(parsed.hostname.toLowerCase())) {
      return null;
    }

    const path = decodeURIComponent(parsed.pathname)
      .replace(/^\/(?:fr|en)\//i, "/")
      .replace(/_(?:FR|EN)(?=_[0-9]+\.pdf$|\.pdf$)/i, "")
      .toLowerCase();

    return path;
  } catch {
    return null;
  }
}

export function selectStockmanDocumentsToAdd<T extends StockmanDocument>(
  existing: readonly StockmanDocument[],
  incoming: readonly T[],
): T[] {
  const existingUrls = new Set(existing.map((document) => document.url));

  const existingIdentities = new Set(
    existing
      .map((document) => { const identity = documentIdentity(document.url); return identity ? `${document.type}:${identity}` : null; })
      .filter((identity): identity is string => identity !== null),
  );

  const selected: T[] = [];

  const frenchFirst = [...incoming].sort((a, b) => {
    const isFrench = (url: string) => {
      try {
        const parsed = new URL(url);
        const filename = decodeURIComponent(parsed.pathname);
        return /(?:^|\/)fr(?:\/|$)/i.test(parsed.pathname)
          || /_FR(?=_[0-9]+\.pdf$|\.pdf$)/i.test(filename)
          || parsed.searchParams.get("langue")?.toLowerCase() === "fr";
      } catch {
        return false;
      }
    };

    return Number(isFrench(b.url)) - Number(isFrench(a.url));
  });

  for (const document of frenchFirst) {
    const pathIdentity = documentIdentity(document.url);
    const identity = pathIdentity ? `${document.type}:${pathIdentity}` : null;

    if (existingUrls.has(document.url)) {
      continue;
    }

    if (identity && existingIdentities.has(identity)) {
      continue;
    }

    selected.push(document);
    existingUrls.add(document.url);

    if (identity) {
      existingIdentities.add(identity);
    }
  }

  return selected;
}
