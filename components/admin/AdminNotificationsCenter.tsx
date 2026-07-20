"use client";

import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NotificationKind =
  | "ORDER_CREATED"
  | "ORDER_VALIDATED"
  | "PAYMENT_RECEIVED"
  | "ORDER_READY"
  | "SHIPMENT_CREATED"
  | "USER_CREATED"
  | "STATUS_UPDATED";

type NotificationItem = {
  key: string;
  kind: NotificationKind;
  title: string;
  description: string;
  href: string;
  createdAt: string;
  isRead: boolean;
};

const ICONS = {
  ORDER_CREATED: ShoppingCart,
  ORDER_VALIDATED: ShieldCheck,
  PAYMENT_RECEIVED: CircleDollarSign,
  ORDER_READY: PackageCheck,
  SHIPMENT_CREATED: Truck,
  USER_CREATED: UserPlus,
  STATUS_UPDATED: RefreshCw,
} satisfies Record<NotificationKind, typeof Bell>;

const ICON_STYLES: Record<NotificationKind, string> = {
  ORDER_CREATED: "bg-sky-50 text-sky-700",
  ORDER_VALIDATED: "bg-emerald-50 text-emerald-700",
  PAYMENT_RECEIVED: "bg-teal-50 text-teal-700",
  ORDER_READY: "bg-amber-50 text-amber-700",
  SHIPMENT_CREATED: "bg-violet-50 text-violet-700",
  USER_CREATED: "bg-orange-50 text-orange-700",
  STATUS_UPDATED: "bg-slate-100 text-slate-600",
};

function relativeDate(value: string) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "À l’instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

export default function AdminNotificationsCenter() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Notifications indisponibles");
      const data = await response.json();
      setItems(data.notifications ?? []);
    } catch {
      if (!silent) setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const refresh = window.setTimeout(() => void load(true), 0);
    return () => window.clearTimeout(refresh);
  }, [open, load]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (open && rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const mutate = async (payload: object, optimistic: () => void) => {
    optimistic();
    setMutating(true);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Action impossible");
    } catch {
      await load(true);
    } finally {
      setMutating(false);
    }
  };

  const toggleRead = (item: NotificationItem) => {
    void mutate(
      { action: item.isRead ? "unread" : "read", key: item.key },
      () => setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, isRead: !entry.isRead } : entry)),
    );
  };

  const markAllRead = () => {
    const keys = items.filter((item) => !item.isRead).map((item) => item.key);
    if (!keys.length) return;
    void mutate(
      { action: "read-all", keys },
      () => setItems((current) => current.map((item) => ({ ...item, isRead: true }))),
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${open ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : ""}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unreadCount ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-black text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="fixed inset-x-3 top-[86px] z-50 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+12px)] sm:w-[430px]">
          <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-950">Centre de notifications</h2>
                {unreadCount ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-700">{unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}</span> : null}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Activité récente du back-office OYSTE</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer"><X size={16} /></button>
          </header>

          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-2.5">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">30 dernières activités</span>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount || mutating}
              className="flex items-center gap-1.5 text-[11px] font-black text-[#007f8f] transition hover:text-[#006876] disabled:cursor-default disabled:opacity-40"
            >
              <CheckCheck size={14} /> Tout marquer comme lu
            </button>
          </div>

          <div className="max-h-[62vh] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-14 text-xs font-bold text-slate-400"><RefreshCw size={17} className="animate-spin" /> Chargement des notifications…</div>
            ) : null}

            {!loading && !items.length ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Bell size={21} /></span>
                <p className="mt-4 text-sm font-black text-slate-800">Aucune notification</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Les nouvelles commandes, paiements et évolutions logistiques apparaîtront ici.</p>
              </div>
            ) : null}

            {!loading ? items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <article key={item.key} className={`group relative mb-1 flex gap-3 rounded-xl border px-3 py-3 transition last:mb-0 ${item.isRead ? "border-transparent hover:border-slate-100 hover:bg-slate-50" : "border-orange-100 bg-orange-50/45 hover:bg-orange-50/70"}`}>
                  {!item.isRead ? <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-orange-500" /> : null}
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ICON_STYLES[item.kind]}`}><Icon size={17} /></span>
                  <Link href={item.href} onClick={() => setOpen(false)} className="min-w-0 flex-1 py-0.5">
                    <span className="block truncate text-[13px] font-black text-slate-900">{item.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{item.description}</span>
                    <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-slate-400"><Clock3 size={11} />{relativeDate(item.createdAt)}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleRead(item)}
                    disabled={mutating}
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 opacity-0 transition hover:bg-white hover:text-[#007f8f] group-hover:opacity-100 focus:opacity-100 disabled:opacity-30"
                    aria-label={item.isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                    title={item.isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                  >
                    {item.isRead ? <Bell size={14} /> : <Check size={15} />}
                  </button>
                </article>
              );
            }) : null}
          </div>

          <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-bold text-slate-400">
            <span>Mise à jour automatique chaque minute</span>
            <button type="button" onClick={() => void load()} className="flex items-center gap-1.5 text-slate-600 hover:text-slate-950"><RefreshCw size={12} /> Actualiser</button>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
