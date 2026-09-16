function normalizedCode(code?: string) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getKitoChainPriceComponentRef(code?: string) {
  const normalized = normalizedCode(code);
  if (!normalized) return null;

  const cb = normalized.match(/^CB(005|010|015|020|025|030|050)$/);
  if (cb) return `MSUPLCB${cb[1]}`;

  const cx = normalized.match(/^CX(003|005|010)$/);
  if (cx) return `MSUPLCX${cx[1]}`;

  const lb = normalized.match(/^LB(008|010|016|025|032|063|090)HL(?:15|30)$/);
  if (lb) {
    if (lb[1] === "008" || lb[1] === "010") return "HLLB008_010";
    return `HLLB${lb[1]}`;
  }

  const lx = normalized.match(/^LX(003|005)HL(?:15|30)$/);
  if (lx) return `HLLX${lx[1]}`;

  const er2 = normalized.match(/^ER2(?:M|SG|SP)?(001|003|005|010|016|020|025|032|050)/);
  if (er2) {
    const capacity = er2[1];
    if (capacity === "001" || capacity === "003") return "HLER2_001_003";
    if (capacity === "016" || capacity === "020") return "HLER2_016_020";
    return `HLER2_${capacity}`;
  }

  return null;
}
