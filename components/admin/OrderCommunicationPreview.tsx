"use client";

export default function OrderCommunicationPreview({ html }: { html: string }) {
  return (
    <iframe
      title="Prévisualisation de la communication client"
      srcDoc={html}
      className="h-[820px] w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
      sandbox=""
    />
  );
}
