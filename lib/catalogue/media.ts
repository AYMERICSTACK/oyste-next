import mediaManifestData from "@/data/catalogue/media-manifest.json";

export type ImportedMediaDocument = {
  title: string;
  href: string;
  filename: string;
  sourceUrl?: string;
  localPath?: string;
};

export type ImportedProductMedia = {
  sku: string;
  name?: string;
  mainImage?: string;
  images?: string[];
  documents?: ImportedMediaDocument[];
  sourceProductUrl?: string;
  updatedAt?: string;
  brand?: string | null;
  family?: string | null;
  reference?: string;
};

type LegacyMediaManifestEntry = ImportedProductMedia;

type LocalMediaManifestEntry = {
  reference?: string;
  brand?: string | null;
  family?: string | null;
  image?: string | null;
  images?: string[];
  documents?: string[];
  sourceImage?: string | null;
  sourceImages?: string[];
  sourceDocuments?: string[];
  public?: {
    image?: string | null;
    images?: string[];
    documents?: string[];
  };
};

type MediaManifestEntry = LegacyMediaManifestEntry | LocalMediaManifestEntry;
type MediaManifest = Record<string, MediaManifestEntry>;

const mediaManifest = mediaManifestData as MediaManifest;

const PHOTOS_PUBLIC_ROOT = "/media/photos";
const DOCUMENTS_PUBLIC_ROOT = "/media/documents";

function normalizeMediaReference(reference?: string | null) {
  if (!reference) return undefined;

  const normalized = reference
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/KG/g, "")
    .replace(/MM/g, "")
    .replace(/[^A-Z0-9]/g, "");

  return normalized || undefined;
}

