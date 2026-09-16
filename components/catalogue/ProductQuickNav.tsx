"use client";

import {
  FileText,
  HelpCircle,
  ImageIcon,
  Info,
  ListChecks,
  PackageSearch,
} from "lucide-react";

const items = [
  { href: "#galerie-produit", label: "Galerie", icon: ImageIcon },
  { href: "#presentation-produit", label: "Présentation", icon: Info },
  { href: "#caracteristiques-techniques", label: "Caractéristiques", icon: ListChecks },
  { href: "#documents-techniques", label: "Documents", icon: FileText },
  { href: "#faq-produit", label: "FAQ", icon: HelpCircle },
  { href: "#produits-associes", label: "Produits associés", icon: PackageSearch },
];

export default function ProductQuickNav({
  showFaq = true,
  showProducts = true,
}: {
  showFaq?: boolean;
  showProducts?: boolean;
}) {
  const visibleItems = items.filter((item) => {
    if (item.href === "#faq-produit") return showFaq;
    if (item.href === "#produits-associes") return showProducts;
    return true;
  });

  function goTo(hash: string) {
    const element = document.querySelector(hash);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", hash);
  }

  return (
    <>
      <nav
        aria-label="Navigation rapide de la fiche produit"
        className="sticky top-[72px] z-30 -mx-1 mb-6 overflow-x-auto px-1 lg:hidden"
      >
        <div className="flex min-w-max gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
          {visibleItems.map(({ href, label, icon: Icon }) => (
            <button
              key={href}
              type="button"
              onClick={() => goTo(href)}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 hover:text-[#005466]"
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <nav
        aria-label="Navigation rapide de la fiche produit"
        className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 xl:block"
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
          <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Accès rapide
          </p>
          <div className="grid gap-1">
            {visibleItems.map(({ href, label, icon: Icon }) => (
              <button
                key={href}
                type="button"
                onClick={() => goTo(href)}
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-black text-slate-600 transition hover:bg-[#007f8f]/10 hover:text-[#005466]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-white group-hover:text-[#007f8f]">
                  <Icon size={16} />
                </span>
                <span className="max-w-[126px] leading-4">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
