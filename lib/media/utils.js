const fs = require("fs");
const path = require("path");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"]);
const DOCUMENT_EXTENSIONS = new Set([".pdf"]);

function stripWrappingQuotes(value) {
  return String(value || "").replace(/^['\"]|['\"]$/g, "").trim();
}

function toPosixPath(value) {
  return String(value || "").split(path.sep).join("/").replace(/\\+/g, "/");
}

function normalizeReference(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/#U00E9/gi, "E")
    .replace(/#U00E8/gi, "E")
    .replace(/#U00EA/gi, "E")
    .replace(/#U00E0/gi, "A")
    .replace(/#U00FB/gi, "U")
    .replace(/#U00F9/gi, "U")
    .replace(/#U00E7/gi, "C")
    .replace(/[-_\s]*(BIG|SMALL|MEDIUM|LARGE|THUMB|THUMBNAIL)$/i, "")
    .replace(/\.(JPG|JPEG|PNG|WEBP|GIF|BMP|TIF|TIFF|PDF)$/i, "")
    .replace(/[^A-Z0-9]/g, "");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isDirectory(dirPath) {
  try {
    return Boolean(dirPath && fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory());
  } catch (_) {
    return false;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJsonIfExists(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"));
}

module.exports = {
  DOCUMENT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  ensureDir,
  isDirectory,
  normalizeReference,
  readJsonIfExists,
  stripWrappingQuotes,
  toPosixPath,
  uniqueSorted,
  writeJson,
};
