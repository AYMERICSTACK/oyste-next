export const bankTransferDetails = {
  accountHolder: process.env.BANK_ACCOUNT_HOLDER || "ADEI",
  iban: process.env.BANK_IBAN || "FR7616807004000022255065533",
  bic: process.env.BANK_BIC || "CCBPFRPPGRE",
  bankName: process.env.BANK_NAME || "Banque Populaire Auvergne Rhône Alpes",
  ribUrl: "/documents/rib-adei.pdf",
};

export function formatIban(value: string) {
  return value.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export function createOrderReference() {
  const year = new Date().getFullYear();
  const date = new Date();
  const stamp = `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `OYSTE-${year}-${stamp}${random}`;
}
