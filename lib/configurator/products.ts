import type { ProductVariant } from "./types";

const capacities = [
  { id: "125", prices: { PFI: 1131, PFT: 1190, PMI: 980, PMT: 1040 } },
  { id: "250", prices: { PFI: 1390, PFT: 1460, PMI: 1210, PMT: 1280 } },
  { id: "500", prices: { PFI: 1690, PFT: 1780, PMI: 1490, PMT: 1580 } },
  { id: "1000", prices: { PFI: 2290, PFT: 2410, PMI: 2050, PMT: 2180 } },
] as const;

const reaches = [
  { id: "2m", ref: "2", label: "2 m", impact: 0 },
  { id: "2-5m", ref: "2.5", label: "2,5 m", impact: 140 },
  { id: "3m", ref: "3", label: "3 m", impact: 260 },
] as const;

const families = [
  {
    code: "PFI",
    label: "Potence sur fût inversée",
    installation: "fut",
    conception: "inversee",
    fixing: ["dalle", "massif"],
  },
  {
    code: "PFT",
    label: "Potence sur fût triangulée",
    installation: "fut",
    conception: "triangulee",
    fixing: ["dalle", "massif"],
  },
  {
    code: "PMI",
    label: "Potence murale inversée",
    installation: "murale",
    conception: "inversee",
    fixing: ["murale"],
  },
  {
    code: "PMT",
    label: "Potence murale triangulée",
    installation: "murale",
    conception: "triangulee",
    fixing: ["murale"],
  },
] as const;

export const productVariants: ProductVariant[] = families.flatMap((family) =>
  capacities.flatMap((capacity) =>
    reaches.map((reach) => ({
      id: `${family.code.toLowerCase()}-${capacity.id}-${reach.id}`,
      familyCode: family.code,
      label: family.label,
      reference: `${family.code}${capacity.id}/${reach.ref}`,
      installation: family.installation,
      conception: family.conception,
      capacity: capacity.id,
      reach: reach.id,
      fixing: [...family.fixing],
      environment: ["atelier", "maintenance", "exterieur"],
      price: capacity.prices[family.code] + reach.impact,
    }))
  )
);
