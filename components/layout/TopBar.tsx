import { Clock, Mail, Phone, Star } from "lucide-react";
import Container from "@/components/ui/Container";

export default function TopBar() {
  return (
    <div className="hidden bg-[#005466] text-white lg:block">
      <Container className="flex h-11 items-center justify-between text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Star size={15} />
          Solutions de levage, manutention et équipements industriels
        </p>

        <div className="flex items-center gap-7 font-medium">
          <span className="flex items-center gap-2">
            <Phone size={15} /> 04 00 00 00 00
          </span>
          <span className="flex items-center gap-2">
            <Mail size={15} /> contact@oyste.fr
          </span>
          <span className="flex items-center gap-2">
            <Clock size={15} /> Lun - Ven : 8h00 - 12h00 / 13h30 - 17h30
          </span>
        </div>
      </Container>
    </div>
  );
}
