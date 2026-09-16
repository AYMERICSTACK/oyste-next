import type { ErpComponent } from "@/lib/erp/types";

const FCM_TOTAL_WEIGHT_KG: Record<string, number> = {
  FCM1_600: 40,
  FCM2_760: 44,
  FCM3_760: 53,
  FCM4_1010: 96,
  FCM4_1400: 96,
};

const KITFIX_WEIGHT_KG: Record<string, number> = {
  KF1A220CE: 45, KF1A300CE: 53, KF1C220CL: 35, KF1C300CL: 40,
  KF2A220CE: 47, KF2A300CE: 55, KF2C220CL: 37, KF2C300CL: 44,
  KF3A220CE: 82, KF3A300CE: 98, KF3C220CL: 62, KF3C300CL: 70,
  KF4A220CE: 102, KF4A300CE: 118, KF4C220CL: 84, KF4C300CL: 94,
  KF5A220CE: 108, KF5A300CE: 124, KF5C220CL: 90, KF5C300CL: 100,
};

export function getWallFixingWeightKg(components: ErpComponent[]) {
  for (const component of components) {
    const code = component.code.toUpperCase();
    if (FCM_TOTAL_WEIGHT_KG[code] !== undefined) return FCM_TOTAL_WEIGHT_KG[code];
    if (KITFIX_WEIGHT_KG[code] !== undefined) return KITFIX_WEIGHT_KG[code];
  }
  return 0;
}
