import { notFound } from "next/navigation";
import OrderWorkspace from "@/components/admin/OrderWorkspace";
import { getLiveAdminOrder } from "@/lib/admin/live-orders";
export const dynamic = "force-dynamic";
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const order = await getLiveAdminOrder(id); if (!order) notFound(); return <OrderWorkspace record={order}/>; }
