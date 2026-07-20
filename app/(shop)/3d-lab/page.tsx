import Link from "next/link";
import Oyste3DLab from "@/components/3d/Oyste3DLab";

export const metadata = {
  title: "Visualisation 3D | OYSTE",
  description: "Visualisation 3D des équipements et configurations OYSTE.",
};

export default function ThreeDLabPage() {
  return (
    <div className="relative">
      <div className="fixed left-4 top-24 z-[1000] flex flex-col gap-2">
        <Link
          href="/3d-lab/chariot-manuel-palan-electrique"
          className="rounded-full border border-sky-200 bg-sky-50/95 px-4 py-2 text-xs font-black text-sky-950 shadow-lg backdrop-blur hover:bg-sky-100"
        >
          Chariot manuel + palan électrique →
        </Link>
        <Link
          href="/3d-lab/chariot-manuel-palan-manuel"
          className="rounded-full border border-amber-200 bg-amber-50/95 px-4 py-2 text-xs font-black text-amber-950 shadow-lg backdrop-blur hover:bg-amber-100"
        >
          Chariot manuel + palan manuel →
        </Link>
      </div>
      <Oyste3DLab />
    </div>
  );
}
