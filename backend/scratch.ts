import prisma from "./src/database/prisma";
async function run() {
  try {
    const res = await prisma.notification.findMany({ where: { type: "vendor" as any } });
    console.log("Success with lowercase", res.length);
  } catch (e: any) {
    console.error("Error lowercase", e.message);
  }
  try {
    const res2 = await prisma.notification.findMany({ where: { type: "VENDOR" as any } });
    console.log("Success with uppercase", res2.length);
  } catch (e: any) {
    console.error("Error uppercase", e.message);
  }
}
run();
