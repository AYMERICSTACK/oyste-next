import Container from "@/components/ui/Container";
import { CGV_ENTRIES } from "@/lib/legal/cgv-content";
import { CGV_EFFECTIVE_LABEL, CGV_VERSION } from "@/lib/legal/cgv-meta";

export const metadata = {
  title: "Conditions générales de vente | OYSTE",
  description: "Conditions générales de vente ADEI applicables aux commandes commercialisées sous la marque OYSTE.",
};

export default function CgvPage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <Container className="py-12 md:py-16">
        <header className="rounded-[2.25rem] border border-slate-200 bg-white p-7 shadow-sm md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">Informations contractuelles</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Conditions générales de vente</h1>
          <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            ADEI, agissant sous sa marque commerciale OYSTE — {CGV_EFFECTIVE_LABEL}.
          </p>
          <p className="mt-2 text-xs font-bold text-slate-400">Référence : {CGV_VERSION}</p>
        </header>

        <article className="mt-8 rounded-[2.25rem] border border-slate-200 bg-white p-7 shadow-sm md:p-10 lg:p-12">
          <div className="mx-auto max-w-5xl">
            {CGV_ENTRIES.map((entry, index) => {
              if (entry.kind === "article") {
                return (
                  <h2 key={index} className="mt-10 first:mt-0 border-t border-slate-200 pt-8 text-xl font-black uppercase tracking-tight text-slate-950">
                    {entry.text}
                  </h2>
                );
              }
              if (entry.kind === "subheading") {
                return <h3 key={index} className="mt-7 text-base font-black text-[#007f8f]">{entry.text}</h3>;
              }
              if (entry.kind === "bullet") {
                return (
                  <div key={index} className="mt-3 flex gap-3 pl-2 text-sm font-medium leading-7 text-slate-700">
                    <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                    <p className="whitespace-pre-line">{entry.text}</p>
                  </div>
                );
              }
              return <p key={index} className="mt-4 whitespace-pre-line text-sm font-medium leading-7 text-slate-700">{entry.text}</p>;
            })}
          </div>
        </article>
      </Container>
    </main>
  );
}
