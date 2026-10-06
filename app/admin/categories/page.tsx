import PresentationInitialization from "@/components/admin/PresentationInitialization";
import ReferenceManager from "@/components/admin/ReferenceManager";
export default function CategoriesPage() {
  return <main className="mx-auto max-w-6xl p-6"><PresentationInitialization/><h1 className="text-3xl font-black">Catégories</h1><ReferenceManager kind="categories" /></main>;
}
