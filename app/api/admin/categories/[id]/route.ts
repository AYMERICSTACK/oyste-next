import { saveReference, deleteReference } from "@/lib/admin/reference-api";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return saveReference("category", request, (await params).id);
}
export async function DELETE(request: Request, { params }: Context) {
  return deleteReference("category", request, (await params).id);
}
