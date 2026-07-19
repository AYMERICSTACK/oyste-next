const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { ensureDir, toPosixPath } = require("./utils");

const WEBP_QUALITY = 82;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_LOG_EVERY = 100;
const CONVERTIBLE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const IMAGE_OUTPUT_EXTENSIONS = [".webp", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff"];

function tryLoadSharp() {
  try {
    require.resolve("sharp");
    return true;
  } catch (_) {
    return false;
  }
}

function getFileStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (_) {
    return null;
  }
}

function targetLooksFresh(sourcePath, targetPath, force = false) {
  if (force) return false;

  const sourceStat = getFileStat(sourcePath);
  const targetStat = getFileStat(targetPath);

  if (!sourceStat || !targetStat) return false;
  if (targetStat.size <= 0) return false;

  const sourceMtime = sourceStat.mtimeMs - 1000;
  const targetMtime = targetStat.mtimeMs;
  const targetExtension = path.extname(targetPath).toLowerCase();

  if (targetExtension === ".webp") {
    return targetMtime >= sourceMtime;
  }

  return sourceStat.size === targetStat.size && targetMtime >= sourceMtime;
}

function copyFileWithTimeout(sourcePath, targetPath, timeoutMs = DEFAULT_TIMEOUT_MS) {
  ensureDir(path.dirname(targetPath));

  return new Promise((resolve, reject) => {
    let settled = false;
    const readStream = fs.createReadStream(sourcePath);
    const writeStream = fs.createWriteStream(targetPath);

    const cleanup = () => {
      clearTimeout(timer);
      readStream.destroy();
      writeStream.destroy();
    };

    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (error) {
        try {
          if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        } catch (_) {
          // non bloquant
        }
        reject(error);
        return;
      }

      try {
        const sourceStat = fs.statSync(sourcePath);
        fs.utimesSync(targetPath, sourceStat.atime, sourceStat.mtime);
      } catch (_) {
        // certains NAS refusent parfois la reprise des dates
      }

      resolve("copied");
    };

    const timer = setTimeout(() => {
      finish(new Error(`Timeout copie après ${timeoutMs} ms`));
    }, timeoutMs);

    readStream.on("error", finish);
    writeStream.on("error", finish);
    writeStream.on("finish", () => finish(null));
    readStream.pipe(writeStream);
  });
}

async function copyIfNeeded(sourcePath, targetPath, { timeoutMs, force } = {}) {
  if (targetLooksFresh(sourcePath, targetPath, force)) return "skipped";
  return copyFileWithTimeout(sourcePath, targetPath, timeoutMs);
}

function convertToWebpInChildProcess({ sourcePath, targetPath, quality, timeoutMs }) {
  ensureDir(path.dirname(targetPath));

  const code = `
    const sharp = require("sharp");
    const fs = require("fs");
    const source = process.argv[1];
    const target = process.argv[2];
    const quality = Number(process.argv[3] || 82);
    sharp(source)
      .rotate()
      .webp({ quality })
      .toFile(target)
      .then(() => {
        try {
          const stat = fs.statSync(source);
          fs.utimesSync(target, stat.atime, stat.mtime);
        } catch (_) {}
      })
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error && error.message ? error.message : String(error));
        process.exit(1);
      });
  `;

  return new Promise((resolve, reject) => {
    let stderr = "";
    let settled = false;
    const child = spawn(process.execPath, ["-e", code, sourcePath, targetPath, String(quality)], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });

    const cleanupTarget = () => {
      try {
        if (fs.existsSync(targetPath) && fs.statSync(targetPath).size <= 0) fs.unlinkSync(targetPath);
      } catch (_) {
        // non bloquant
      }
    };

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanupTarget();
      if (error) reject(error);
      else resolve("converted");
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch (_) {
        // non bloquant
      }
      finish(new Error(`Timeout conversion WebP après ${timeoutMs} ms`));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code === 0) finish(null);
      else finish(new Error((stderr || `Conversion WebP échouée avec code ${code}`).trim()));
    });
  });
}

async function convertToWebpIfNeeded({ sourcePath, targetPath, quality, timeoutMs, force }) {
  if (targetLooksFresh(sourcePath, targetPath, force)) return "skipped";
  return convertToWebpInChildProcess({ sourcePath, targetPath, quality, timeoutMs });
}

function toPublishedImageRelativePath(relativePath, useWebp) {
  const normalized = toPosixPath(relativePath);
  if (!useWebp) return normalized;

  const extension = path.posix.extname(normalized).toLowerCase();
  if (!CONVERTIBLE_EXTENSIONS.has(extension)) return normalized;

  return normalized.slice(0, -extension.length) + ".webp";
}

function safeTargetPath(rootDir, relativePath) {
  const targetPath = path.resolve(rootDir, relativePath);
  const resolvedRoot = path.resolve(rootDir);

  if (!targetPath.startsWith(resolvedRoot + path.sep) && targetPath !== resolvedRoot) {
    throw new Error(`Chemin média invalide : ${relativePath}`);
  }

  return targetPath;
}

