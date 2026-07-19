import { cn } from "@/lib/cn";

export default function SectionHeader({
  eyebrow,
  title,
  text,
  className,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {eyebrow && (
        <p className="text-sm font-black uppercase tracking-[0.35em] text-orange-600">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">
        {title}
      </h2>
      {text && <p className="mt-5 text-lg leading-8 text-slate-600">{text}</p>}
    </div>
  );
}
