type ExistingImage = {
  url: string;
  sortOrder: number;
};

type IncomingImage = {
  url: string;
  altText?: string | null;
};

export function selectStockmanImagesToAdd<T extends IncomingImage>(
  existing: readonly ExistingImage[],
  incoming: readonly T[],
): Array<T & { isPrimary: boolean; sortOrder: number }> {
  const knownUrls = new Set(existing.map((image) => image.url));

  const nextSortOrder = existing.length
    ? Math.max(...existing.map((image) => image.sortOrder)) + 1
    : 0;

  const selected: Array<T & { isPrimary: boolean; sortOrder: number }> = [];

  for (const image of incoming) {
    if (knownUrls.has(image.url)) {
      continue;
    }

    knownUrls.add(image.url);

    selected.push({
      ...image,
      isPrimary: existing.length === 0 && selected.length === 0,
      sortOrder: nextSortOrder + selected.length,
    });
  }

  return selected;
}
