import { ArrowRight, Download, FileText, ShieldCheck } from "lucide-react";
import type { ProductDocument } from "@/lib/catalogue/repository";

function getDocumentPill(document: ProductDocument) {
  if (document.status === "available") return document.filetype ? document.filetype.toUpperCase() : "PDF";
  return "Sur demande";
}

function getDocumentIdentity(document: ProductDocument) {
  const reference = document.reference || document.filename?.split(/[\\/]/).pop()?.replace(/\.[a-z0-9]+$/i, "");

  return {
    title: document.title || "Fiche technique",
    displayName: document.displayName,
    reference,
    filetype: document.filetype ? document.filetype.toUpperCase() : "PDF",
  };
}

export default function ProductDocuments({
  documents,
  availableDocumentCount,
  productName,
}: {
  documents: ProductDocument[];
  availableDocumentCount: number;
  productName: string;
}) {
  const visibleDocuments = documents.filter((document) => document.isVisible !== false);
  const availableDocuments = visibleDocuments.filter((document) => document.status === "available");
  const requestDocuments = visibleDocuments.filter((document) => document.status !== "available");
  const primaryDocument = availableDocuments[0];
  const primaryIdentity = primaryDocument ? getDocumentIdentity(primaryDocument) : null;
  const secondaryAvailableDocuments = availableDocuments.slice(1);

  return (
    <section id="documents-techniques" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]">
              <FileText size={23} />
            </span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">Documents techniques</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Documentation du produit</h2>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            Retrouvez au même endroit les fiches techniques, notices, plans et documents de conformité disponibles pour ce produit.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableDocumentCount > 0 ? (
            <span className="rounded-full bg-[#007f8f]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#005466]">
              {availableDocumentCount} document{availableDocumentCount > 1 ? "s" : ""} disponible{availableDocumentCount > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Sur demande
            </span>
          )}
        </div>
      </div>

      {primaryDocument ? (
        <a
          href={primaryDocument.href}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex flex-col gap-4 rounded-[1.5rem] border border-[#007f8f]/20 bg-[#007f8f]/5 p-5 transition hover:border-[#007f8f]/40 hover:bg-[#007f8f]/10 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#007f8f] shadow-sm">
              <Download size={20} />
            </span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#005466]">{primaryIdentity?.filetype || "PDF"}</p>
              <p className="mt-1 text-lg font-black text-slate-950">{primaryIdentity?.title}</p>
              {primaryIdentity?.displayName ? (
                <p className="mt-2 text-sm font-black leading-6 text-slate-700">{primaryIdentity.displayName}</p>
              ) : null}
              {primaryIdentity?.reference ? (
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">Réf. : {primaryIdentity.reference}</p>
              ) : null}
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-black text-[#007f8f]">
            Télécharger <ArrowRight size={17} />
          </span>
        </a>
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 shrink-0 text-slate-500" size={22} />
            <div>
              <p className="text-sm font-black text-slate-950">Fiche technique disponible sur demande</p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                La documentation technique de {productName} peut être transmise avec l'offre ou sur demande.
              </p>
            </div>
          </div>
        </div>
      )}

      {secondaryAvailableDocuments.length > 0 || requestDocuments.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {secondaryAvailableDocuments.map((document) => {
            const identity = getDocumentIdentity(document);

            return (
              <a
                key={`${document.title}-${document.href}`}
                href={document.href}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-[#007f8f]/30 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <FileText size={19} className="mt-0.5 shrink-0 text-[#007f8f]" />
                    <div>
                      <span className="block font-black text-slate-950 group-hover:text-[#005466]">{identity.title}</span>
                      {identity.displayName ? (
                        <span className="mt-1 block text-xs font-black leading-5 text-slate-600">{identity.displayName}</span>
                      ) : null}
                      {identity.reference ? (
                        <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">Réf. : {identity.reference}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    {getDocumentPill(document)}
                  </span>
                </div>
              </a>
            );
          })}

          {requestDocuments.map((document) => (
            <a
              key={`${document.title}-${document.href}`}
              href={document.href}
              className="group rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-orange-200 hover:bg-orange-50/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileText size={19} className="mt-0.5 shrink-0 text-orange-600" />
                  <div>
                    <span className="block font-black text-slate-950">{document.title}</span>
                    <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">{document.description}</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {getDocumentPill(document)}
                </span>
              </div>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
