import Link from "next/link";
import OysteManualTrolleyElectricHoist3DLab from "@/components/3d/OysteManualTrolleyElectricHoist3DLab";

export const metadata = {
  title: "3D Lab · Chariot manuel + palan électrique | OYSTE",
  description: "Laboratoire 3D dédié à la variante chariot manuel et palan électrique.",
};

export default function ManualTrolleyElectricHoistLabPage() {
  return (
    <div className="relative">
      <div className="fixed left-4 top-24 z-[1000] flex flex-col gap-2">
        <Link
          href="/3d-lab"
          className="rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-black text-slate-900 shadow-lg backdrop-blur hover:bg-slate-50"
        >
          ← Chariot électrique + palan électrique
        </Link>
        <Link
          href="/3d-lab/chariot-manuel-palan-manuel"
          className="rounded-full border border-amber-200 bg-amber-50/95 px-4 py-2 text-xs font-black text-amber-950 shadow-lg backdrop-blur hover:bg-amber-100"
        >
          Chariot manuel + palan manuel →
        </Link>
      </div>
      <OysteManualTrolleyElectricHoist3DLab />
    </div>
  );
}
