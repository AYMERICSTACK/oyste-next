import { notFound } from "next/navigation";
import OrderWorkspace from "@/components/admin/OrderWorkspace";
import { getOrderById } from "@/lib/admin/orders-data";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getOrderById(id);
  if (!order) notFound();
  return <OrderWorkspace record={order} />;
}
