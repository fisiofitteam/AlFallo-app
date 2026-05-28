import { ShoppingCart } from "lucide-react";
import { requireOnboardedClient } from "@/lib/client-session";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Tu compra · Al Fallo" };

export default async function CompraPage() {
  await requireOnboardedClient();
  return (
    <ComingSoon
      icon={ShoppingCart}
      title="Tu compra"
      description="La lista de la compra de tu plan semanal, lista para llevártela al super."
    />
  );
}
