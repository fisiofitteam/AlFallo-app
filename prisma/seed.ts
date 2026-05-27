import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_CEO_EMAIL ?? "fisiofitteam@fisiofitteam.com").toLowerCase();
  const fullName = process.env.SEED_CEO_NAME ?? "Dirección";

  const existing = await prisma.professional.findUnique({ where: { email } });

  if (existing) {
    // No tocamos la contraseña de un usuario ya existente; solo aseguramos rol/estado.
    await prisma.professional.update({
      where: { email },
      data: { role: "ceo", isActive: true },
    });
    console.log(`\nℹ️  El CEO ya existía (${email}); rol y estado verificados. Contraseña intacta.\n`);
    return;
  }

  // Si no se define contraseña en el entorno, generamos una temporal y la mostramos.
  const generated = !process.env.SEED_CEO_PASSWORD;
  const password = process.env.SEED_CEO_PASSWORD ?? crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const ceo = await prisma.professional.create({
    data: { email, fullName, role: "ceo", isActive: true, passwordHash },
  });

  console.log("\n✅ CEO creado:");
  console.log(`   email: ${ceo.email}`);
  if (generated) {
    console.log(`   contraseña temporal: ${password}`);
    console.log("   ⚠️  Cámbiala tras el primer login. (Define SEED_CEO_PASSWORD para fijarla.)");
  } else {
    console.log("   contraseña: la definida en SEED_CEO_PASSWORD");
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
