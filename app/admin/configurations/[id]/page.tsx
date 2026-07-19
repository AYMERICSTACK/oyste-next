import { notFound } from "next/navigation";
import ConfigurationWorkspace from "@/components/admin/ConfigurationWorkspace";
import { getConfigurationById } from "@/lib/admin/mock-data";

export default async function ConfigurationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = getConfigurationById(id);
  if (!record) notFound();
  return <ConfigurationWorkspace record={record} />;
}
