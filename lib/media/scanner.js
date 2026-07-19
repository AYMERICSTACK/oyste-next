const fs = require("fs");
const path = require("path");
const { DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS, normalizeReference, toPosixPath } = require("./utils");

function walkFiles(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return [];

  const files = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    let entries = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      console.warn(`⚠️  Dossier ignoré : ${current}`);
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      if (entry.isFile()) files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b, "fr"));
}

function relativeSegments(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).filter(Boolean);
}

function scanPhotos(photosDir) {
  return walkFiles(photosDir)
    .filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => {
      const segments = relativeSegments(photosDir, filePath);
      const filename = path.basename(filePath);
      const reference = normalizeReference(path.basename(filePath, path.extname(filePath)));

      return {
        type: "image",
        reference,
        brand: segments.length >= 2 ? segments[0] : null,
        family: segments.length >= 3 ? segments.slice(1, -1).join(" / ") : null,
        filename,
        extension: path.extname(filePath).toLowerCase(),
        relativePath: toPosixPath(path.relative(photosDir, filePath)),
        sourcePath: filePath,
      };
    })
    .filter((item) => item.reference);
}

function scanDocuments(documentsDir) {
  return walkFiles(documentsDir)
    .filter((filePath) => DOCUMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => {
      const filename = path.basename(filePath);
      const reference = normalizeReference(path.basename(filePath, path.extname(filePath)));

      return {
        type: "document",
        reference,
        filename,
        extension: path.extname(filePath).toLowerCase(),
        relativePath: toPosixPath(path.relative(documentsDir, filePath)),
        sourcePath: filePath,
      };
    })
    .filter((item) => item.reference);
}

module.exports = { scanDocuments, scanPhotos, walkFiles };
