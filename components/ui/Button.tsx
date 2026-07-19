import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-orange-600 text-white shadow-xl shadow-orange-600/20 hover:bg-orange-700",
  secondary:
    "border-2 border-[#007f8f] bg-white text-[#005466] hover:bg-[#007f8f] hover:text-white",
  dark: "bg-slate-950 text-white hover:bg-slate-800",
  ghost: "border border-slate-200 bg-white text-slate-950 hover:border-orange-500",
};

export default function Button({
  children,
  href,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  href: string;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-3 rounded-xl px-7 py-4 text-sm font-black uppercase tracking-tight transition",
        variants[variant],
        className
      )}
    >
      {children}
    </a>
  );
}
