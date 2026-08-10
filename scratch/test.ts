
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function test() {
  await prisma.service_Order.updateMany({
    where: {
      booking: {
        flow: {
          flow_id: { in: ["123"] },
        },
      },
    },
    data: { status: "CANCELLED" },
  });
}
test();

