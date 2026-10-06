import styles from "./HomeSupplierMarquee.module.css";
type HomeSupplier = { name: string; logoUrl: string | null; homeHref: string | null };
function SupplierSet({ suppliers, hidden = false }: { suppliers: HomeSupplier[]; hidden?: boolean }) {
 return <div className={styles.set} aria-hidden={hidden || undefined}>{suppliers.map(supplier => {
  const logo = supplier.logoUrl ? <img src={supplier.logoUrl} alt={hidden ? "" : supplier.name} width={170} height={72} className={styles.logo} /> : <span>{supplier.name}</span>;
  return supplier.homeHref ? <a tabIndex={hidden ? -1 : undefined} href={supplier.homeHref} className={styles.card} key={supplier.name}>{logo}</a> : <div className={styles.card} key={supplier.name}>{logo}</div>;
 })}</div>;
}
export default function HomeSupplierMarquee({ suppliers }: { suppliers: HomeSupplier[] }) {
 if (!suppliers.length) return null;
 return <div className={styles.viewport} aria-label="Nos fournisseurs"><div className={styles.track}><SupplierSet suppliers={suppliers} /><SupplierSet suppliers={suppliers} hidden /></div></div>;
}
