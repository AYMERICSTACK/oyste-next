"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  ArrowLeft,
  Check,
  FileText,
  GripVertical,
  ImagePlus,
  Link2,
  Plus,
  Save,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { AdminCatalogueProduct } from "@/lib/admin/catalogue-admin";
import StockmanProductSyncAssistant from "@/components/admin/StockmanProductSyncAssistant";

const tabs = [
  "Informations",
  "Parcours produit",
  "Description",
  "Médias",
  "Fiches techniques",
  "Caractéristiques",
  "SEO",
];
const emptyProduct = {
  weightKg: null,
  shippingMode: "QUOTE",
  id: "",
  code: "",
  name: "",
  shortName: "",
  manufacturer: "OYSTE",
  categoryPath: "",
  slug: "",
  description: "",
  detailedDescription: "",
  seoTitle: "",
  seoDescription: "",
  priceHT: null,
  delay: "",
  stock: null,
  images: [],
  features: [],
  documentCount: 0,
  status: "Brouillon",
  completeness: 0,
  stockmanSyncTargets: [],
} as unknown as AdminCatalogueProduct;

function escapeEditorialHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function editorialMarkdownToHtml(value: string) {
  const escaped = escapeEditorialHtml(value || "");
  const blocks = escaped
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const renderInline = (text: string) =>
    text
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
      );

  const html: string[] = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const block of blocks) {
    if (/^##\s+/.test(block)) {
      closeList();
      html.push(`<h3>${renderInline(block.replace(/^##\s+/, ""))}</h3>`);
      continue;
    }
    // Stockman utilise parfois une puce pour le titre principal.
    // Si le bloc est "• **Titre**", on le transforme en vrai titre,
    // sans créer de liste.
    const bulletedBoldTitle = block.match(/^(?:•|-)\s+\*\*([\s\S]+)\*\*$/);
    if (bulletedBoldTitle) {
      closeList();
      html.push(`<h3>${renderInline(bulletedBoldTitle[1])}</h3>`);
      continue;
    }

    if (/^(?:•|-)\s+/.test(block)) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${renderInline(block.replace(/^(?:•|-)\s+/, ""))}</li>`);
      continue;
    }
    closeList();

    // Un bloc uniquement en **gras** correspond aux titres éditoriaux Stockman.
    const boldTitle = block.match(/^\*\*([\s\S]+)\*\*$/);
    if (boldTitle) {
      html.push(`<h3>${renderInline(boldTitle[1])}</h3>`);
      continue;
    }

    html.push(`<p>${renderInline(block.replace(/\n+/g, "<br />"))}</p>`);
  }
  closeList();
  return html.join("");
}

function StructuredDescriptionEditor({ value }: { value: string }) {
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      dangerouslySetInnerHTML={{ __html: editorialMarkdownToHtml(value) }}
      className="min-h-[320px] max-h-[520px] overflow-y-auto rounded-b-xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium leading-7 text-slate-700 outline-none transition focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-900/5 [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-black [&_h3]:text-slate-950 [&_h3:first-child]:mt-0 [&_p]:mb-4 [&_a]:font-bold [&_a]:text-[#007f8f] [&_a]:underline [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6"
    />
  );
}


function formatAdminCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAdminNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value)}${suffix}`;
}

