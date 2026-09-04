import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const address = await prisma.address.findFirst();
        if (!address) throw new Error("No address found");
        
        const order = await prisma.masterOrder.create({
            data: {
                order_number: "TEST-" + Date.now(),
                user_id: address.user_id,
                address_id: address.id, 
                total_amount: 100,
                delivery_fee: 10,
                tax: 5,
                platform_fee: 5,
                additional_charges: [{ name: "Platform Fee", amount: 5, type: "fixed" }],
                status: "PENDING",
                payment_method: "RAZORPAY",
                payment_status: "PENDING",
            }
        });
        console.log("Success:", order.id);
    } catch (e: any) {
        console.error("Prisma Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
