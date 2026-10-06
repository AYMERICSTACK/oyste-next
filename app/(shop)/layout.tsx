import CommercialTextProvider from "@/components/layout/CommercialTextProvider";
import { getEditorialPage } from "@/lib/editorial";
export const dynamic = "force-dynamic";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const commercial = await getEditorialPage("commerce");
  return (
    <CommercialTextProvider fields={commercial.fields}>
      <Header />
      {children}
      <Footer />
    </CommercialTextProvider>
  );
}