export default function ProductEditor({
  product = emptyProduct,
  mode = "edit",
}: {
  product?: AdminCatalogueProduct;
  mode?: "edit" | "create";
}) {
  const [active, setActive] = useState("Informations");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [error, setError] = useState("");
  const [mediaImages, setMediaImages] = useState<string[]>(product.images || []);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(product.status);
  const [weightKg, setWeightKg] = useState(
    product.weightKg && product.weightKg > 0 ? product.weightKg.toString() : "",
  );
  const [packageLengthCm, setPackageLengthCm] = useState(
    product.packageLengthCm && product.packageLengthCm > 0 ? product.packageLengthCm.toString() : "",
  );
  const [packageWidthCm, setPackageWidthCm] = useState(
    product.packageWidthCm && product.packageWidthCm > 0 ? product.packageWidthCm.toString() : "",
  );
  const [packageHeightCm, setPackageHeightCm] = useState(
    product.packageHeightCm && product.packageHeightCm > 0 ? product.packageHeightCm.toString() : "",
  );
  const [shippingMode, setShippingMode] = useState(
    product.shippingMode || "QUOTE",
  );
  const [leadTime, setLeadTime] = useState(product.delay || "");
  const [experienceType, setExperienceType] = useState(
    product.experienceType || "STANDARD",
  );
  const [variants, setVariants] = useState(() =>
    (product.variants || []).map((variant) => ({
      id: variant.id,
      code: variant.code,
      name: variant.label || variant.name,
      weightKg:
        variant.weightKg && variant.weightKg > 0
          ? variant.weightKg.toString()
          : "",
      packageLengthCm:
        variant.packageLengthCm && variant.packageLengthCm > 0
          ? variant.packageLengthCm.toString()
          : "",
      packageWidthCm:
        variant.packageWidthCm && variant.packageWidthCm > 0
          ? variant.packageWidthCm.toString()
          : "",
      packageHeightCm:
        variant.packageHeightCm && variant.packageHeightCm > 0
          ? variant.packageHeightCm.toString()
          : "",
      shippingMode: variant.shippingMode || "",
    })),
  );

  const save = async () => {
    if (mode === "create") {
      setError(
        "La création complète d’un produit sera branchée avec le prochain module catalogue.",
      );
      return;
    }

    const parsedWeight =
      weightKg.trim() === "" ? null : Number(weightKg.replace(",", "."));
    if (parsedWeight !== null && !Number.isFinite(parsedWeight)) {
      setError("Le poids renseigné n’est pas valide.");
      return;
    }
    // Stockman utilise parfois 0 quand le poids n'est pas renseigné.
    // OYSTE le traite comme une donnée absente plutôt que comme une erreur.
    const normalizedWeight =
      parsedWeight !== null && parsedWeight > 0 ? parsedWeight : null;

    const parseDimension = (value: string) => {
      if (value.trim() === "") return null;
      const parsed = Number(value.replace(",", "."));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };
    const normalizedPackageLengthCm = parseDimension(packageLengthCm);
    const normalizedPackageWidthCm = parseDimension(packageWidthCm);
    const normalizedPackageHeightCm = parseDimension(packageHeightCm);
    const productDimensionValues = [packageLengthCm, packageWidthCm, packageHeightCm];
    const hasPartialProductDimensions =
      productDimensionValues.some((value) => value.trim() !== "") &&
      [normalizedPackageLengthCm, normalizedPackageWidthCm, normalizedPackageHeightCm].some((value) => value === null);
    if (hasPartialProductDimensions) {
      setError("Pour Sendcloud, renseignez les 3 dimensions du colis (L × l × H), ou laissez les 3 champs vides.");
      return;
    }

    if (shippingMode === "MESSAGERIE" && normalizedWeight === null) {
      setError("Renseignez le poids avant de sélectionner la messagerie.");
      return;
    }

    const normalizedVariants = variants.map((variant) => {
      const parsedVariantWeight =
        variant.weightKg.trim() === ""
          ? null
          : Number(variant.weightKg.replace(",", "."));
      return {
        id: variant.id,
        weightKg:
          parsedVariantWeight !== null &&
          Number.isFinite(parsedVariantWeight) &&
          parsedVariantWeight > 0
            ? parsedVariantWeight
            : null,
        packageLengthCm: parseDimension(variant.packageLengthCm),
        packageWidthCm: parseDimension(variant.packageWidthCm),
        packageHeightCm: parseDimension(variant.packageHeightCm),
        shippingMode: variant.shippingMode || null,
      };
    });
    const invalidDimensionVariantIndex = variants.findIndex((variant, index) => {
      const raw = [variant.packageLengthCm, variant.packageWidthCm, variant.packageHeightCm];
      const normalized = normalizedVariants[index];
      return raw.some((value) => value.trim() !== "") &&
        [normalized.packageLengthCm, normalized.packageWidthCm, normalized.packageHeightCm].some((value) => value === null);
    });
    if (invalidDimensionVariantIndex >= 0) {
      setError(`Variante ${variants[invalidDimensionVariantIndex].code} : renseignez les 3 dimensions du colis, ou laissez-les vides pour hériter du produit.`);
      return;
    }

    const invalidMessagerieVariant = normalizedVariants.find(
      (variant) =>
        variant.shippingMode === "MESSAGERIE" &&
        variant.weightKg === null &&
        normalizedWeight === null,
    );
    if (invalidMessagerieVariant) {
      setError(
        "Une variante en messagerie doit avoir un poids propre ou hériter du poids produit.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const response = await fetch(
        `/api/admin/catalogue/${encodeURIComponent(product.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weightKg: normalizedWeight,
            packageLengthCm: normalizedPackageLengthCm,
            packageWidthCm: normalizedPackageWidthCm,
            packageHeightCm: normalizedPackageHeightCm,
            shippingMode,
            leadTime: leadTime.trim() || null,
            publicationStatus:
              status === "Publié"
                ? "PUBLISHED"
                : status === "Masqué"
                  ? "HIDDEN"
                  : "DRAFT",
            variants: normalizedVariants,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Enregistrement impossible.");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  };
  const uploadImages = async (files: FileList | null) => {
    if (!files?.length || mode !== "edit") return;

    const selected = Array.from(files);
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const invalidType = selected.find((file) => !allowedTypes.has(file.type));
    if (invalidType) {
      setError(`${invalidType.name} n’est pas une image JPG, PNG ou WEBP.`);
      return;
    }
    const tooLarge = selected.find((file) => file.size > 10 * 1024 * 1024);
    if (tooLarge) {
      setError(`${tooLarge.name} dépasse la limite de 10 Mo.`);
      return;
    }

    setUploadingImages(true);
    setError("");
    try {
      const nextUrls: string[] = [];
      const safeCode = product.code.replace(/[^a-zA-Z0-9_-]+/g, "-");
      for (const file of selected) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
        const blob = await upload(`products/${safeCode}/${safeName}`, file, {
          access: "public",
          handleUploadUrl: `/api/admin/catalogue/${encodeURIComponent(product.id)}/media/upload`,
          clientPayload: JSON.stringify({ productId: product.id }),
          multipart: file.size > 4 * 1024 * 1024,
        });

        const registerResponse = await fetch(
          `/api/admin/catalogue/${encodeURIComponent(product.id)}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: blob.url }),
          },
        );
        const registerPayload = await registerResponse.json().catch(() => ({}));
        if (!registerResponse.ok) {
          throw new Error(
            registerPayload.error || `Impossible d’enregistrer ${file.name}.`,
          );
        }
        nextUrls.push(blob.url);
      }

      setMediaImages((current) => [...current, ...nextUrls.filter((url) => !current.includes(url))]);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Impossible d’ajouter l’image.",
      );
    } finally {
      setUploadingImages(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const deleteImage = async (url: string) => {
    if (mode !== "edit") return;
    setDeletingImage(url);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/catalogue/${encodeURIComponent(product.id)}/media`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Suppression de l’image impossible.");
      setMediaImages((current) => current.filter((image) => image !== url));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Suppression de l’image impossible.",
      );
    } finally {
      setDeletingImage(null);
    }
  };

  const deleteProduct = async () => {
    if (mode !== "edit") return;
    if (deleteConfirm.trim() !== product.code.trim()) {
      setError(`Tapez exactement ${product.code} pour confirmer la suppression.`);
      return;
    }

    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/catalogue/${encodeURIComponent(product.id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Suppression impossible.");
      window.location.href = "/admin/catalogue";
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    } finally {
      setDeleting(false);
    }
  };

  const field =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-900/5";

  return (
    <main className="mx-auto w-full max-w-[1500px] p-4 md:p-7 xl:p-9">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link
            href="/admin/catalogue"
            className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={16} /> Retour au catalogue
          </Link>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">
            Administration produit
          </p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">
            {mode === "create" ? "Créer un produit" : product.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === "create"
              ? "Ajoutez une nouvelle référence au catalogue OYSTE."
              : `${product.code} · ${product.categoryPath || "Catégorie non renseignée"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as AdminCatalogueProduct["status"])
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black outline-none"
          >
            <option>Publié</option>
            <option>Brouillon</option>
            <option>Masqué</option>
          </select>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white shadow-lg shadow-cyan-900/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saved ? <Check size={17} /> : <Save size={17} />}
            {saving
              ? "Enregistrement…"
              : saved
                ? "Modifications enregistrées"
                : "Enregistrer"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {mode === "edit" ? (
        <details className="mt-5 rounded-2xl border border-red-200 bg-red-50/60">
          <summary className="cursor-pointer px-5 py-4 text-xs font-black text-red-800">
            Zone sensible · supprimer ce produit
          </summary>
          <div className="border-t border-red-200 p-5">
            <p className="text-xs font-bold leading-5 text-red-700">
              La suppression est définitive. Elle est automatiquement refusée si ce produit apparaît dans une commande.
              Tapez la référence <span className="font-black">{product.code}</span> pour confirmer.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder={`Taper ${product.code}`}
                className="min-w-0 flex-1 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold outline-none"
              />
              <button
                type="button"
                onClick={() => void deleteProduct()}
                disabled={deleting || deleteConfirm.trim() !== product.code.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40"
              >
                <Trash2 size={16} /> {deleting ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </details>
      ) : null}

      <div className="mt-7 overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`rounded-xl px-4 py-3 text-xs font-black transition ${active === tab ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          {active === "Informations" && (
            <div>
              <h2 className="text-xl font-black">Informations générales</h2>
              <p className="mt-1 text-sm text-slate-500">
                Les données principales visibles dans les listes et sur la fiche
                produit.
              </p>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="text-xs font-black text-slate-600 md:col-span-2">
                  Nom du produit
                  <input
                    defaultValue={product.name}
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="text-xs font-black text-slate-600">
                  Référence
                  <input
                    defaultValue={product.code}
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="text-xs font-black text-slate-600">
                  Fabricant
                  <input
                    defaultValue={product.manufacturer}
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="text-xs font-black text-slate-600 md:col-span-2">
                  Catégorie
                  <div className="relative mt-2">
                    <Search
                      size={17}
                      className="absolute left-4 top-3.5 text-slate-400"
                    />
                    <input
                      defaultValue={product.categoryPath}
                      className={`${field} pl-11`}
                    />
                  </div>
                </label>
                <label className="text-xs font-black text-slate-600">
                  Prix HT
                  <input
                    defaultValue={product.priceHT ?? ""}
                    type="number"
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="text-xs font-black text-slate-600">
                  Délai
                  <input
                    value={leadTime}
                    onChange={(event) => setLeadTime(event.target.value)}
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="text-xs font-black text-slate-600">
                  Stock
                  <input
                    defaultValue={product.stock ?? ""}
                    type="number"
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="text-xs font-black text-slate-600">
                  Poids unitaire (kg)
                  <input
                    value={weightKg}
                    onChange={(event) => setWeightKg(event.target.value)}
                    min="0"
                    step="0.001"
                    type="number"
                    placeholder="Ex. 57"
                    className={`${field} mt-2`}
                  />
                  <span className="mt-2 block text-[11px] font-bold leading-5 text-slate-400">
                    Utilisé pour calculer automatiquement le transport selon la
                    quantité.
                  </span>
                </label>
                <div className="md:col-span-2">
                  <p className="text-xs font-black text-slate-600">Dimensions du colis Sendcloud (cm)</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input
                      value={packageLengthCm}
                      onChange={(event) => setPackageLengthCm(event.target.value)}
                      min="0"
                      step="0.1"
                      type="number"
                      placeholder="Longueur"
                      aria-label="Longueur du colis en centimètres"
                      className={field}
                    />
                    <input
                      value={packageWidthCm}
                      onChange={(event) => setPackageWidthCm(event.target.value)}
                      min="0"
                      step="0.1"
                      type="number"
                      placeholder="Largeur"
                      aria-label="Largeur du colis en centimètres"
                      className={field}
                    />
                    <input
                      value={packageHeightCm}
                      onChange={(event) => setPackageHeightCm(event.target.value)}
                      min="0"
                      step="0.1"
                      type="number"
                      placeholder="Hauteur"
                      aria-label="Hauteur du colis en centimètres"
                      className={field}
                    />
                  </div>
                  <span className="mt-2 block text-[11px] font-bold leading-5 text-slate-400">
                    Pour un produit « Sur devis », poids + L × l × H permettent à Sendcloud de proposer automatiquement un vrai tarif colis. Aucune dimension fictive n’est utilisée.
                  </span>
                </div>
                <label className="text-xs font-black text-slate-600">
                  Mode de livraison
                  <select
                    value={shippingMode}
                    onChange={(event) =>
                      setShippingMode(event.target.value as typeof shippingMode)
                    }
                    className={`${field} mt-2`}
                  >
                    <option value="INCLUDED">Livraison incluse</option>
                    <option value="MESSAGERIE">Messagerie</option>
                    <option value="AFFRETEMENT">Affrètement</option>
                    <option value="QUOTE">Sur devis</option>
                  </select>
                  <span className="mt-2 block text-[11px] font-bold leading-5 text-slate-400">
                    La messagerie exige un poids. L’affrètement et le devis
                    restent confirmés selon la destination.
                  </span>
                </label>
                <label className="text-xs font-black text-slate-600">
                  Ordre d’affichage
                  <input
                    defaultValue="100"
                    type="number"
                    className={`${field} mt-2`}
                  />
                </label>
              </div>
              {variants.length ? (
                <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-950">
                        Variantes produit
                      </h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        Laissez vide pour hériter du produit principal, ou
                        définissez une règle spécifique.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                      {variants.length}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {variants.map((variant, index) => {
                      const databaseVariant = product.variants?.find(
                        (item) => item.id === variant.id,
                      );
                      const stockmanTarget = product.stockmanSyncTargets.find(
                        (target) =>
                          target.targetType === "variant" &&
                          target.targetId === variant.id,
                      );
                      const stockValue =
                        stockmanTarget?.stock ?? databaseVariant?.stock ?? null;
                      const purchasePrice =
                        stockmanTarget?.purchasePriceExVat ?? null;
                      const salePrice = databaseVariant?.priceHT ?? null;
                      const sourceWeight =
                        stockmanTarget?.weightKg ??
                        databaseVariant?.weightKg ??
                        null;
                      const isStockman = product.manufacturer.toUpperCase() === "STOCKMAN";
                      const hasCommercialLink = Boolean(stockmanTarget);

                      return (
                        <div
                          key={variant.id}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="grid gap-4 xl:grid-cols-[minmax(220px,1.1fr)_minmax(320px,1.5fr)_150px_minmax(280px,1.2fr)_190px] xl:items-start">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-black text-slate-950">
                                  {variant.name}
                                </p>
                                {isStockman ? (
                                  <span
                                    className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${
                                      hasCommercialLink
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-amber-50 text-amber-700"
                                    }`}
                                  >
                                    {hasCommercialLink ? "Stockman lié ✓" : "Stockman à contrôler"}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs font-bold text-slate-500">
                                {variant.code}
                              </p>
                              {stockmanTarget?.syncedAt ? (
                                <p className="mt-2 text-[10px] font-bold text-slate-400">
                                  Dernière synchro :{" "}
                                  {new Date(stockmanTarget.syncedAt).toLocaleString("fr-FR")}
                                </p>
                              ) : isStockman && hasCommercialLink ? (
                                <p className="mt-2 text-[10px] font-bold text-slate-400">
                                  Données issues du rebuild intranet Stockman
                                </p>
                              ) : null}
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                                  Achat HT
                                </p>
                                <p className="mt-1 text-sm font-black text-slate-950">
                                  {formatAdminCurrency(purchasePrice)}
                                </p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                                  Stock
                                </p>
                                <p
                                  className={`mt-1 text-sm font-black ${
                                    stockValue !== null && stockValue > 0
                                      ? "text-emerald-700"
                                      : "text-red-600"
                                  }`}
                                >
                                  {stockValue === null ? "—" : stockValue}
                                </p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                                  Vente HT
                                </p>
                                <p className="mt-1 text-sm font-black text-slate-950">
                                  {formatAdminCurrency(salePrice)}
                                </p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                                  Poids source
                                </p>
                                <p className="mt-1 text-sm font-black text-slate-950">
                                  {formatAdminNumber(sourceWeight, " kg")}
                                </p>
                              </div>
                            </div>

                            <label className="text-[11px] font-black text-slate-600">
                              Poids propre (kg)
                              <input
                                value={variant.weightKg}
                                onChange={(event) =>
                                  setVariants((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, weightKg: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                min="0"
                                step="0.001"
                                type="number"
                                placeholder={weightKg || "Hérité"}
                                className={`${field} mt-2 py-2.5`}
                              />
                            </label>

                            <div>
                              <p className="text-[11px] font-black text-slate-600">Dimensions colis propres (cm)</p>
                              <div className="mt-2 grid grid-cols-3 gap-1.5">
                                {[
                                  ["packageLengthCm", "L"],
                                  ["packageWidthCm", "l"],
                                  ["packageHeightCm", "H"],
                                ].map(([key, label]) => (
                                  <input
                                    key={key}
                                    value={variant[key as "packageLengthCm" | "packageWidthCm" | "packageHeightCm"]}
                                    onChange={(event) =>
                                      setVariants((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, [key]: event.target.value }
                                            : item,
                                        ),
                                      )
                                    }
                                    min="0"
                                    step="0.1"
                                    type="number"
                                    placeholder={
                                      key === "packageLengthCm"
                                        ? packageLengthCm || label
                                        : key === "packageWidthCm"
                                          ? packageWidthCm || label
                                          : packageHeightCm || label
                                    }
                                    aria-label={`${label} du colis de ${variant.code}`}
                                    className={`${field} py-2.5 px-2`}
                                  />
                                ))}
                              </div>
                              <p className="mt-1 text-[9px] font-bold text-slate-400">Vide = hérite du produit</p>
                            </div>

                            <label className="text-[11px] font-black text-slate-600">
                              Mode propre
                              <select
                                value={variant.shippingMode}
                                onChange={(event) =>
                                  setVariants((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            shippingMode: event.target.value,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                className={`${field} mt-2 py-2.5`}
                              >
                                <option value="">Hériter du produit</option>
                                <option value="INCLUDED">Livraison incluse</option>
                                <option value="MESSAGERIE">Messagerie</option>
                                <option value="AFFRETEMENT">Affrètement</option>
                                <option value="QUOTE">Sur devis</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
          {active === "Parcours produit" && (
            <div>
              <h2 className="text-xl font-black">Parcours e-commerce</h2>
              <p className="mt-1 text-sm text-slate-500">
                Définissez si la fiche vend directement le produit ou ouvre le
                configurateur OYSTE.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setExperienceType("STANDARD")}
                  className={`rounded-2xl border p-5 text-left transition ${experienceType === "STANDARD" ? "border-[#007f8f] bg-cyan-50 ring-2 ring-cyan-100" : "border-slate-200"}`}
                >
                  <p className="text-sm font-black text-slate-950">
                    📦 Produit standard
                  </p>
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                    La fiche affiche le prix, les variantes et le bouton Ajouter
                    au panier.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setExperienceType("CONFIGURABLE")}
                  className={`rounded-2xl border p-5 text-left transition ${experienceType === "CONFIGURABLE" ? "border-orange-500 bg-orange-50 ring-2 ring-orange-100" : "border-slate-200"}`}
                >
                  <p className="text-sm font-black text-slate-950">
                    ⚙️ Produit configurable
                  </p>
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                    La fiche devient une page SEO et son CTA ouvre le
                    configurateur avec la bonne famille.
                  </p>
                </button>
              </div>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="text-xs font-black text-slate-600">
                  Type de fiche
                  <input
                    value={
                      experienceType === "CONFIGURABLE"
                        ? "Configurable"
                        : "Standard"
                    }
                    readOnly
                    className={`${field} mt-2 bg-slate-50`}
                  />
                </label>
                <label className="text-xs font-black text-slate-600">
                  Famille configurateur
                  <select
                    defaultValue={product.configuratorFamily || ""}
                    disabled={experienceType !== "CONFIGURABLE"}
                    className={`${field} mt-2 disabled:bg-slate-100 disabled:text-slate-400`}
                  >
                    <option value="">Sélectionner une famille</option>
                    {["PFI", "PFT", "PMI", "PMT", "PMA", "PMAM", "PORT"].map(
                      (family) => (
                        <option key={family}>{family}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="text-xs font-black text-slate-600 md:col-span-2">
                  Badges marketing
                  <input
                    defaultValue={product.marketingBadges?.join(", ") || ""}
                    placeholder="Nouveau, Bestseller, Sur mesure…"
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="text-xs font-black text-slate-600 md:col-span-2">
                  Produits associés
                  <input
                    defaultValue={product.relatedProductCodes?.join(", ") || ""}
                    placeholder="Références séparées par des virgules"
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="text-xs font-black text-slate-600 md:col-span-2">
                  Accessoires compatibles
                  <input
                    defaultValue={
                      product.accessoryProductCodes?.join(", ") || ""
                    }
                    placeholder="Références séparées par des virgules"
                    className={`${field} mt-2`}
                  />
                </label>
              </div>
              <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">
                  Règle d’enrichissement
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                  Les données importées ERP et Oxatis restent intactes. Cette
                  couche admin ajoute uniquement le comportement e-commerce et
                  le contenu marketing.
                </p>
              </div>
            </div>
          )}
          {active === "Description" && (
            <div>
              <h2 className="text-xl font-black">Contenus de la fiche</h2>
              <p className="mt-1 text-sm text-slate-500">
                Modifiez les textes sans intervenir dans le code du site.
              </p>
              <div className="mt-6 space-y-5">
                <label className="block text-xs font-black text-slate-600">
                  Description courte
                  <textarea
                    defaultValue={product.seoDescription || product.description}
                    rows={4}
                    className={`${field} mt-2 resize-y`}
                  />
                </label>
                <div className="block text-xs font-black text-slate-600">
                  Description détaillée
                  <div className="mt-2 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                    B &nbsp; I &nbsp; U &nbsp; • Liste &nbsp; H2 &nbsp; Lien
                  </div>
                  <StructuredDescriptionEditor
                    value={product.detailedDescription}
                  />
                </div>
                <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black">
                  <Plus size={16} /> Ajouter un bloc éditorial
                </button>
              </div>
            </div>
          )}
          {active === "Médias" && (
            <div>
              <h2 className="text-xl font-black">Photos et galerie</h2>
              <p className="mt-1 text-sm text-slate-500">
                La première image est utilisée comme visuel principal.
              </p>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => void uploadImages(event.target.files)}
              />
              <button
                type="button"
                disabled={uploadingImages || mode !== "edit"}
                onClick={() => imageInputRef.current?.click()}
                className="mt-6 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center transition hover:border-[#007f8f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UploadCloud size={28} className="text-[#007f8f]" />
                <span className="mt-3 text-sm font-black">
                  {uploadingImages ? "Upload en cours…" : "Déposer des images ou parcourir"}
                </span>
                <span className="mt-1 text-xs text-slate-400">
                  JPG, PNG ou WEBP · 10 Mo maximum par image
                </span>
              </button>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mediaImages.length ? (
                  mediaImages.map((image, index) => (
                    <article
                      key={image}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      <div className="aspect-square p-4">
                        <img
                          src={image}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 bg-white p-3">
                        <span className="inline-flex items-center gap-2 text-[10px] font-black">
                          <GripVertical size={14} />
                          {index === 0
                            ? "Image principale"
                            : `Image ${index + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteImage(image)}
                          disabled={deletingImage === image}
                          title="Supprimer cette image"
                          className="text-slate-400 hover:text-red-600 disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="col-span-full rounded-2xl border border-slate-200 p-8 text-center">
                    <ImagePlus className="mx-auto text-slate-300" />
                    <p className="mt-2 text-sm font-black">Aucune image</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {active === "Fiches techniques" && (
            <div>
              <h2 className="text-xl font-black">Documents téléchargeables</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fiches techniques, notices, certificats et plans d’encombrement.
              </p>
              <button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white">
                <FileText size={17} /> Ajouter un document
              </button>
              <div className="mt-5 space-y-3">
                {[
                  "Fiche technique",
                  "Notice d’installation",
                  "Plan d’encombrement",
                ]
                  .slice(0, Math.max(1, product.documentCount))
                  .map((name, index) => (
                    <article
                      key={name}
                      className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <input
                          defaultValue={`${name} ${product.code || "nouveau produit"}`}
                          className="w-full truncate bg-transparent text-sm font-black outline-none"
                        />
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          PDF · Visible sur la fiche produit
                        </p>
                      </div>
                      <button className="text-slate-400">
                        <Trash2 size={17} />
                      </button>
                    </article>
                  ))}
              </div>
            </div>
          )}
          {active === "Caractéristiques" && (
            <div>
              <h2 className="text-xl font-black">
                Caractéristiques techniques
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ces informations alimentent le tableau technique de la fiche
                produit.
              </p>
              <div className="mt-6 space-y-3">
                {(product.features?.length
                  ? product.features
                  : [
                      { label: "Capacité", value: "" },
                      { label: "Dimensions", value: "" },
                    ]
                ).map((feature, index) => (
                  <div
                    key={`${feature.label}-${index}`}
                    className="grid gap-3 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[1fr_1.5fr_auto]"
                  >
                    <input
                      defaultValue={feature.label}
                      placeholder="Libellé"
                      className={field}
                    />
                    <input
                      defaultValue={feature.value}
                      placeholder="Valeur"
                      className={field}
                    />
                    <button className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black">
                <Plus size={16} /> Ajouter une caractéristique
              </button>
            </div>
          )}
          {active === "SEO" && (
            <div>
              <h2 className="text-xl font-black">Référencement naturel</h2>
              <p className="mt-1 text-sm text-slate-500">
                Contrôlez l’apparence de la page dans Google.
              </p>
              <div className="mt-6 space-y-5">
                <label className="block text-xs font-black text-slate-600">
                  URL de la page
                  <div className="mt-2 flex rounded-xl border border-slate-200">
                    <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-xs text-slate-400">
                      /catalogue/…/
                    </span>
                    <input
                      defaultValue={product.slug}
                      className="min-w-0 flex-1 rounded-r-xl px-3 py-3 text-sm outline-none"
                    />
                  </div>
                </label>
                <label className="block text-xs font-black text-slate-600">
                  Titre SEO
                  <input
                    defaultValue={product.seoTitle || `${product.name} | OYSTE`}
                    className={`${field} mt-2`}
                  />
                  <span className="mt-1 block text-right text-[10px] text-slate-400">
                    {(product.seoTitle || `${product.name} | OYSTE`).length} / 60
                  </span>
                </label>
                <label className="block text-xs font-black text-slate-600">
                  Meta description
                  <textarea
                    defaultValue={product.description}
                    rows={4}
                    className={`${field} mt-2`}
                  />
                </label>
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-black text-slate-400">
                    Aperçu Google
                  </p>
                  <p className="mt-4 text-lg text-blue-700">
                    {product.seoTitle || `${product.name || "Nom du nouveau produit"} | OYSTE`}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    oyste.fr › catalogue › {product.slug || "nouveau-produit"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {product.seoDescription || product.description ||
                      "La description SEO de votre produit apparaîtra ici."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          {mode === "edit" ? (
            <StockmanProductSyncAssistant
              productId={product.id}
              initialTargets={product.stockmanSyncTargets || []}
            />
          ) : null}
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black">État de la fiche</h3>
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-black">
                  <span>Complétude</span>
                  <span>{product.completeness || 20}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#007f8f]"
                    style={{ width: `${product.completeness || 20}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2 text-xs font-bold text-slate-500">
                {[
                  {
                    label: "Informations générales",
                    done: Boolean(product.name && product.code),
                  },
                  {
                    label: "Prix et disponibilité",
                    done: product.priceHT !== null && product.stock !== null,
                  },
                  { label: "Description", done: Boolean(product.description) },
                  {
                    label: "Image principale",
                    done: Boolean(mediaImages.length),
                  },
                  {
                    label: "Référencement",
                    done: Boolean(product.slug && product.description),
                  },
                ].map((item) => (
                  <p key={item.label} className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${item.done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
                    >
                      {item.done ? <Check size={12} /> : "·"}
                    </span>
                    {item.label}
                  </p>
                ))}
              </div>
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black">Visibilité</h3>
            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Visible sur le site</span>
                <input
                  type="checkbox"
                  defaultChecked={status === "Publié"}
                  className="h-4 w-4 accent-[#007f8f]"
                />
              </label>
              <label className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Disponible à la vente</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 accent-[#007f8f]"
                />
              </label>
              <label className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Mis en avant</span>
                <input type="checkbox" className="h-4 w-4 accent-[#007f8f]" />
              </label>
            </div>
          </section>
          <section className="rounded-[1.5rem] bg-[#07131f] p-5 text-white shadow-sm">
            <Link2 size={20} className="text-cyan-300" />
            <h3 className="mt-4 text-sm font-black">Aperçu boutique</h3>
            <p className="mt-2 text-xs leading-5 text-white/55">
              Contrôlez le rendu public avant de publier vos modifications.
            </p>
            {mode === "edit" && status === "Publié" && product.href ? (
              <Link
                href={product.href}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-xs font-black text-slate-950 transition hover:bg-cyan-50"
              >
                Voir la fiche produit
              </Link>
            ) : (
              <div
                className="mt-4 w-full cursor-not-allowed rounded-xl bg-white/60 px-4 py-3 text-center text-xs font-black text-white/50"
                title="Publiez et enregistrez la fiche pour ouvrir son aperçu boutique."
              >
                Voir la fiche produit
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
