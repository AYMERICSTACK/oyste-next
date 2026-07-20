export function normalizePostcode(postcode?: string) {
  return (postcode || "").replace(/\s/g, "").trim();
}
export function getDepartmentCode(postcode?: string) {
  const value = normalizePostcode(postcode);
  if (!/^\d{5}$/.test(value)) return null;
  if (value.startsWith("97") || value.startsWith("98")) return value.slice(0, 3);
  return value.slice(0, 2);
}
