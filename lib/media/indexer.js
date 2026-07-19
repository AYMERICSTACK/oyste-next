const path = require("path");
const { normalizeReference, readJsonIfExists, uniqueSorted } = require("./utils");

function pickMainImage(images) {
  return [...images].sort((a, b) => {
    const brandCompare = String(a.brand || "").localeCompare(String(b.brand || ""), "fr");
    if (brandCompare !== 0) return brandCompare;
    return a.relativePath.localeCompare(b.relativePath, "fr");
  })[0];
}

function buildMediaManifest(images, documents) {
  const manifest = {};

  for (const image of images) {
    if (!manifest[image.reference]) {
      manifest[image.reference] = {
        reference: image.reference,
        brand: image.brand,
        family: image.family,
        image: image.relativePath,
        images: [],
        documents: [],
      };
    }

    manifest[image.reference].images.push(image.relativePath);

    const mainImage = pickMainImage(
      manifest[image.reference].images.map((relativePath) => ({ ...image, relativePath })),
    );
    manifest[image.reference].image = mainImage.relativePath;
  }

  for (const document of documents) {
    if (!manifest[document.reference]) {
      manifest[document.reference] = {
        reference: document.reference,
        brand: null,
        family: null,
        image: null,
        images: [],
        documents: [],
      };
    }

    manifest[document.reference].documents.push(document.relativePath);
  }

  for (const key of Object.keys(manifest)) {
    manifest[key].images = uniqueSorted(manifest[key].images);
    manifest[key].documents = uniqueSorted(manifest[key].documents);
  }

  return Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b, "fr")));
}

function extractCatalogueReferences(projectRoot) {
  const productsPath = path.join(projectRoot, "data", "catalogue", "products.json");
  const products = readJsonIfExists(productsPath, []);
  if (!Array.isArray(products)) return [];

  return uniqueSorted(
    products
      .map((product) => product.reference || product.sku || product.ref || product.code || product.id)
      .map(normalizeReference),
  );
}

function buildMediaReport({
  projectRoot,
  photosDir,
  documentsDir,
  images,
  documents,
  manifest,
  mode = "scan-only",
  publicDir = null,
  publishStats = null,
}) {
  const catalogueReferences = extractCatalogueReferences(projectRoot);
  const manifestReferences = Object.keys(manifest);
  const imageReferences = new Set(images.map((item) => item.reference));
  const documentReferences = new Set(documents.map((item) => item.reference));

  return {
    generatedAt: new Date().toISOString(),
    mode,
    source: {
      photos: photosDir,
      documents: documentsDir,
    },
    output: {
      publicDir,
      photos: publicDir ? path.join(publicDir, "media", "photos") : null,
      documents: publicDir ? path.join(publicDir, "media", "documents") : null,
    },
    totals: {
      images: images.length,
      pdf: documents.length,
      mediaReferences: manifestReferences.length,
      catalogueReferences: catalogueReferences.length,
    },
    publish: publishStats,
    references: {
      withImageWithoutPdf: manifestReferences.filter((reference) => imageReferences.has(reference) && !documentReferences.has(reference)),
      withPdfWithoutImage: manifestReferences.filter((reference) => documentReferences.has(reference) && !imageReferences.has(reference)),
      catalogueWithoutImage: catalogueReferences.filter((reference) => !imageReferences.has(reference)),
      catalogueWithoutPdf: catalogueReferences.filter((reference) => !documentReferences.has(reference)),
    },
  };
}

module.exports = { buildMediaManifest, buildMediaReport, extractCatalogueReferences };
