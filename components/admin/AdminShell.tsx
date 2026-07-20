import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";
import AdminLogin from "@/components/admin/auth/AdminLogin";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) return <AdminLogin />;
  return <div className="flex min-h-screen bg-[#f3f6f8] text-slate-950"><AdminSidebar /><div className="flex min-w-0 flex-1 flex-col"><AdminTopbar /><div className="flex-1 overflow-x-hidden">{children}</div></div></div>;
}
