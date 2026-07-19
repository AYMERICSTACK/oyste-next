import { erpSnapshot } from "@/data/erp/erp-snapshot";
import type { ErpFamily, ErpOuvrage, ErpProduct, ErpSnapshot } from "../types";

function normalizeRef(value: string) {
  return value.trim().toUpperCase();
}

function groupBy<T>(items: T[], getKey: (item: T) => string | undefined) {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const current = map.get(key) ?? [];
    current.push(item);
    map.set(key, current);
  }

  return map;
}

export class ERPStore {
  readonly snapshot: ErpSnapshot;
  private readonly ouvragesByCode: Map<string, ErpOuvrage>;
  private readonly ouvragesByFamily: Map<string, ErpOuvrage[]>;
  private readonly productsByRef: Map<string, ErpProduct>;
  private readonly productsByFamily: Map<string, ErpProduct[]>;
  private readonly familiesByCode: Map<string, ErpFamily>;

  constructor(snapshot: ErpSnapshot = erpSnapshot) {
    this.snapshot = snapshot;
    this.ouvragesByCode = new Map(
      snapshot.ouvrages.map((ouvrage) => [normalizeRef(ouvrage.code), ouvrage])
    );
    this.ouvragesByFamily = groupBy(snapshot.ouvrages, (ouvrage) => ouvrage.family);
    this.productsByRef = new Map(
      snapshot.products.map((product) => [normalizeRef(product.ref), product])
    );
    this.productsByFamily = groupBy(snapshot.products, (product) => product.family);
    this.familiesByCode = new Map(
      snapshot.families.map((family) => [normalizeRef(family.code), family])
    );
  }

  getStats() {
    return this.snapshot.stats;
  }

  getFamilies(): ErpFamily[] {
    return this.snapshot.families;
  }

  getFamily(code: string): ErpFamily | undefined {
    return this.familiesByCode.get(normalizeRef(code));
  }

  getOuvrages(): ErpOuvrage[] {
    return this.snapshot.ouvrages;
  }

  getOuvrage(code: string): ErpOuvrage | undefined {
    return this.ouvragesByCode.get(normalizeRef(code));
  }

  getOuvragesByFamily(family: string): ErpOuvrage[] {
    return this.ouvragesByFamily.get(normalizeRef(family)) ?? [];
  }

  getProducts(): ErpProduct[] {
    return this.snapshot.products;
  }

  getProduct(ref: string): ErpProduct | undefined {
    return this.productsByRef.get(normalizeRef(ref));
  }

  getProductsByFamily(family: string): ErpProduct[] {
    return this.productsByFamily.get(normalizeRef(family)) ?? [];
  }
}

export const erpStore = new ERPStore();
