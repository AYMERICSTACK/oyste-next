import DashboardLive from "@/components/admin/DashboardLive";
import { getDashboardData } from "@/lib/admin/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const generatedAt = new Date();
  const dashboard = await getDashboardData(generatedAt);

  return <DashboardLive initialDashboard={dashboard} initialGeneratedAt={generatedAt.toISOString()} />;
}