function removeAlternateImageOutputs(rootDir, publishedRelativePath) {
  const normalized = toPosixPath(publishedRelativePath);
  const extension = path.posix.extname(normalized).toLowerCase();
  const withoutExtension = normalized.slice(0, -extension.length);
  let removed = 0;

  for (const candidateExtension of IMAGE_OUTPUT_EXTENSIONS) {
    if (candidateExtension === extension) continue;
    const candidatePath = safeTargetPath(rootDir, `${withoutExtension}${candidateExtension}`);

    try {
      if (fs.existsSync(candidatePath)) {
        fs.unlinkSync(candidatePath);
        removed += 1;
      }
    } catch (_) {
      // non bloquant : le fichier sera retenté au prochain sync
    }
  }

  return removed;
}

function createPublishStats() {
  return {
    imagesCopied: 0,
    imagesConverted: 0,
    imagesSkipped: 0,
    imagesFallbackCopied: 0,
    imagesAlternatesRemoved: 0,
    imageErrors: [],
    documentsCopied: 0,
    documentsSkipped: 0,
    documentErrors: [],
    webpEnabled: false,
    webpAvailable: false,
    webpQuality: WEBP_QUALITY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "--:--";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function createProgressLogger(label, total, logEvery) {
  const startedAt = Date.now();
  const safeLogEvery = Math.max(1, Number.isFinite(logEvery) ? logEvery : DEFAULT_LOG_EVERY);

  return ({ index, item, result, extra = "" }) => {
    const shouldLog = index === 1 || index === total || index % safeLogEvery === 0 || result === "error" || result === "fallback";
    if (!shouldLog) return;

    const elapsed = Date.now() - startedAt;
    const speed = index > 0 && elapsed > 0 ? index / (elapsed / 1000) : 0;
    const remaining = speed > 0 ? (total - index) / speed : 0;
    const percent = total > 0 ? Math.round((index / total) * 100) : 100;
    const icon = result === "error" ? "⚠️" : result === "skipped" ? "↪" : result === "fallback" ? "🟡" : "…";
    const speedText = speed > 0 ? `${speed.toFixed(1)}/s` : "--/s";

    console.log(
      `${icon} ${label} : ${index}/${total} (${percent}%) — ${item.reference || item.filename} — ${result}${extra ? ` — ${extra}` : ""} — ${speedText} — ETA ${formatDuration(remaining * 1000)}`,
    );
  };
}

async function publishOneImage({ image, photosPublicDir, canConvertWebp, webpQuality, timeoutMs, force, cleanAlternates }) {
  const extension = path.extname(image.sourcePath).toLowerCase();
  const shouldConvert = canConvertWebp && CONVERTIBLE_EXTENSIONS.has(extension);
  const preferredRelativePath = toPublishedImageRelativePath(image.relativePath, shouldConvert);
  const preferredTargetPath = safeTargetPath(photosPublicDir, preferredRelativePath);

  if (shouldConvert) {
    try {
      const result = await convertToWebpIfNeeded({
        sourcePath: image.sourcePath,
        targetPath: preferredTargetPath,
        quality: webpQuality,
        timeoutMs,
        force,
      });
      const removed = cleanAlternates ? removeAlternateImageOutputs(photosPublicDir, preferredRelativePath) : 0;
      return { result, publishedRelativePath: preferredRelativePath, removedAlternates: removed, usedFallback: false };
    } catch (error) {
      const fallbackRelativePath = toPublishedImageRelativePath(image.relativePath, false);
      const fallbackTargetPath = safeTargetPath(photosPublicDir, fallbackRelativePath);
      const fallbackResult = await copyIfNeeded(image.sourcePath, fallbackTargetPath, { timeoutMs, force });
      const removed = cleanAlternates ? removeAlternateImageOutputs(photosPublicDir, fallbackRelativePath) : 0;
      return {
        result: fallbackResult === "skipped" ? "fallback-skipped" : "fallback",
        publishedRelativePath: fallbackRelativePath,
        removedAlternates: removed,
        usedFallback: true,
        error,
      };
    }
  }

  const result = await copyIfNeeded(image.sourcePath, preferredTargetPath, { timeoutMs, force });
  const removed = cleanAlternates ? removeAlternateImageOutputs(photosPublicDir, preferredRelativePath) : 0;
  return { result, publishedRelativePath: preferredRelativePath, removedAlternates: removed, usedFallback: false };
}

async function publishLocalMedia({
  images,
  documents,
  publicDir,
  convertWebp = true,
  webpQuality = WEBP_QUALITY,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logEvery = DEFAULT_LOG_EVERY,
  force = false,
  cleanAlternates = true,
}) {
  const stats = createPublishStats();
  const photosPublicDir = path.join(publicDir, "media", "photos");
  const documentsPublicDir = path.join(publicDir, "media", "documents");
  const sharpAvailable = convertWebp ? tryLoadSharp() : false;
  const canConvertWebp = Boolean(convertWebp && sharpAvailable);

  stats.webpEnabled = Boolean(convertWebp);
  stats.webpAvailable = Boolean(sharpAvailable);
  stats.webpQuality = webpQuality;
  stats.timeoutMs = timeoutMs;

  ensureDir(photosPublicDir);
  ensureDir(documentsPublicDir);

  const imagePathMap = new Map();
  const documentPathMap = new Map();
  const logImageProgress = createProgressLogger("Images", images.length, logEvery);
  const logDocumentProgress = createProgressLogger("PDF", documents.length, logEvery);

  console.log(`📷 Publication images : ${images.length} fichier(s)`);
  if (convertWebp && !sharpAvailable) {
    console.log("⚠️  sharp non disponible : fallback en images originales, sans WebP.");
  }
  console.log(cleanAlternates ? "🧹 Nettoyage doublons : actif (pas de jpg + webp pour une même référence)" : "🧹 Nettoyage doublons : désactivé");

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];

    try {
      const publication = await publishOneImage({
        image,
        photosPublicDir,
        canConvertWebp,
        webpQuality,
        timeoutMs,
        force,
        cleanAlternates,
      });

      imagePathMap.set(image.relativePath, toPosixPath(publication.publishedRelativePath));
      stats.imagesAlternatesRemoved += publication.removedAlternates;

      if (publication.usedFallback) {
        stats.imagesFallbackCopied += publication.result === "fallback" ? 1 : 0;
        stats.imageErrors.push({
          reference: image.reference,
          source: image.sourcePath,
          message: publication.error instanceof Error ? publication.error.message : String(publication.error),
          fallback: publication.publishedRelativePath,
        });
      } else if (publication.result === "converted") {
        stats.imagesConverted += 1;
      } else if (publication.result === "copied") {
        stats.imagesCopied += 1;
      } else {
        stats.imagesSkipped += 1;
      }

      logImageProgress({
        index: index + 1,
        item: image,
        result: publication.result,
        extra: publication.removedAlternates ? `${publication.removedAlternates} doublon(s) supprimé(s)` : "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallbackRelativePath = toPublishedImageRelativePath(image.relativePath, false);
      stats.imageErrors.push({ reference: image.reference, source: image.sourcePath, message });
      imagePathMap.set(image.relativePath, toPosixPath(fallbackRelativePath));
      logImageProgress({ index: index + 1, item: image, result: "error", extra: message });
    }
  }

  console.log(`📄 Publication PDF : ${documents.length} fichier(s)`);

  for (let index = 0; index < documents.length; index += 1) {
    const document = documents[index];
    const publishedRelativePath = toPosixPath(document.relativePath);
    const targetPath = safeTargetPath(documentsPublicDir, publishedRelativePath);

    try {
      const result = await copyIfNeeded(document.sourcePath, targetPath, { timeoutMs, force });
      if (result === "copied") stats.documentsCopied += 1;
      else stats.documentsSkipped += 1;

      documentPathMap.set(document.relativePath, publishedRelativePath);
      logDocumentProgress({ index: index + 1, item: document, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stats.documentErrors.push({ reference: document.reference, source: document.sourcePath, message });
      documentPathMap.set(document.relativePath, publishedRelativePath);
      logDocumentProgress({ index: index + 1, item: document, result: "error", extra: message });
    }
  }

  stats.finishedAt = new Date().toISOString();

  return { imagePathMap, documentPathMap, stats };
}

function applyPublishedPathsToManifest(manifest, { imagePathMap, documentPathMap }) {
  const nextManifest = {};

  for (const [reference, entry] of Object.entries(manifest)) {
    const sourceImages = entry.images || [];
    const sourceDocuments = entry.documents || [];
    const publishedImages = sourceImages.map((imagePath) => imagePathMap.get(imagePath) || imagePath);
    const publishedDocuments = sourceDocuments.map((documentPath) => documentPathMap.get(documentPath) || documentPath);
    const publishedMainImage = entry.image ? imagePathMap.get(entry.image) || entry.image : null;

    nextManifest[reference] = {
      ...entry,
      image: publishedMainImage,
      images: publishedImages,
      documents: publishedDocuments,
      sourceImage: entry.image || null,
      sourceImages,
      sourceDocuments,
      public: {
        image: publishedMainImage ? `/media/photos/${publishedMainImage}` : null,
        images: publishedImages.map((imagePath) => `/media/photos/${imagePath}`),
        documents: publishedDocuments.map((documentPath) => `/media/documents/${documentPath}`),
      },
    };
  }

  return nextManifest;
}

module.exports = { applyPublishedPathsToManifest, publishLocalMedia };
