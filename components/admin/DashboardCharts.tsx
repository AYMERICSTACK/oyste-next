import { ArrowUpRight, Factory, ShoppingCart, TrendingUp, Truck } from "lucide-react";
import type { DashboardChartPoint } from "@/lib/admin/dashboard-data";
import { formatAdminPrice } from "@/lib/admin/orders-data";

type ChartKey = "revenue" | "orders" | "production" | "shipments";

type ChartDefinition = {
  key: ChartKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  format: "currency" | "number";
};

const charts: ChartDefinition[] = [
  { key: "revenue", label: "Évolution du CA", description: "Montants encaissés sur les 6 derniers mois", icon: TrendingUp, format: "currency" },
  { key: "orders", label: "Commandes", description: "Nouvelles commandes hors annulations", icon: ShoppingCart, format: "number" },
  { key: "production", label: "Production", description: "Dossiers entrés en cycle atelier", icon: Factory, format: "number" },
  { key: "shipments", label: "Expéditions", description: "Commandes prêtes ou expédiées", icon: Truck, format: "number" },
];

const integerFormatter = new Intl.NumberFormat("fr-FR");

function formatValue(value: number, format: ChartDefinition["format"]) {
  return format === "currency" ? formatAdminPrice(value) : integerFormatter.format(value);
}

function buildPolyline(values: number[], width = 520, height = 180) {
  const paddingX = 10;
  const paddingY = 18;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  return values.map((value, index) => {
    const x = paddingX + (index / Math.max(values.length - 1, 1)) * usableWidth;
    const y = paddingY + usableHeight - ((value - min) / range) * usableHeight;
    return { x, y };
  });
}

function LineChart({ points, chart }: { points: DashboardChartPoint[]; chart: ChartDefinition }) {
  const values = points.map((point) => point[chart.key]);
  const coordinates = buildPolyline(values);
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${path} L ${coordinates.at(-1)?.x ?? 510} 180 L ${coordinates[0]?.x ?? 10} 180 Z`;
  const current = values.at(-1) ?? 0;
  const previous = values.at(-2) ?? 0;
  const change = previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / previous) * 100;
  const Icon = chart.icon;

  return (
    <article className="overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white shadow-[0_18px_50px_-38px_rgba(15,23,42,0.55)]">
      <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Icon size={19} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black tracking-tight text-slate-950">{chart.label}</h3>
            <p className="mt-1 text-[11px] font-medium leading-4 text-slate-400">{chart.description}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black tracking-tight text-slate-950">{formatValue(current, chart.format)}</p>
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black ${change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            <ArrowUpRight size={10} className={change < 0 ? "rotate-90" : ""} />
            {Math.abs(change).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
          </span>
        </div>
      </div>

      <div className="px-3 pt-3 sm:px-5">
        <svg viewBox="0 0 520 180" role="img" aria-label={`${chart.label} sur six mois`} className="h-[190px] w-full overflow-visible">
          <defs>
            <linearGradient id={`area-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#007f8f" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#007f8f" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[30, 75, 120, 165].map((y) => <line key={y} x1="10" x2="510" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 7" strokeWidth="1" />)}
          <path d={areaPath} fill={`url(#area-${chart.key})`} />
          <path d={path} fill="none" stroke="#007f8f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          {coordinates.map((coordinate, index) => (
            <g key={`${chart.key}-${points[index]?.key}`}>
              <circle cx={coordinate.x} cy={coordinate.y} r="5" fill="white" stroke="#007f8f" strokeWidth="3" />
              <title>{`${points[index]?.label}: ${formatValue(values[index] ?? 0, chart.format)}`}</title>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-6 border-t border-slate-100 px-3 py-3 sm:px-5">
        {points.map((point) => <span key={point.key} className="text-center text-[9px] font-black uppercase tracking-wide text-slate-400">{point.shortLabel}</span>)}
      </div>
    </article>
  );
}

export default function DashboardCharts({ points }: { points: DashboardChartPoint[] }) {
  return (
    <section className="mt-7">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">Analyse de tendance</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Activité des six derniers mois</h2>
          <p className="mt-1 text-xs text-slate-500">Une lecture directe des performances commerciales et opérationnelles.</p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Données Prisma</span>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {charts.map((chart) => <LineChart key={chart.key} points={points} chart={chart} />)}
      </div>
    </section>
  );
}
