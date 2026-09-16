export function formatCmuValue(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  const kgMatch = normalized.match(/^(\d+(?:\.\d+)?)kg$/i);
  if (!kgMatch) return value;

  const kg = Number(kgMatch[1]);
  if (!Number.isFinite(kg) || kg <= 0) return value;

  if (kg >= 1000) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(kg / 1000)} t`;
  }

  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(kg)} kg`;
}

export function formatCmuText(text: string) {
  return text.replace(
    /\bCMU\s*:?\s*(\d+(?:[.,]\d+)?)\s*kg\b/gi,
    (_match, rawKg: string) => `CMU ${formatCmuValue(`${rawKg}kg`)}`,
  );
}

export function formatTechnicalValue(label: string, value: string) {
  if (/^CMU$/i.test(label.trim())) return formatCmuValue(value);
  return value;
}
