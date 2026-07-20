export function isStockmannSupplier(supplier?: string) {
  return (supplier || "").trim().toUpperCase().includes("STOCKMANN");
}
