import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f3f6f8] text-slate-950">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col"><AdminTopbar /><div className="flex-1 overflow-x-hidden">{children}</div></div>
    </div>
  );
}
