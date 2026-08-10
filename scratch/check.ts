
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const s1 = await prisma.service_Order.findUnique({
    where: { service_order_id: "c2bdd9fa-1d09-4d43-b7db-da038247cf55" },
    include: { steps: true }
  });
  console.log("Order 1 steps:", s1?.steps);

  const s2 = await prisma.service_Order.findUnique({
    where: { service_order_id: "a4551d17-c0cd-4aef-a54e-e6fe6c11a91e" },
    include: { steps: true }
  });
  console.log("Order 2 steps:", s2?.steps);
}
check();

