import { User } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import Container from "@/components/ui/Container";
import TopBar from "./TopBar";
import CartLink from "@/components/cart/CartLink";
import SearchBar from "@/components/catalogue/SearchBar";
import { getCmsContent } from "@/lib/cms";



export default async function Header() {
  const [customer, cms] = await Promise.all([getCurrentCustomer(), getCmsContent()]);
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
            {cms.navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group flex items-center gap-1.5 whitespace-nowrap transition hover:text-[#007f8f]"
              >
                {item.label}
                
              </a>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <SearchBar compact />

            <a href={customer ? "/compte" : "/connexion"} aria-label={customer ? "Mon espace professionnel" : "Se connecter"} className="hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition hover:border-[#007f8f] hover:text-[#007f8f] md:flex">
              <User size={19} />
            </a>

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
