import Container from "@/components/ui/Container";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-white">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <img
            src="/logos/oyste-logo.png"
            alt="OYSTE"
            className="h-14 w-auto brightness-0 invert"
          />
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
            Solutions de levage, manutention, motorisation et équipements
            industriels pour accompagner vos projets d’atelier.
          </p>
        </div>

        <div>
          <p className="font-black uppercase text-white">Univers</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-400">
            <a href="/catalogue/levage">Levage</a>
            <a href="/catalogue/manutention-au-sol">Manutention</a>
            <a href="/catalogue/motorisation-sew">Motorisation SEW</a>
            <a href="/catalogue/accessoires-pieces">Accessoires & pièces</a>
          </div>
        </div>

        <div>
          <p className="font-black uppercase text-white">Contact</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-400">
            <a href="tel:+33400000000">04 00 00 00 00</a>
            <a href="mailto:contact@oyste.fr">contact@oyste.fr</a>
            <span>Lun - Ven : 8h00 - 17h30</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
