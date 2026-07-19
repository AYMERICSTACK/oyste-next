import { erpStore, type ERPStore } from "../store";
import type { ErpComponent } from "../types";

export class ComponentRepository {
  constructor(private readonly store: ERPStore = erpStore) {}

  findByOuvrage(ouvrageCode: string): ErpComponent[] {
    return this.store.getOuvrage(ouvrageCode)?.components ?? [];
  }
}
