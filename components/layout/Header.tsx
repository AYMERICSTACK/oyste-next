import { ChevronDown, User } from "lucide-react";
import Container from "@/components/ui/Container";
import TopBar from "./TopBar";
import CartLink from "@/components/cart/CartLink";
import SearchBar from "@/components/catalogue/SearchBar";

const navItems = [
  { label: "Levage", href: "/catalogue/levage", dropdown: true },
  { label: "Manutention", href: "/catalogue/manutention-au-sol", dropdown: true },
  { label: "Motorisation SEW", href: "/catalogue/motorisation-sew", dropdown: true },
  { label: "Stockage", href: "/catalogue/stockage-emballage", dropdown: true },
  { label: "Accès hauteur", href: "/catalogue/acces-hauteur", dropdown: true },
  { label: "Services", href: "/services", dropdown: true },
  { label: "Réalisations", href: "/realisations", dropdown: false },
  { label: "Contact", href: "/contact", dropdown: false },
];

export default function Header() {
  return (
    <>
      <TopBar />

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <Container className="flex h-24 items-center gap-10">
          <a href="/" className="flex shrink-0 items-center">
            <img
              src="/logos/oyste-logo.png"
              alt="OYSTE"
              className="h-16 w-auto object-contain"
            />
          </a>

          <nav className="hidden flex-1 items-center justify-center gap-7 text-[13px] font-black uppercase tracking-tight text-slate-950 xl:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group flex items-center gap-1.5 whitespace-nowrap transition hover:text-[#007f8f]"
              >
                {item.label}
                {item.dropdown && (
                  <ChevronDown
                    size={14}
                    strokeWidth={3}
                    className="transition group-hover:translate-y-0.5"
                  />
                )}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <SearchBar compact />

            <button className="hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition hover:border-[#007f8f] hover:text-[#007f8f] md:flex">
              <User size={19} />
            </button>

            <CartLink />

            <a
              href="/configurateur"
              className="hidden items-center gap-2 rounded-xl bg-orange-600 px-5 py-3.5 text-xs font-black uppercase text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 lg:flex"
            >
              Configurateur
            </a>
          </div>
        </Container>
      </header>
    </>
  );
}
