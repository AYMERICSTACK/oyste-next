import { redirect } from "next/navigation";
import NewProductForm from "@/components/admin/NewProductForm";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { canWriteCatalogue } from "@/lib/admin/catalogue-permissions";
export default async function NewProductPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin");
  if (!canWriteCatalogue(admin)) return <p className="p-6">Votre rôle ne permet pas de créer un produit.</p>;
  const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <main className="p-6"><h1 className="text-3xl font-black">Nouveau produit</h1><NewProductForm categories={categories} /></main>;
}