function toPosixPath(value?: string | null) {
  return (value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function uniqueList(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isPublicUrl(value?: string | null) {
  return !!value && value.startsWith("/");
}

function encodePublicPath(relativePath?: string | null) {
  if (isPublicUrl(relativePath)) return relativePath?.replace(/^\/+/, "");

  const normalized = toPosixPath(relativePath);
  if (!normalized) return undefined;

  return normalized
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function getFilename(relativePath?: string | null) {
  const normalized = toPosixPath(relativePath);
  return normalized.split("/").filter(Boolean).pop() || "document.pdf";
}

function removeExtension(filename: string) {
  return filename.replace(/\.[a-z0-9]+$/i, "");
}

function formatDocumentTitle(relativePath: string) {
  const filename = getFilename(relativePath);
  const label = removeExtension(filename)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return label ? `Fiche technique ${label}` : "Fiche technique";
}

function toPublicPhotoUrl(relativePath?: string | null) {
  if (isPublicUrl(relativePath)) return relativePath || undefined;
  const encoded = encodePublicPath(relativePath);
  return encoded ? `${PHOTOS_PUBLIC_ROOT}/${encoded}` : undefined;
}

function toPublicDocumentUrl(relativePath?: string | null) {
  if (isPublicUrl(relativePath)) return relativePath || undefined;
  const encoded = encodePublicPath(relativePath);
  return encoded ? `${DOCUMENTS_PUBLIC_ROOT}/${encoded}` : undefined;
}

function isLocalMediaEntry(entry: MediaManifestEntry): entry is LocalMediaManifestEntry {
  if ("image" in entry || "sourceImage" in entry || "public" in entry) return true;

  const documents = (entry as LocalMediaManifestEntry).documents;
  return Array.isArray(documents) && (documents.length === 0 || typeof documents[0] === "string");
}

function normalizeLegacyMedia(entry: LegacyMediaManifestEntry, fallbackSku: string): ImportedProductMedia {
  return {
    ...entry,
    sku: entry.sku || fallbackSku,
    reference: entry.reference || fallbackSku,
    images: entry.images || (entry.mainImage ? [entry.mainImage] : []),
    documents: entry.documents || [],
  };
}

function normalizeLocalMedia(entry: LocalMediaManifestEntry, fallbackSku: string): ImportedProductMedia {
  const publicImages = entry.public?.images?.length
    ? entry.public.images
    : entry.public?.image
      ? [entry.public.image]
      : [];
  const rawImages = entry.images?.length ? entry.images : entry.image ? [entry.image] : [];
  const images = uniqueList([...publicImages.map(toPublicPhotoUrl), ...rawImages.map(toPublicPhotoUrl)]);
  const mainImage = toPublicPhotoUrl(entry.public?.image || publicImages[0] || entry.image || rawImages[0]);

  const publicDocuments = entry.public?.documents || [];
  const sourceDocuments = entry.documents || [];
  const documentPaths = publicDocuments.length ? publicDocuments : sourceDocuments;

  const documents = documentPaths
    .map((documentPath, index): ImportedMediaDocument | undefined => {
      const href = toPublicDocumentUrl(documentPath);
      if (!href) return undefined;

      const sourcePath = sourceDocuments[index] || documentPath;
      const filename = getFilename(sourcePath);

      return {
        title: formatDocumentTitle(sourcePath),
        href,
        filename,
        localPath: toPosixPath(sourcePath),
      };
    })
    .filter((document): document is ImportedMediaDocument => Boolean(document));

  return {
    sku: entry.reference || fallbackSku,
    reference: entry.reference || fallbackSku,
    brand: entry.brand ?? null,
    family: entry.family ?? null,
    mainImage,
    images,
    documents,
  };
}

function normalizeMediaEntry(entry: MediaManifestEntry | undefined, fallbackSku: string) {
  if (!entry) return undefined;
  return isLocalMediaEntry(entry)
    ? normalizeLocalMedia(entry, fallbackSku)
    : normalizeLegacyMedia(entry as LegacyMediaManifestEntry, fallbackSku);
}

const normalizedManifestEntries = Object.entries(mediaManifest)
  .map(([key, entry]) => ({ key, normalizedKey: normalizeMediaReference(key), entry }))
  .filter((item): item is { key: string; normalizedKey: string; entry: MediaManifestEntry } => Boolean(item.normalizedKey));

function getNormalizedReferences(references: Array<string | undefined | null>) {
  return uniqueList(references.map((reference) => normalizeMediaReference(reference)));
}

export function getImportedProductMedia(...references: Array<string | undefined | null>) {
  const normalizedRefs = getNormalizedReferences(references);

  for (const reference of normalizedRefs) {
    const exactMatch = normalizeMediaEntry(mediaManifest[reference], reference);
    if (exactMatch) return exactMatch;
  }

  for (const reference of normalizedRefs) {
    const fallback = normalizedManifestEntries.find(
      (item) => reference.startsWith(item.normalizedKey) || item.normalizedKey.startsWith(reference),
    );
    if (fallback) return normalizeMediaEntry(fallback.entry, fallback.key);
  }

  return undefined;
}

export function getImportedProductMediaList(...references: Array<string | undefined | null>) {
  const normalizedRefs = getNormalizedReferences(references);
  const matches: ImportedProductMedia[] = [];
  const used = new Set<string>();

  for (const reference of normalizedRefs) {
    const exactMatch = normalizeMediaEntry(mediaManifest[reference], reference);
    if (exactMatch && !used.has(exactMatch.reference || exactMatch.sku)) {
      used.add(exactMatch.reference || exactMatch.sku);
      matches.push(exactMatch);
    }
  }

  for (const reference of normalizedRefs) {
    const fallback = normalizedManifestEntries.find(
      (item) => !used.has(item.key) && (reference.startsWith(item.normalizedKey) || item.normalizedKey.startsWith(reference)),
    );
    if (fallback) {
      const normalized = normalizeMediaEntry(fallback.entry, fallback.key);
      if (normalized) {
        used.add(fallback.key);
        matches.push(normalized);
      }
    }
  }

  return matches;
}

/**
 * Returns media only when the normalized product reference matches a manifest
 * entry exactly. Product galleries must use this strict lookup so a short
 * parent/family code cannot pull unrelated products through prefix matching.
 */
export function getImportedProductMediaListExact(...references: Array<string | undefined | null>) {
  const normalizedRefs = getNormalizedReferences(references);
  const matches: ImportedProductMedia[] = [];
  const used = new Set<string>();

  for (const reference of normalizedRefs) {
    const exactMatch = normalizeMediaEntry(mediaManifest[reference], reference);
    const identity = exactMatch?.reference || exactMatch?.sku;

    if (exactMatch && identity && !used.has(identity)) {
      used.add(identity);
      matches.push(exactMatch);
    }
  }

  return matches;
}

export function getImportedProductMainImage(...references: Array<string | undefined | null>) {
  return getImportedProductMedia(...references)?.mainImage;
}

export function getImportedProductImages(...references: Array<string | undefined | null>) {
  return uniqueList(
    getImportedProductMediaList(...references).flatMap((media) => [media.mainImage, ...(media.images || [])]),
  );
}

export function getImportedProductImagesExact(...references: Array<string | undefined | null>) {
  return uniqueList(
    getImportedProductMediaListExact(...references).flatMap((media) => [media.mainImage, ...(media.images || [])]),
  );
}

export function getImportedProductDocuments(...references: Array<string | undefined | null>) {
  const documents = getImportedProductMediaList(...references).flatMap((media) => media.documents || []);
  const seen = new Set<string>();

  return documents.filter((document) => {
    if (seen.has(document.href)) return false;
    seen.add(document.href);
    return true;
  });
}
export function getImportedProductDocumentsExact(...references: Array<string | undefined | null>) {
  const documents = getImportedProductMediaListExact(...references).flatMap((media) => media.documents || []);
  const seen = new Set<string>();

  return documents.filter((document) => {
    if (seen.has(document.href)) return false;
    seen.add(document.href);
    return true;
  });
}

