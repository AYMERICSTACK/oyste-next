export function normalizeSiret(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeSiren(value: string) {
  return value.replace(/\D/g, "");
}

function isValidLuhn(value: string) {
  let sum = 0;
  let shouldDouble = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function isValidSiren(value: string) {
  const siren = normalizeSiren(value);
  return /^\d{9}$/.test(siren) && isValidLuhn(siren);
}

export function isValidSiret(value: string) {
  const siret = normalizeSiret(value);
  return /^\d{14}$/.test(siret) && isValidLuhn(siret);
}

export function isSirenConsistentWithSiret(sirenValue: string, siretValue: string) {
  const siren = normalizeSiren(sirenValue);
  const siret = normalizeSiret(siretValue);
  return siren.length === 9 && siret.length === 14 && siret.startsWith(siren);
}

export function normalizeVatNumber(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}
