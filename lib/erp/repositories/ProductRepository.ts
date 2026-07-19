import { erpStore, type ERPStore } from "../store";
import type { ErpProduct } from "../types";

export class ProductRepository {
  constructor(private readonly store: ERPStore = erpStore) {}

  all(): ErpProduct[] {
    return this.store.getProducts();
  }

  findByRef(ref: string): ErpProduct | undefined {
    return this.store.getProduct(ref);
  }

  findByFamily(family: string): ErpProduct[] {
    return this.store.getProductsByFamily(family);
  }
}
