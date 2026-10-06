"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function NewProductForm({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", code: "", slug: "", priceHt: "", categoryId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="mt-6 max-w-2xl space-y-4 rounded-2xl border bg-white p-6" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/catalogue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, priceHt: Number(values.priceHt), categoryId: values.categoryId || null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Création impossible.");
      router.push(`/admin/catalogue/${encodeURIComponent(result.id)}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Création impossible."); setBusy(false); }
  }}>
    <p className="text-sm text-slate-500">Créer un produit manuel en brouillon. Complétez ensuite les textes, la livraison et les images avant publication.</p>
    {([ ["name", "Nom"], ["code", "Référence"], ["slug", "Adresse publique (minuscules et tirets)"], ["priceHt", "Prix HT"] ] as const).map(([key, label]) => <label key={key} className="block text-sm font-bold">{label}<input required disabled={busy} type={key === "priceHt" ? "number" : "text"} min={key === "priceHt" ? 0 : undefined} step={key === "priceHt" ? "0.01" : undefined} value={values[key]} onChange={e => setValues({ ...values, [key]: e.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label>)}
    <label className="block text-sm font-bold">Catégorie<select required disabled={busy} value={values.categoryId} onChange={e => setValues({ ...values, categoryId: e.target.value })} className="mt-1 w-full rounded-xl border p-3"><option value="">Sélectionner une catégorie</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="rounded-xl bg-[#007f8f] px-5 py-3 font-bold text-white">{busy ? "Création…" : "Créer le brouillon"}</button>
  </form>;
}
