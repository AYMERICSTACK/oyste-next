export type AdminIdentity = { role: string } | null;
export function canWriteCatalogue(admin: AdminIdentity): boolean {
  return !!admin && ["SUPER_ADMIN", "CATALOG_MANAGER"].includes(admin.role);
}
export function canWriteContent(admin: AdminIdentity): boolean {
  return !!admin && ["SUPER_ADMIN", "CONTENT_EDITOR"].includes(admin.role);
}
