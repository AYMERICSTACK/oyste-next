import { getEditorialPage, editorialIcon } from "@/lib/editorial";
import { ChevronDown, Menu, User } from "lucide-react";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/auth/session";
import Container from "@/components/ui/Container";
import TopBar from "./TopBar";
import CartLink from "@/components/cart/CartLink";
import SearchBar from "@/components/catalogue/SearchBar";
import { getCmsContent } from "@/lib/cms";
import { catalogueSubFamilies } from "@/lib/catalogue/repository";

export default async function Header() {
 const page=await getEditorialPage("header");

  const [customer, cms] = await Promise.all([getCurrentCustomer(), getCmsContent()]);
  return (
    <>
      <TopBar />

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <Container className="flex h-20 items-center gap-8">
          <Link href={page.fields.content001} className="flex shrink-0 items-center">
            <img
              src={page.fields.content002}
              alt={page.fields.content003}
              className="h-13 w-auto object-contain"
            />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-3 text-[12px] font-black uppercase tracking-tight text-slate-950 xl:flex">
            {cms.navigation.filter((item) => !["/catalogue/stockage-emballage", "/catalogue/acces-hauteur"].includes(item.href)).map((item) => {
              const configuredEntries = page.collections.megaMenus.filter(entry=>entry.enabled && entry.parent===item.href).sort((a,b)=>a.order-b.order).map(entry=>[entry.label, entry.parent === "/catalogue/levage" && entry.label === "Potences" ? "/catalogue/levage?famille=potences" : entry.href]);
              const entries = item.href === "/catalogue/motorisation-sew" && configuredEntries.length === 0
                ? (catalogueSubFamilies["motorisation-sew"] || []).map((family) => [family.title, family.href])
                : configuredEntries;
              return (
                <div key={item.href} className="group/nav relative py-7">
                  <a href={item.href} className="flex items-center gap-1.5 whitespace-nowrap transition hover:text-[#007f8f]">
                    {item.label}{entries.length ? <ChevronDown size={13} /> : null}
                  </a>
                  {entries.length ? (
                    <div className="invisible absolute left-1/2 top-full w-[420px] -translate-x-1/2 translate-y-2 rounded-2xl border border-slate-200 bg-white p-3 opacity-0 shadow-2xl transition group-hover/nav:visible group-hover/nav:translate-y-0 group-hover/nav:opacity-100">
                      <div className="grid grid-cols-2 gap-1.5">
                        {entries.map(([label, href]) => (
                          <a key={label} href={href} className="rounded-xl px-4 py-3 text-left normal-case tracking-normal transition hover:bg-slate-50 hover:text-[#007f8f]">
                            <strong className="block text-sm">{label}</strong>
                            <span className="mt-1 block text-[11px] font-semibold text-slate-500">{page.fields.content004}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Link href="/configurateur" className="shrink-0 whitespace-nowrap rounded-lg bg-[#007f8f] px-3 py-2.5 text-white hover:bg-[#005f70]">Configurateur potence</Link>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <SearchBar compact />

            <a href={customer ? "/compte" : "/connexion"} aria-label={customer ? "Mon espace professionnel" : "Se connecter"} className="hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition hover:border-[#007f8f] hover:text-[#007f8f] md:flex">
              <User size={19} />
            </a>

            <CartLink />

            <details className="relative xl:hidden">
              <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200" aria-label="Ouvrir le menu"><Menu size={20} /></summary>
              <nav className="absolute right-0 top-14 w-[min(88vw,360px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                <Link href="/configurateur" className="block rounded-xl bg-[#007f8f] px-4 py-3 text-sm font-black text-white">Configurateur potence</Link>
                {cms.navigation.filter((item) => !["/catalogue/stockage-emballage", "/catalogue/acces-hauteur"].includes(item.href)).map((item) => <a key={item.href} href={item.href} className="block rounded-xl px-4 py-3 text-sm font-black text-slate-900 hover:bg-slate-50">{item.label}</a>)}
              </nav>
            </details>
          </div>
        </Container>
      </header>
    </>
  );
}
