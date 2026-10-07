"use client";
import AssetUploadButton from "./AssetUploadButton";
import { isIntegrationSupplier } from "@/lib/admin/reference-validation";
import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ChevronRight, Layers3, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";
type Item = { id: string; name: string; slug: string; isActive: boolean; [key: string]: unknown };
type Field = { key: string; label: string; type?: string };
const common: Field[] = [{ key: "name", label: "Nom" }, { key: "slug", label: "Adresse publique" }];
const supplierFields: Field[] = [{ key: "logoUrl", label: "Logo (URL)", type: "image" }, { key: "contactName", label: "Contact" }, { key: "email", label: "E-mail", type: "email" }, { key: "phone", label: "Téléphone" }, { key: "website", label: "Site web" }, { key: "averageLeadTime", label: "Délai moyen" }, { key: "internalNotes", label: "Notes internes", type: "textarea" }, { key: "homeHref", label: "Lien au clic sur l’accueil" }, { key: "homeOrder", label: "Ordre sur l’accueil", type: "number" }];
const categoryFields: Field[] = [{ key: "description", label: "Description", type: "textarea" }, { key: "seoTitle", label: "Titre SEO" }, { key: "seoDescription", label: "Description SEO", type: "textarea" }, { key: "imageUrl", label: "Image (URL)", type: "image" }, { key: "sortOrder", label: "Ordre", type: "number" }, { key: "publicLabel", label: "Libellé public" }, { key: "homeLabel", label: "Libellé sur l’accueil" }, { key: "publicSubtitle", label: "Sous-titre public" }, { key: "publicTags", label: "Mots-clés (séparés par des virgules)", type: "tags" }, { key: "publicHref", label: "Lien public facultatif" }, { key: "publicFamilySlug", label: "Filtre famille existant (facultatif)" }, { key: "homeImageUrl", label: "Image sur l’accueil (URL)", type: "image" }, { key: "homeOrder", label: "Ordre sur l’accueil", type: "number" }];
const input = "mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm";
export default function ReferenceManager({ kind }: { kind: "categories" | "suppliers" }) {
  const [items, setItems] = useState<Item[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [productQuery, setProductQuery] = useState("");
  const [writable, setWritable] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const fields = [...common, ...(kind === "categories" ? categoryFields : supplierFields)];
  const filteredItems = useMemo(() => items.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);
  const activeCount = useMemo(() => items.filter(item => item.isActive).length, [items]);
  async function load() {
    const response = await fetch(`/api/admin/${kind}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Chargement impossible.");
    setItems(result.items); setProducts(result.products || []); setWritable(result.writable);
  }
  useEffect(() => { load().catch(error => setMessage(error.message)); }, [kind]);
  function edit(item?: Item) {
    const values: Record<string, unknown> = { homeVisible: item?.homeVisible ?? false, catalogueVisible: item?.catalogueVisible ?? true, homeParentId: item?.homeParentId ?? null, representativeProductId: item?.representativeProductId ?? null, isActive: item?.isActive ?? true, ...(kind === "categories" ? { parentId: item?.parentId ?? null } : {}) };
    for (const field of fields) values[field.key] = item?.[field.key] ?? (field.type === "number" ? 0 : "");
    if (kind === "suppliers") { delete values.catalogueVisible; delete values.homeParentId; delete values.representativeProductId; }
    values.publicTags = Array.isArray(item?.publicTags) ? item.publicTags.join(", ") : "";
    if (kind === "suppliers") delete values.publicTags;
    if (item) values.id = item.id;
    setEditing(values); setMessage("");
  }
  async function save() {
    if (!editing) return;
    setBusy(true); setMessage("");
    const { id, ...body } = editing;
    for (const field of fields) if (field.type === "tags") body[field.key] = String(body[field.key] ?? "").split(",").map(item => item.trim()).filter(Boolean);
    for (const field of fields) if (!common.includes(field) && body[field.key] === "") body[field.key] = null;
    try {
      const response = await fetch(`/api/admin/${kind}${id ? `/${encodeURIComponent(String(id))}` : ""}`, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Enregistrement impossible.");
      await load(); setEditing(null); setMessage("Enregistré.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  async function remove(item: Item) {
    if (!window.confirm(`Supprimer « ${item.name} » ? La suppression sera refusée si des données sont liées.`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/${kind}/${encodeURIComponent(item.id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Suppression impossible.");
      await load(); setMessage("Supprimé.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Suppression impossible."); }
    finally { setBusy(false); }
  }
  return <section id={kind === "suppliers" ? "supplier-references" : "category-references"} className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-cyan-50/40 p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">{kind === "categories" ? <Layers3 size={21}/> : <Building2 size={21}/>}</div>
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-slate-950 md:text-2xl">{kind === "categories" ? "Référentiel des catégories" : "Fiches fournisseurs"}</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">{activeCount} actifs</span></div><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Les adresses existantes sont conservées. Les champs de présentation pilotent le site public et l’accueil.</p></div>
        </div>
        {writable && <button disabled={busy} onClick={() => edit()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-900/10 transition hover:-translate-y-0.5 hover:bg-[#006f7d] disabled:opacity-50"><Plus size={17}/>{kind === "categories" ? "Nouvelle catégorie" : "Nouveau fournisseur"}</button>}
      </div>
    </div>
    <div className="p-5 md:p-6">
    {message && <p role="status" className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p>}
    {editing ? <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
      <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#007f8f]">{editing.id ? "Modification" : "Création"}</p><h3 className="mt-1 text-lg font-black text-slate-950">{String(editing.name || (kind === "categories" ? "Nouvelle catégorie" : "Nouveau fournisseur"))}</h3></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">{writable ? "Modifiable" : "Lecture seule"}</span></div>
      <div className="grid gap-4 md:grid-cols-2">
      {fields.map(field => <label key={field.key} className="text-xs font-bold text-slate-700">{field.label}
        {field.type === "textarea" ? <textarea disabled={!writable || busy} value={String(editing[field.key] ?? "")} onChange={e => setEditing({ ...editing, [field.key]: e.target.value })} className={input} /> : <input disabled={!writable || busy} readOnly={!!editing.id && (field.key === "slug" || (kind === "suppliers" && field.key === "name" && isIntegrationSupplier(items.find(item => item.id === editing.id) ?? {})))} type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"} min={field.type === "number" ? 0 : undefined} value={String(editing[field.key] ?? "")} onChange={e => setEditing({ ...editing, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value })} className={input} />}
        {field.type === "image" && <AssetUploadButton scope={kind} disabled={!writable || busy} onUpload={url=>setEditing({...editing,[field.key]:url})}/>} {field.type === "image" && !!editing[field.key] && <img src={String(editing[field.key])} alt="Aperçu" className="mt-2 h-24 w-full rounded-xl border border-slate-200 bg-white object-contain p-2" />}
      </label>)}
      {kind === "categories" && <label className="text-xs font-bold text-slate-700">Catégorie parente<select disabled={busy || !writable} value={String(editing.parentId ?? "")} onChange={e => setEditing({ ...editing, parentId: e.target.value || null })} className={input}><option value="">Aucune</option>{items.filter(item => item.id !== editing.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {kind === "categories" && <><label className="text-xs font-bold text-slate-700">Catégorie mère de présentation<select disabled={busy || !writable} value={String(editing.homeParentId ?? "")} onChange={e => setEditing({ ...editing, homeParentId: e.target.value || null })} className={input}><option value="">Catégorie principale</option>{items.filter(item => item.id !== editing.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-bold text-slate-700">Produit représentatif<input value={productQuery} onChange={e => setProductQuery(e.target.value)} placeholder="Rechercher un nom ou une référence" className={input}/><select disabled={busy || !writable} value={String(editing.representativeProductId ?? "")} onChange={e => setEditing({ ...editing, representativeProductId: e.target.value || null })} className={input}><option value="">Aucun (utiliser l’image choisie)</option>{products.filter(item => item.id === editing.representativeProductId || `${item.name} ${item.code}`.toLowerCase().includes(productQuery.toLowerCase())).sort((a,b)=>Number(b.id===editing.representativeProductId)-Number(a.id===editing.representativeProductId)).slice(0,100).map(item=><option key={item.id} value={item.id}>{item.name} — {item.code}</option>)}</select></label><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold"><input type="checkbox" disabled={busy || !writable} checked={!!editing.catalogueVisible} onChange={e=>setEditing({...editing,catalogueVisible:e.target.checked})}/>Afficher dans le catalogue</label></>}
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold"><input type="checkbox" disabled={busy || !writable} checked={!!editing.homeVisible} onChange={e=>setEditing({...editing,homeVisible:e.target.checked})}/>Afficher sur l’accueil</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold"><input type="checkbox" disabled={busy || !writable} checked={!!editing.isActive} onChange={e=>setEditing({...editing,isActive:e.target.checked})}/>Actif</label>
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5 md:col-span-2"><button disabled={busy} onClick={()=>setEditing(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Fermer</button>{writable&&<button disabled={busy} onClick={save} className="rounded-xl bg-[#007f8f] px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-900/10 disabled:opacity-50">{busy?"Enregistrement…":"Enregistrer les modifications"}</button>}</div>
      </div>
    </div> : <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-50"><Search size={18} className="shrink-0 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher par nom…" className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"/></div><p className="text-xs font-bold text-slate-400">{filteredItems.length} résultat{filteredItems.length>1?"s":""} sur {items.length}</p></div>
      <div className="mt-4 grid gap-2">
        {filteredItems.map(item => <article key={item.id} onClick={()=>edit(item)} className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg hover:shadow-slate-200/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-cyan-50 group-hover:text-[#007f8f]">{kind === "categories" ? <Layers3 size={18}/> : <Building2 size={18}/>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-black text-slate-950">{item.name}</h3><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${item.isActive?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{item.isActive?<CheckCircle2 size={11}/>:<XCircle size={11}/>}{item.isActive?"Actif":"Inactif"}</span></div><p className="mt-1 truncate text-xs font-semibold text-slate-400">/{item.slug}</p></div></div>
          <div className="flex items-center justify-end gap-2" onClick={e=>e.stopPropagation()}><button disabled={busy} onClick={()=>edit(item)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-[#007f8f]"><Pencil size={14}/>{writable?"Modifier":"Consulter"}</button>{writable&&<button disabled={busy} aria-label={`Supprimer ${item.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 text-red-500 transition hover:bg-red-50 hover:text-red-700" onClick={()=>remove(item)}><Trash2 size={15}/></button>}<ChevronRight size={17} className="ml-1 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#007f8f]"/></div>
        </article>)}
        {!filteredItems.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center"><Search className="mx-auto text-slate-300"/><p className="mt-3 text-sm font-black text-slate-700">Aucun résultat</p><p className="mt-1 text-xs text-slate-400">Essaie avec un autre nom.</p></div>}
      </div>
    </>}
    </div>
  </section>;
}
