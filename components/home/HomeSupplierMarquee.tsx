import Image from "next/image";
import styles from "./HomeSupplierMarquee.module.css";

const suppliers = [
  { name: "ADEI", logo: "/brands/adei.png" },
  { name: "KITO", logo: "/brands/kito.png" },
  { name: "STOCKMAN", logo: "/brands/stockman.png" },
  { name: "SEW USOCOME", logo: "/brands/sew-usocome.png" },
  { name: "CROMOX", logo: "/brands/cromox.jpg" },
  { name: "HYDROBULL", logo: "/brands/hydrobull.jpg" },
  { name: "COMEPAL", logo: "/brands/comepal.png" },
  { name: "GOLIATH", logo: "/brands/goliath.png" },
] as const;

function SupplierSet({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className={styles.set} aria-hidden={hidden || undefined}>
      {suppliers.map((supplier) => (
        <div className={styles.card} key={supplier.name}>
          <Image
            src={supplier.logo}
            alt={hidden ? "" : supplier.name}
            width={170}
            height={72}
            className={styles.logo}
          />
        </div>
      ))}
    </div>
  );
}

export default function HomeSupplierMarquee() {
  return (
    <div className={styles.viewport} aria-label="Nos fournisseurs">
      <div className={styles.track}>
        <SupplierSet />
        <SupplierSet hidden />
      </div>
    </div>
  );
}
