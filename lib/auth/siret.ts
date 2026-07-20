export function normalizeSiret(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidSiret(value: string) {
  const siret = normalizeSiret(value);
  if (!/^\d{14}$/.test(siret)) return false;

  let sum = 0;
  for (let index = 0; index < siret.length; index += 1) {
    let digit = Number(siret[index]);
    if (index % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
