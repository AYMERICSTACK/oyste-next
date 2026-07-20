import { Clock, Mail, Star } from "lucide-react";
import Container from "@/components/ui/Container";
import { getCmsContent } from "@/lib/cms";
export default async function TopBar() { const { topbar } = await getCmsContent(); if (!topbar.enabled) return null; return <div className="hidden bg-[#005466] text-white lg:block"><Container className="flex h-11 items-center justify-between text-sm"><p className="flex items-center gap-2 font-medium"><Star size={15}/>{topbar.message}</p><div className="flex items-center gap-7 font-medium"><a href={`mailto:${topbar.email}`} className="flex items-center gap-2"><Mail size={15}/>{topbar.email}</a><span className="flex items-center gap-2"><Clock size={15}/>{topbar.hours}</span></div></Container></div>; }
