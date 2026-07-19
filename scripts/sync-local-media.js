#!/usr/bin/env node
/*
 * OYSTE — V16 Local Media Engine
 *
 * Version V16.3 Smart Publisher :
 * - scanne récursivement les dossiers locaux/NAS des photos et PDF ;
 * - publie les médias dans public/media ;
 * - convertit directement en WebP sans garder le JPG en doublon ;
 * - reprend intelligemment les fichiers déjà à jour ;
 * - construit data/catalogue/media-manifest.json ;
 * - construit data/catalogue/local-media-report.json.
 *
 * Options utiles :
 * - --scan-only : conserve le comportement V16, sans copie ni conversion ;
 * - --no-webp : copie les images originales sans conversion ;
 * - --public-dir ./public : change le dossier public cible ;
 * - --webp-quality 82 : change la qualité WebP ;
 * - --timeout-ms 30000 : saute un fichier qui bloque plus de 30s ;
 * - --log-every 50 : affiche une progression tous les 50 fichiers ;
 * - --force : force la republication même si un fichier semble déjà à jour ;
 * - --keep-alternates : conserve les anciens JPG/WEBP au lieu de nettoyer les doublons.
 *
 * Exemple :
 * npm run sync:local-media -- \
 *   --photos "\\\\192.168.1.240\\Arboresence\\03-Commercial\\PROJET E-COMMERCE\\1 PHOTOS" \
 *   --documents "\\\\192.168.1.240\\Arboresence\\03-Commercial\\PROJET E-COMMERCE\\1 FICHE TECHNIQUE"
 */

const path = require("path");
const { buildMediaManifest, buildMediaReport } = require("../lib/media/indexer");
const { applyPublishedPathsToManifest, publishLocalMedia } = require("../lib/media/publisher");
const { scanDocuments, scanPhotos } = require("../lib/media/scanner");
const { isDirectory, stripWrappingQuotes, writeJson } = require("../lib/media/utils");

const PROJECT_ROOT = process.cwd();
const DEFAULT_DATA_DIR = path.join(PROJECT_ROOT, "data", "catalogue");

function parseArgs(argv) {
  const args = {};

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

function resolveSourceDirs(args) {
  const source = stripWrappingQuotes(args.source);
  const photos = stripWrappingQuotes(args.photos);
  const documents = stripWrappingQuotes(args.documents || args.docs);

  const resolvedPhotos = photos || (source ? path.join(source, "1 PHOTOS") : "");
  const resolvedDocuments = documents || (source ? path.join(source, "1 FICHE TECHNIQUE") : "");

  if (!isDirectory(resolvedPhotos)) {
    throw new Error(`Dossier photos introuvable : ${resolvedPhotos || "--photos manquant"}`);
  }

  if (!isDirectory(resolvedDocuments)) {
    throw new Error(`Dossier fiches techniques introuvable : ${resolvedDocuments || "--documents manquant"}`);
  }

  return { photosDir: resolvedPhotos, documentsDir: resolvedDocuments };
}

async function main() {
  const args = parseArgs(process.argv);
  const dataDir = path.resolve(stripWrappingQuotes(args["data-dir"]) || DEFAULT_DATA_DIR);
  const manifestPath = path.join(dataDir, "media-manifest.json");
  const reportPath = path.join(dataDir, "local-media-report.json");
  const publicDir = path.resolve(stripWrappingQuotes(args["public-dir"]) || path.join(PROJECT_ROOT, "public"));
  const scanOnly = Boolean(args["scan-only"]);
  const convertWebp = !Boolean(args["no-webp"]);
  const webpQuality = Number(args["webp-quality"] || 82);
  const timeoutMs = Number(args["timeout-ms"] || 30000);
  const logEvery = Number(args["log-every"] || 50);
  const force = Boolean(args.force);
  const cleanAlternates = !Boolean(args["keep-alternates"]);
  const { photosDir, documentsDir } = resolveSourceDirs(args);

  console.log("🚀 OYSTE V16.3 — Local Media Engine Smart Publisher");
  console.log(scanOnly ? "Mode : scan-only, aucune copie, aucune conversion WebP" : "Mode : publish, copie vers public/media + WebP si disponible");
  console.log(`Photos : ${photosDir}`);
  console.log(`PDF : ${documentsDir}`);
  if (!scanOnly) {
    console.log(`Timeout par fichier : ${Number.isFinite(timeoutMs) ? timeoutMs : 30000} ms`);
    console.log(`Progression : 1 log tous les ${Number.isFinite(logEvery) ? logEvery : 50} fichiers`);
  }

  const images = scanPhotos(photosDir);
  const documents = scanDocuments(documentsDir);

  let manifest = buildMediaManifest(images, documents);
  let publish = null;

  if (!scanOnly) {
    publish = await publishLocalMedia({
      images,
      documents,
      publicDir,
      convertWebp,
      webpQuality: Number.isFinite(webpQuality) ? webpQuality : 82,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 30000,
      logEvery: Number.isFinite(logEvery) ? logEvery : 50,
      force,
      cleanAlternates,
    });

    manifest = applyPublishedPathsToManifest(manifest, publish);
  }

  const report = buildMediaReport({
    projectRoot: PROJECT_ROOT,
    photosDir,
    documentsDir,
    images,
    documents,
    manifest,
    mode: scanOnly ? "scan-only" : "publish",
    publicDir,
    publishStats: publish?.stats || null,
  });

  writeJson(manifestPath, manifest);
  writeJson(reportPath, report);

  console.log(scanOnly ? "✅ Index médias généré" : "✅ Médias synchronisés et index généré");
  console.log(`Images trouvées : ${report.totals.images}`);
  console.log(`PDF trouvés : ${report.totals.pdf}`);
  console.log(`Références médias : ${report.totals.mediaReferences}`);
  if (publish?.stats) {
    if (publish.stats.webpEnabled && !publish.stats.webpAvailable) {
      console.log("⚠️  sharp non disponible : les images ont été copiées sans conversion WebP");
    }

    console.log(`Images converties WebP : ${publish.stats.imagesConverted}`);
    console.log(`Images copiées : ${publish.stats.imagesCopied}`);
    console.log(`Images fallback originales : ${publish.stats.imagesFallbackCopied || 0}`);
    console.log(`Doublons images supprimés : ${publish.stats.imagesAlternatesRemoved || 0}`);
    console.log(`Images ignorées car à jour : ${publish.stats.imagesSkipped}`);
    console.log(`PDF copiés : ${publish.stats.documentsCopied}`);
    console.log(`PDF ignorés car à jour : ${publish.stats.documentsSkipped}`);
    console.log(`Erreurs images : ${publish.stats.imageErrors.length}`);
    console.log(`Erreurs PDF : ${publish.stats.documentErrors.length}`);
  }

  console.log(`Manifest : ${path.relative(PROJECT_ROOT, manifestPath)}`);
  console.log(`Rapport : ${path.relative(PROJECT_ROOT, reportPath)}`);
}

main().catch((error) => {
  console.error("❌ OYSTE V16.3 — Local Media Engine impossible");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
