"use client";
import AssetUploadButton from "./AssetUploadButton";
import type { CmsContent } from "@/lib/cms-content";
type Home = CmsContent["home"];
const input = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";

export default function HomeCommercialEditor({ value, onChange }: { value: Home; onChange: (value: Home) => void }) {
  function move(key: "slides" | "quickLinks", index: number, offset: number) {
    const items = [...value[key]].sort((a, b) => a.order - b.order);
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    onChange({ ...value, [key]: items.map((item, order) => ({ ...item, order })) });
  }
  return <div className="mt-6 space-y-6"><label className="flex gap-2 text-sm"><input type="checkbox" checked={value.heroEnabled} onChange={e => onChange({ ...value, heroEnabled: e.target.checked })} />Afficher le hero</label>
    {(["quickLinks", "slides"] as const).map(key => <section key={key} className="space-y-3 border-t pt-5">
      <h3 className="font-black">{key === "slides" ? "Slides commerciales" : "Liens rapides"}</h3>
      {[...value[key]].sort((a, b) => a.order - b.order).map((item, index) => {
        const originalIndex = value[key].findIndex(entry => entry === item);
        function update(field: string, fieldValue: string | boolean) {
          onChange({ ...value, [key]: value[key].map((entry, i) => i === originalIndex ? { ...entry, [field]: fieldValue } : entry) });
        }
        return <article key={index} className="space-y-3 rounded-xl border p-4">
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={item.enabled} onChange={e => update("enabled", e.target.checked)} />Afficher</label>
          {Object.entries(item).filter(([field]) => !["enabled", "order", "image"].includes(field)).map(([field, fieldValue]) => <label key={field} className="block text-xs font-bold">
            {({ label: "Libellé", title: "Titre", text: "Texte", href: "Lien du bouton", ctaLabel: "Libellé du bouton" } as Record<string, string>)[field]}
            <input value={String(fieldValue)} onChange={e => update(field, e.target.value)} className={input} />
          </label>)}
          {"image" in item && <label className="block text-xs font-bold">Image (URL)<input value={item.image} onChange={e => update("image", e.target.value)} className={input} /><AssetUploadButton scope="cms" onUpload={url=>update("image",url)}/><img src={item.image} alt="Aperçu de la slide" className="mt-2 h-28 w-full object-contain" /></label>}
          <div className="flex gap-3 text-xs font-bold">
            <button type="button" disabled={index === 0} onClick={() => move(key, index, -1)}>Monter</button>
            <button type="button" disabled={index === value[key].length - 1} onClick={() => move(key, index, 1)}>Descendre</button>
            <button type="button" className="text-red-700" onClick={() => { if (window.confirm("Supprimer cet élément ?")) onChange({ ...value, [key]: value[key].filter((_, i) => i !== originalIndex) }); }}>Supprimer</button>
          </div>
        </article>;
      })}
      <button type="button" className="text-sm font-bold text-[#007f8f]" onClick={() => {
        const order = Math.max(-1, ...value[key].map(item => item.order)) + 1;
        const item = key === "slides" ? { label: "Nouvelle slide", title: "Titre", text: "", href: "/catalogue", image: "/images/hero-potence.png", ctaLabel: "Découvrir", enabled: false, order } : { label: "Nouveau lien", href: "/catalogue", enabled: false, order };
        onChange({ ...value, [key]: [...value[key], item] });
      }}>Ajouter {key === "slides" ? "une slide" : "un lien"}</button>
    </section>)}
    <section className="space-y-3 border-t pt-5"><h3 className="font-black">Titres des sections</h3>
      {([ ["categoryEyebrow", "Surtitre catégories"], ["categoryTitle", "Titre catégories"], ["catalogueLabel", "Libellé du lien catalogue"], ["catalogueHref", "Destination du lien catalogue"], ["supplierEyebrow", "Surtitre fournisseurs"], ["supplierTitle", "Titre fournisseurs"] ] as const).map(([key, label]) => <label key={key} className="block text-xs font-bold">{label}<input value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} className={input} /></label>)}
    </section>
  </div>;
}
