import { erpStore, type ERPStore } from "../store";
import type { ErpFamily } from "../types";

export class FamilyRepository {
  constructor(private readonly store: ERPStore = erpStore) {}

  all(): ErpFamily[] {
    return this.store.getFamilies();
  }

  findByCode(code: string): ErpFamily | undefined {
    return this.store.getFamily(code);
  }
}
