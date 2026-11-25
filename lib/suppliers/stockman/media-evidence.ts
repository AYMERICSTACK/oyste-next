/** A file naming another model or a generic page decoration is not evidence.
 * Unknown assets are withheld for review; existing galleries are not deleted.
 */
export function isReferenceMedia(url: string, reference: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !["stockman.fr", "www.stockman.fr"].includes(parsed.hostname)) return false;
    const filename = decodeURIComponent(parsed.pathname.split("/").pop() ?? "").toUpperCase();
    const escaped = reference.trim().toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`).test(filename);
  } catch { return false; }
}
