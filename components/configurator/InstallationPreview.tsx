import { CheckCircle2, CircleDashed, PackagePlus } from "lucide-react";
import type { EngineResult } from "@/lib/configurator/types";
import { getProductImageUrl, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-images";

function getAnswerLabel(configuration: EngineResult, questionId: string) {
  const question = configuration.questions.find((item) => item.id === questionId);
  const selected = question?.choices.find(
    (choice) => choice.id === configuration.answers[questionId]
  );

  return selected?.label;
}

export default function InstallationPreview({
  configuration,
}: {
  configuration: EngineResult;
}) {
  const capacity = getAnswerLabel(configuration, "capacity");
  const reach = getAnswerLabel(configuration, "reach");
  const fixing = getAnswerLabel(configuration, "fixing");
  const selectedAccessoriesCount = configuration.selectedAccessories.length;
  const imageUrl = getProductImageUrl(
    configuration.erpInstallation.match?.ouvrage.code,
    configuration.erpInstallation.mainComponent?.code,
    configuration.selectedVariant?.id
  );

  const details = [
    { label: "Charge", value: capacity },
    { label: "Portée", value: reach },
    { label: "Fixation", value: fixing },
    {
      label: "Compléments",
      value:
        selectedAccessoriesCount > 0
          ? `${selectedAccessoriesCount} élément${selectedAccessoriesCount > 1 ? "s" : ""}`
          : undefined,
    },
  ];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      <div className="relative min-h-[360px] bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6">
        <div className="absolute right-6 top-6 rounded-full bg-[#007f8f]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#005466]">
          Visualisation évolutive
        </div>

        <div className="absolute inset-x-6 bottom-6 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white/75">
          <img
            src={imageUrl}
            alt={configuration.erpInstallation.match?.ouvrage.label ?? "Installation de levage configurée"}
            className="h-64 w-full object-contain object-center p-5 opacity-95"
            onError={(event) => {
              event.currentTarget.src = PRODUCT_IMAGE_FALLBACK;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/20 to-transparent" />
        </div>

        <div className="relative z-10 max-w-sm pt-16">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">
            OYSTE Builder
          </p>
          <h3 className="mt-3 text-3xl font-black leading-tight text-slate-950">
            Votre installation prend forme.
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Chaque choix complète l’installation avant la commande : produit,
            compatibilités, compléments et prix HT.
          </p>
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2">
        {details.map((detail) => (
          <div
            key={detail.label}
            className={`rounded-2xl border p-4 ${
              detail.value
                ? "border-[#007f8f]/20 bg-[#007f8f]/5"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              {detail.value ? (
                <CheckCircle2 className="text-[#007f8f]" size={19} />
              ) : (
                <CircleDashed className="text-slate-400" size={19} />
              )}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  {detail.label}
                </p>
                <p className="mt-1 font-black text-slate-950">
                  {detail.value ?? "À choisir"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {configuration.selectedAccessories.length > 0 && (
        <div className="border-t border-slate-100 p-5">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-orange-600">
            <PackagePlus size={17} /> Éléments ajoutés
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {configuration.selectedAccessories.map((accessory) => (
              <span
                key={accessory.id}
                className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white"
              >
                {accessory.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
