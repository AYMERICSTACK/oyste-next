"use client";
import AssetUploadButton from "./AssetUploadButton";
import { useEffect, useState } from "react";
import { productPresentationSchema, type ProductPresentation } from "@/lib/catalogue/product-presentation";
import CollectionEditor, { type CollectionField } from "./CollectionEditor";
const input = "mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm";
const scalars = [ ["configuratorHref", "Lien vers le configurateur personnalisé"], ["name", "Nom public"], ["shortName", "Nom court"], ["description", "Description courte"], ["detailedDescription", "Description détaillée"], ["seoTitle", "Titre SEO"], ["seoDescription", "Description SEO"], ["sortOrder", "Ordre de présentation"], ["featured", "Mettre en avant"] ] as const;
const lists = [ ["marketingBadges", "Badges commerciaux"], ["videoUrls", "Vidéos (une URL par ligne)"], ["relatedProductCodes", "Produits associés (références séparées par des virgules)"], ["accessoryProductCodes", "Accessoires (références séparées par des virgules)"] ] as const;
const collections: Array<{ key: "faq" | "features" | "media" | "documents" | "variantPresentation"; title: string; fields: CollectionField[]; initial: Record<string, unknown> }> = [
 { key: "faq", title: "Questions fréquentes", fields: [{ key: "question", label: "Question" }, { key: "answer", label: "Réponse", type: "textarea" }], initial: { question: "Nouvelle question", answer: "" } },
 { key: "features", title: "Caractéristiques publiques", fields: [{ key: "label", label: "Libellé" }, { key: "value", label: "Valeur" }], initial: { label: "Caractéristique", value: "" } },
 { key: "media", title: "Images : ordre, visibilité et image principale", fields: [{ key: "url", label: "Image (URL)", type: "image" }, { key: "altText", label: "Texte alternatif" }, { key: "enabled", label: "Afficher", type: "boolean" }, { key: "isPrimary", label: "Image principale", type: "primary" }], initial: { url: "", altText: "", enabled: true, isPrimary: false, sortOrder: 0 } },
 { key: "documents", title: "Documents", fields: [{ key: "name", label: "Nom" }, { key: "url", label: "Lien du document" }, { key: "type", label: "Type", type: "select", options: [{ value: "TECHNICAL_SHEET", label: "Fiche technique" }, { value: "INSTALLATION_MANUAL", label: "Notice" }, { value: "DIMENSION_DRAWING", label: "Plan" }, { value: "CERTIFICATE", label: "Certificat" }, { value: "COMMERCIAL_DOCUMENT", label: "Document commercial" }, { value: "OTHER", label: "Autre" }] }, { key: "isPublic", label: "Visible sur la fiche", type: "boolean" }], initial: { name: "Nouveau document", url: "", type: "OTHER", isPublic: true, sortOrder: 0 } },
 { key: "variantPresentation", title: "Présentation des variantes", fields: [{ key: "label", label: "Libellé public" }, { key: "enabled", label: "Afficher", type: "boolean" }], initial: {} },
];
export default function ProductPresentationEditor({ productId }: { productId: string }) {
 const [activeTab,setActiveTab]=useState<"general"|"content"|"media"|"details">("general");
 const [categories,setCategories]=useState<Array<{id:string;name:string}>>([]);
 const [draft, setDraft] = useState<Record<string, unknown>>({});
 const [selected, setSelected] = useState<string[]>([]);
 const [writable, setWritable] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
 async function load() {
  const response = await fetch(`/api/admin/catalogue/${encodeURIComponent(productId)}/presentation`); const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Chargement impossible.");
  const product = result.product as Record<string, unknown>;
  const overrides = productPresentationSchema.parse(result.overrides);
  const media = (product.media as Array<Record<string, unknown>>).map((item, sortOrder) => ({ url: item.url, altText: item.altText || "", isPrimary: !!item.isPrimary, sortOrder, enabled: true }));
  const documents = (product.documents as Array<Record<string, unknown>>).map((item, sortOrder) => ({ name: item.name, url: item.url, type: item.type, isPublic: !!item.isPublic, sortOrder }));
  const features = (product.features as Array<Record<string, unknown>>).map(item => ({ label: item.label, value: item.value }));
  const variantPresentation = (product.variants as Array<Record<string, unknown>>).map((item, sortOrder) => ({ id: item.id, label: String(item.label || item.name), enabled: true, sortOrder }));
  setCategories(result.categories || []);
  setDraft({ ...product, media, documents, features, variantPresentation, ...overrides }); setSelected(Object.keys(overrides)); setWritable(result.writable);
 }
 useEffect(() => { load().catch(error => setMessage(error.message)); }, [productId]);
 function customize(key: string, enabled: boolean) { setSelected(keys => enabled ? [...keys.filter(item => item !== key), key] : keys.filter(item => item !== key)); }
 function toggle(key: string) { const custom=selected.includes(key); return <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"><input type="checkbox" className="accent-[#007f8f]" disabled={busy || !writable} checked={custom} onChange={e => customize(key, e.target.checked)} /><span>{custom ? "Personnalisation OYSTE active" : "Suivre les données fournisseur"}</span></label>; }
 async function save() {
  setBusy(true); setMessage("");
  const data = Object.fromEntries(selected.map(key => [key, draft[key]]));
  const parsed = productPresentationSchema.safeParse(data);
  if (!parsed.success) { setMessage("Vérifiez les champs renseignés, les références et les liens."); setBusy(false); return; }
  try { const response = await fetch(`/api/admin/catalogue/${encodeURIComponent(productId)}/presentation`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Enregistrement impossible."); setMessage("Présentation enregistrée. Le site public utilise ces valeurs."); }
  catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
  finally { setBusy(false); }
 }
 const tabs = [
  { key: "general", label: "Général", detail: "Parcours et catégorie" },
  { key: "content", label: "Contenus & SEO", detail: "Textes et visibilité" },
  { key: "media", label: "Médias", detail: "Images et documents" },
  { key: "details", label: "Fiche technique", detail: "FAQ, caractéristiques, variantes" },
 ] as const;
 const collectionView = (collection: typeof collections[number]) => (
  <section key={collection.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
   <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-black text-slate-900">{collection.title}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{Array.isArray(draft[collection.key]) ? (draft[collection.key] as unknown[]).length : 0} élément(s)</span></div>
   {toggle(collection.key)}
   {(collection.key === "media" || collection.key === "documents") && <div className="mb-4"><AssetUploadButton scope={collection.key === "media" ? "catalogue" : "documents"} disabled={busy || !writable} onUpload={(url,name) => {customize(collection.key,true);const current=Array.isArray(draft[collection.key])?draft[collection.key] as unknown[]:[];const next=collection.key === "media"?{url,altText:name,enabled:true,isPrimary:current.length===0,sortOrder:current.length}:{url,name,type:"OTHER",isPublic:true,sortOrder:current.length};setDraft({...draft,[collection.key]:[...current,next]});}} /></div>}
   <CollectionEditor value={Array.isArray(draft[collection.key]) ? draft[collection.key] as Array<Record<string, unknown>> : []} onChange={items => setDraft({...draft,[collection.key]:items})} fields={collection.fields} initialItem={collection.initial} disabled={!selected.includes(collection.key) || busy || !writable} allowAdd={collection.key !== "variantPresentation"} allowRemove={collection.key !== "variantPresentation"} />
  </section>
 );
 return <section className="my-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
  <header className="border-b border-slate-200 bg-white px-5 py-6 md:px-8">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#007f8f]">Studio produit · OYSTE</div><h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Présentation commerciale</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Personnalisez uniquement ce qui doit différer de Stockman. Les données fournisseur restent intactes et continuent à se synchroniser.</p></div><div className="flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800"><span className="h-2 w-2 rounded-full bg-teal-500" />{selected.length ? `${selected.length} personnalisation(s)` : "Source fournisseur"}</div></div>
   <nav aria-label="Sections de la présentation commerciale" className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">{tabs.map(tab=><button key={tab.key} type="button" onClick={()=>setActiveTab(tab.key)} aria-current={activeTab===tab.key?"page":undefined} className={`rounded-xl border px-3 py-3 text-left transition ${activeTab===tab.key?"border-[#007f8f] bg-[#007f8f] text-white shadow-sm":"border-slate-200 bg-white text-slate-800 hover:border-[#007f8f]"}`}><span className="block text-sm font-black">{tab.label}</span><span className={`mt-1 block text-[11px] ${activeTab===tab.key?"text-teal-50":"text-slate-500"}`}>{tab.detail}</span></button>)}</nav>
  </header>
  <div className="space-y-5 p-4 md:p-7">
   {message && <p role="status" className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm font-semibold text-teal-900">{message}</p>}
   {activeTab==="general" && <div className="grid gap-4 md:grid-cols-2">
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-2 text-base font-black">Parcours public</h3><p className="mb-4 text-xs text-slate-500">Choisissez entre une fiche classique et un configurateur.</p>{toggle("experienceType")}<label className="block text-sm font-bold text-slate-800">Type de fiche<select disabled={!selected.includes("experienceType")||busy||!writable} value={String(draft.experienceType||"STANDARD")} onChange={e=>setDraft({...draft,experienceType:e.target.value})} className={input}><option value="STANDARD">Fiche produit standard</option><option value="CONFIGURABLE">Fiche avec configurateur</option></select></label></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-2 text-base font-black">Catégorie de présentation</h3><p className="mb-4 text-xs text-slate-500">Conservez la catégorie fournisseur ou appliquez une exception OYSTE.</p>{toggle("categoryId")}<label className="block text-sm font-bold text-slate-800">Catégorie<select value={String(draft.categoryId||"")} disabled={!selected.includes("categoryId")||busy||!writable} onChange={e=>setDraft({...draft,categoryId:e.target.value||null})} className={input}><option value="">Sans catégorie</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
   </div>}
   {activeTab==="content" && <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6"><div className="mb-5"><h3 className="text-lg font-black">Textes, référencement et mise en avant</h3><p className="mt-1 text-sm text-slate-500">Activez une personnalisation seulement pour les champs que vous souhaitez modifier.</p></div><div className="grid gap-5 md:grid-cols-2">{scalars.map(([key,title])=><div key={key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">{toggle(key)}<label className="block text-xs font-bold text-slate-800">{title}{key==="featured"?<input type="checkbox" disabled={!selected.includes(key)||busy||!writable} checked={!!draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.checked})} className="ml-3" />:["description","detailedDescription","seoDescription"].includes(key)?<textarea rows={key==="detailedDescription"?8:4} disabled={!selected.includes(key)||busy||!writable} value={String(draft[key]??"")} onChange={e=>setDraft({...draft,[key]:e.target.value})} className={input}/>:<input disabled={!selected.includes(key)||busy||!writable} type={key==="sortOrder"?"number":"text"} min={key==="sortOrder"?0:undefined} value={String(draft[key]??"")} onChange={e=>setDraft({...draft,[key]:key==="sortOrder"?Number(e.target.value):e.target.value})} className={input}/>}</label></div>)}{lists.map(([key,title])=><div key={key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">{toggle(key)}<label className="block text-xs font-bold text-slate-800">{title}<textarea rows={3} disabled={!selected.includes(key)||busy||!writable} value={Array.isArray(draft[key])?(draft[key] as string[]).join(key==="videoUrls"?"\n":", "):""} onChange={e=>setDraft({...draft,[key]:e.target.value.split(key==="videoUrls"?/\n/:/,/).map(item=>item.trim()).filter(Boolean)})} className={input}/></label></div>)}</div></div>}
   {activeTab==="media" && <div className="space-y-4">{collections.filter(c=>c.key==="media"||c.key==="documents").map(collectionView)}</div>}
   {activeTab==="details" && <div className="space-y-4">{collections.filter(c=>c.key==="faq"||c.key==="features"||c.key==="variantPresentation").map(collectionView)}</div>}
  </div>
  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 md:px-8"><p className="max-w-lg text-xs text-slate-500">Les personnalisations n'effacent jamais les données Stockman. Désactivez-les pour revenir à la source.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>load().catch(error=>setMessage(error.message))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Recharger les données</button>{writable&&<button type="button" disabled={busy} onClick={save} className="rounded-xl bg-[#007f8f] px-5 py-3 text-sm font-black text-white hover:bg-[#006875] disabled:opacity-50">{busy?"Enregistrement…":"Enregistrer la présentation"}</button>}</div></footer>
 </section>;
}
