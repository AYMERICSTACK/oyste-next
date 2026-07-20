import Link from "next/link";
import OysteManualTrolleyManualHoist3DLab from "@/components/3d/OysteManualTrolleyManualHoist3DLab";

export const metadata = {
  title: "3D Lab · Chariot manuel + palan manuel | OYSTE",
  description: "Visualisation 3D de la configuration avec chariot manuel et palan manuel.",
};

export default function ManualTrolleyManualHoistLabPage() {
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
          href="/3d-lab/chariot-manuel-palan-electrique"
          className="rounded-full border border-sky-200 bg-sky-50/95 px-4 py-2 text-xs font-black text-sky-950 shadow-lg backdrop-blur hover:bg-sky-100"
        >
          Chariot manuel + palan électrique
        </Link>
      </div>
      <OysteManualTrolleyManualHoist3DLab />
    </div>
  );
}
