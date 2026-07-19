const filters = ["125 kg", "250 kg", "500 kg", "1 tonne", "Avec palan"];

export default function Filters() {
  return (
    <div className="flex flex-wrap gap-3">
      {filters.map((filter) => (
        <button
          key={filter}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-orange-500"
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
