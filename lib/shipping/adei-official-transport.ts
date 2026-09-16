import source from "./adei-transport-source.json";

export type AdeiTransportResult = {
  mode: "messagerie" | "affretement" | "quote";
  amountHT: number | null;
  costHT?: number;
  rateCode?: string;
  coefficient?: number;
  weightKg?: number;
  reason: string;
};
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const price = (cost: number) => round2(cost / 0.75);
const quote = (reason: string): AdeiTransportResult => ({mode:"quote",amountHT:null,reason});
const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
function department(postcode?: string) {
  const cp = String(postcode ?? "").trim();
  if (!/^\d{5}$/.test(cp)) return null;
  return cp.slice(0,2);
}
function erpRef(code?: string) {
  const raw = String(code ?? "").trim().toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/g,"");
  const port = raw.match(/^PORT(\d+)\/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  const encoded = port ? `PORT${port[1]}${Math.round(Number(port[2])*1000)}${Math.round(Number(port[3])*1000)}` : "";
  return [raw,compact,encoded].find(ref => Object.prototype.hasOwnProperty.call(source.assignments,ref) || Object.prototype.hasOwnProperty.call(source.lsrWeightsKg,ref)) ?? raw;
}
export function getAdeiTransportSource(code?: string) {
  const ref=erpRef(code);
  return {
    ref,
    assignment: source.assignments[ref as keyof typeof source.assignments],
    lsrWeightKg: source.lsrWeightsKg[ref as keyof typeof source.lsrWeightsKg],
  };
}
export function calculateAdeiOfficialTransport(input: {
  code?: string; postcode?: string; quantity?: number; weightKg?: number;
  coefficient?: number; mode?: "messagerie" | "affretement";
}): AdeiTransportResult {
  const dep=department(input.postcode);
  if (!dep) return quote("Code postal français requis.");
  const qty=input.quantity ?? 1;
  if (!Number.isInteger(qty) || qty<1) return quote("Quantité invalide.");
  const sourceRef=getAdeiTransportSource(input.code);
  const weight=sourceRef.lsrWeightKg ?? input.weightKg;
  const total=valid(weight) ? weight*qty : undefined;
  const assignment=sourceRef.assignment;
  const mode=sourceRef.lsrWeightKg !== undefined || assignment?.tranche==="Messagerie au poids"
    ? "messagerie" : assignment ? "affretement" : input.mode;
  if (!mode) return quote("Référence sans règle transport validée.");
  if (mode==="affretement") {
    if (dep==="20") return quote("Affrètement Corse sur devis.");
    const coefficient=typeof assignment?.tranche==="number" ? assignment.tranche : input.coefficient;
    if (coefficient===undefined || !Number.isInteger(coefficient) || coefficient<0 || coefficient>9) return quote("Coefficient d'affrètement non validé.");
    const ref=`P${dep}${coefficient}`;
    const tariff=source.tariffs.affretement[ref as keyof typeof source.tariffs.affretement];
    if (!tariff) return quote("Tarif affrètement ERP absent.");
    return {mode,amountHT:price(tariff.costHT),costHT:tariff.costHT,rateCode:ref,coefficient,weightKg:total,reason:"Tarif ERP ADEI · marge 25 % sur prix de vente."};
  }
  if (!valid(total)) return quote("Poids messagerie à confirmer.");
  if (total>100) {
    const ref=`M8${dep}`;
    const tariff=source.tariffs.messagerie[ref as keyof typeof source.tariffs.messagerie];
    if (!tariff) return quote("Tarif messagerie ERP absent.");
    const cost=tariff.costHT*total/100;
    return {mode,amountHT:price(cost),costHT:cost,rateCode:ref,weightKg:total,reason:"Tarif ERP par tranche de 100 kg, proportionnel au poids."};
  }
  const band=total<=40?1:Math.ceil((total-30)/10);
  const ref=`M${band}${dep}`;
  const tariff=source.tariffs.messagerie[ref as keyof typeof source.tariffs.messagerie];
  if (!tariff) return quote("Tarif messagerie ERP absent.");
  return {mode,amountHT:price(tariff.costHT),costHT:tariff.costHT,rateCode:ref,weightKg:total,reason:"Tarif ERP ADEI · minimum 30–40 kg · marge 25 %."};
}
