"use client";
import AssetUploadButton from "./AssetUploadButton";
import { isIntegrationSupplier } from "@/lib/admin/reference-validation";
import { useEffect, useState } from "react";
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
  return <section id={kind === "suppliers" ? "supplier-references" : "category-references"} className="mt-6 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">{kind === "categories" ? "Référentiel des catégories" : "Fiches fournisseurs"}</h2>{writable && <button disabled={busy} onClick={() => edit()} className="rounded-xl bg-[#007f8f] px-4 py-3 text-sm font-bold text-white">{kind === "categories" ? "Nouvelle catégorie" : "Nouveau fournisseur"}</button>}</div>
    <p className="mt-2 text-sm text-slate-500">Les adresses existantes sont conservées. Les champs de présentation contrôlent le site public et l’accueil.</p>
    {message && <p role="status" className="my-3 rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
    {editing ? <div className="mt-5 grid gap-4 md:grid-cols-2">
      {fields.map(field => <label key={field.key} className="text-xs font-bold">{field.label}
        {field.type === "textarea" ? <textarea disabled={!writable || busy} value={String(editing[field.key] ?? "")} onChange={e => setEditing({ ...editing, [field.key]: e.target.value })} className={input} /> : <input disabled={!writable || busy} readOnly={!!editing.id && (field.key === "slug" || (kind === "suppliers" && field.key === "name" && isIntegrationSupplier(items.find(item => item.id === editing.id) ?? {})))} type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"} min={field.type === "number" ? 0 : undefined} value={String(editing[field.key] ?? "")} onChange={e => setEditing({ ...editing, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value })} className={input} />}
        {field.type === "image" && <AssetUploadButton scope={kind} disabled={!writable || busy} onUpload={url=>setEditing({...editing,[field.key]:url})}/>}
        {field.type === "image" && !!editing[field.key] && <img src={String(editing[field.key])} alt="Aperçu" className="mt-2 h-24 w-full object-contain" />}
      </label>)}
      {kind === "categories" && <label className="text-xs font-bold">Catégorie parente<select disabled={busy || !writable} value={String(editing.parentId ?? "")} onChange={e => setEditing({ ...editing, parentId: e.target.value || null })} className={input}><option value="">Aucune</option>{items.filter(item => item.id !== editing.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {kind === "categories" && <>
        <label className="text-xs font-bold">Catégorie mère de présentation<select disabled={busy || !writable} value={String(editing.homeParentId ?? "")} onChange={e => setEditing({ ...editing, homeParentId: e.target.value || null })} className={input}><option value="">Catégorie principale</option>{items.filter(item => item.id !== editing.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs font-bold">Produit représentatif (son image principale devient prioritaire)<input value={productQuery} onChange={e => setProductQuery(e.target.value)} placeholder="Rechercher un nom ou une référence" className={input} /><select disabled={busy || !writable} value={String(editing.representativeProductId ?? "")} onChange={e => setEditing({ ...editing, representativeProductId: e.target.value || null })} className={input}><option value="">Aucun (utiliser l’image choisie)</option>{products.filter(item => item.id === editing.representativeProductId || `${item.name} ${item.code}`.toLowerCase().includes(productQuery.toLowerCase())).sort((a,b)=>Number(b.id===editing.representativeProductId)-Number(a.id===editing.representativeProductId)).slice(0, 100).map(item => <option key={item.id} value={item.id}>{item.name} — {item.code}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy || !writable} checked={!!editing.catalogueVisible} onChange={e => setEditing({ ...editing, catalogueVisible: e.target.checked })} />Afficher dans le catalogue</label>
      </>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy || !writable} checked={!!editing.homeVisible} onChange={e => setEditing({ ...editing, homeVisible: e.target.checked })} />Afficher sur l’accueil</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy || !writable} checked={!!editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />Actif</label>
      <div className="flex gap-4 md:col-span-2"><button disabled={busy} onClick={() => setEditing(null)}>Fermer</button>{writable && <button disabled={busy} onClick={save} className="rounded-xl bg-[#007f8f] px-4 py-3 text-white">{busy ? "Enregistrement…" : "Enregistrer"}</button>}</div>
    </div> : <><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher par nom…" className={input} /><ul className="mt-4 divide-y">{items.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3"><span>{item.name} · {item.isActive ? "Actif" : "Inactif"}</span><div className="flex gap-4"><button disabled={busy} onClick={() => edit(item)}>{writable ? "Modifier" : "Consulter"}</button>{writable && <button disabled={busy} className="text-red-700" onClick={() => remove(item)}>Supprimer</button>}</div></li>)}</ul></>}
  </section>;
}
