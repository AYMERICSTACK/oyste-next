"use client";
export type CollectionField = { key: string; label: string; type?: "text" | "textarea" | "number" | "boolean" | "image" | "primary" | "select"; options?: Array<{ value: string; label: string }> };
const input = "mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";
export default function CollectionEditor({ value, onChange, fields, disabled, allowAdd = true, allowRemove = true, initialItem = {} }: {
  value: Array<Record<string, unknown>>; onChange: (value: Array<Record<string, unknown>>) => void;
  fields: CollectionField[]; disabled?: boolean; allowAdd?: boolean; allowRemove?: boolean; initialItem?: Record<string, unknown>;
}) {
  function update(index: number, field: CollectionField, next: unknown) {
    onChange(value.map((item, i) => field.type === "primary" ? { ...item, [field.key]: i === index } : i === index ? { ...item, [field.key]: next } : item));
  }
  function move(index: number, offset: number) {
    const items = [...value]; const target = index + offset;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    onChange(items.map((item, order) => ({ ...item, ...("sortOrder" in item ? { sortOrder: order } : {}), ...("order" in item ? { order } : {}) })));
  }
  return <div className="space-y-3">{value.map((item, index) => <article key={index} className="rounded-xl border bg-slate-50 p-4">
    <div className="grid gap-3 md:grid-cols-2">{fields.map(field => <label key={field.key} className="block text-xs font-bold">
      {field.type === "boolean" || field.type === "primary" ? <span className="flex gap-2"><input type={field.type === "primary" ? "radio" : "checkbox"} checked={!!item[field.key]} disabled={disabled} onChange={e => update(index, field, e.target.checked)} />{field.label}</span> : <>{field.label}{field.type === "textarea" ? <textarea rows={4} value={String(item[field.key] ?? "")} disabled={disabled} onChange={e => update(index, field, e.target.value)} className={input} /> : field.type === "select" ? <select value={String(item[field.key] ?? "")} disabled={disabled} onChange={e => update(index, field, e.target.value)} className={input}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.type === "number" ? "number" : "text"} value={String(item[field.key] ?? "")} min={field.type === "number" ? 0 : undefined} disabled={disabled} onChange={e => update(index, field, field.type === "number" ? Number(e.target.value) : e.target.value)} className={input} />}</>}
      {field.type === "image" && !!item[field.key] && <img src={String(item[field.key])} alt="Aperçu" className="mt-2 h-28 w-full object-contain" />}
    </label>)}</div>
    <div className="mt-3 flex gap-4 text-xs font-bold"><button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)}>Monter</button><button type="button" disabled={disabled || index === value.length - 1} onClick={() => move(index, 1)}>Descendre</button>{allowRemove && <button type="button" disabled={disabled} className="text-red-700" onClick={() => { if (window.confirm("Retirer cet élément de la présentation ?")) onChange(value.filter((_, i) => i !== index)); }}>Retirer</button>}</div>
  </article>)}{allowAdd && <button type="button" disabled={disabled} className="font-bold text-[#007f8f]" onClick={() => onChange([...value, { ...initialItem, ...("sortOrder" in initialItem ? { sortOrder: value.length } : {}), ...("order" in initialItem ? { order: value.length } : {}) }])}>Ajouter un élément</button>}</div>;
}
