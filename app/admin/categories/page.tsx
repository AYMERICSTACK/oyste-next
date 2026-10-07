import PresentationInitialization from "@/components/admin/PresentationInitialization";
import ReferenceManager from "@/components/admin/ReferenceManager";

export default function CategoriesPage() {
  return <main className="mx-auto w-full max-w-[1500px] p-4 md:p-7 xl:p-9">
    <PresentationInitialization />
    <div className="mt-2">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">Structure du catalogue</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">Catégories</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Organise les univers, familles et sous-familles visibles dans le catalogue et sur la page d’accueil.</p>
    </div>
    <ReferenceManager kind="categories" />
  </main>;
}
