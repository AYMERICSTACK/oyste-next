import { FileText, ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const frameSizes = {
  card: "h-44 sm:h-48",
  hero: "aspect-[4/3] min-h-[320px]",
  thumb: "aspect-[4/3]",
} as const;

const imageSizes = {
  card: "max-h-[82%] max-w-[82%] p-2",
  hero: "max-h-[82%] max-w-[82%] p-4",
  thumb: "max-h-[86%] max-w-[86%]",
} as const;

export default function ProductMediaFrame({
  src,
  alt,
  label,
  documentCount = 0,
  variant = "card",
  interactive = false,
  className,
  imageClassName,
}: {
  src?: string;
  alt: string;
  label?: string;
  documentCount?: number;
  variant?: keyof typeof frameSizes;
  interactive?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const hasImage = Boolean(src);
  const compact = variant === "thumb";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100",
        frameSizes[variant],
        className,
      )}
    >
      <div className="absolute inset-4 rounded-[1.5rem] bg-white/80 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]" />

      {label ? (
        <div className={cn(
          "absolute left-5 top-5 z-10 rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm",
          compact && "left-3 top-3 px-2 py-0.5 text-[10px]",
        )}>
          {label}
        </div>
      ) : null}

      {documentCount > 0 && !compact ? (
        <div className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full bg-[#007f8f] px-3 py-1 text-xs font-black text-white shadow-sm">
          <FileText size={13} /> Fiche technique
        </div>
      ) : null}

      {hasImage ? (
        <img
          src={src}
          alt={alt}
          loading={variant === "hero" ? "eager" : "lazy"}
          className={cn(
            "relative z-[1] h-auto w-auto object-contain object-center transition duration-500",
            imageSizes[variant],
            interactive && "group-hover:scale-[1.04]",
            imageClassName,
          )}
        />
      ) : (
        <div className="relative z-[1] grid place-items-center gap-3 text-center text-slate-400">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            <ImageIcon size={24} />
          </span>
          {!compact ? (
            <p className="text-xs font-black uppercase tracking-[0.18em]">Visuel en attente</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
