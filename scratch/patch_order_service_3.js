const fs = require('fs');
const path = 'backend/src/services/order.service.ts';
let code = fs.readFileSync(path, 'utf8');

const getTimelineReplacement = `async getTimeline(orderId: string): Promise<any[]> {
    const m = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
        orders: { include: { events: true } }
      }
    });

    if (m) {
      // It's a master order
      const events = m.orders.flatMap(o => o.events);
      events.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      return events;
    }

    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    return order.events;
  },`;

code = code.replace(/async getTimeline[\s\S]*?(?=async getInvoice)/, getTimelineReplacement + '\n\n  ');

fs.writeFileSync(path, code);
