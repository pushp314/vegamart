const fs = require('fs');
const file = 'backend/src/services/delivery.service.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace listMyDeliveries return logic
const listMyDeliveriesRegex = /return rows\.map\(\(m: any\) => \{[\s\S]*?\}\);\n    return rows\.map\(\(m: any\) => \{[\s\S]*?\}\);/;
if (listMyDeliveriesRegex.test(code)) {
    code = code.replace(listMyDeliveriesRegex, `return rows.map((m: any) => {
      const items = m.orders.flatMap((o: any) => o.items);
      const vendors = m.orders.map((o: any) => o.vendor);
      
      return {
        id: m.id,
        order_number: m.order_number,
        status: m.status,
        delivery_fee: m.delivery_fee,
        items_subtotal: m.total_amount,
        tax: m.tax,
        discount: 0,
        total: m.total_amount,
        delivery_note: m.orders[0]?.delivery_note,
        payment_method: m.payment_method,
        payment_status: m.payment_status,
        otp_code: m.orders[0]?.otp_code,
        created_at: m.created_at,
        payment: m.orders[0]?.payment,
        items: items,
        vendor: vendors.length === 1 ? vendors[0] : { business_name: \`\${vendors.length} Stores\`, address: "Multiple Pickup Locations" },
        sub_orders: m.orders.map((o: any) => ({
           id: o.id,
           order_number: o.order_number,
           status: o.status,
           vendor: o.vendor,
           total: o.total,
           items: o.items,
        })),
        customer: m.customer,
        address: m.address,
      };
    });`);
} else {
    // try single block if double is not found
    const singleRegex = /return rows\.map\(\(m: any\) => \{[\s\S]*?\}\);/;
    code = code.replace(singleRegex, `return rows.map((m: any) => {
      const items = m.orders.flatMap((o: any) => o.items);
      const vendors = m.orders.map((o: any) => o.vendor);
      
      return {
        id: m.id,
        order_number: m.order_number,
        status: m.status,
        delivery_fee: m.delivery_fee,
        items_subtotal: m.total_amount,
        tax: m.tax,
        discount: 0,
        total: m.total_amount,
        delivery_note: m.orders[0]?.delivery_note,
        payment_method: m.payment_method,
        payment_status: m.payment_status,
        otp_code: m.orders[0]?.otp_code,
        created_at: m.created_at,
        payment: m.orders[0]?.payment,
        items: items,
        vendor: vendors.length === 1 ? vendors[0] : { business_name: \`\${vendors.length} Stores\`, address: "Multiple Pickup Locations" },
        sub_orders: m.orders.map((o: any) => ({
           id: o.id,
           order_number: o.order_number,
           status: o.status,
           vendor: o.vendor,
           total: o.total,
           items: o.items,
        })),
        customer: m.customer,
        address: m.address,
      };
    });`);
}

// same for listDeliveryRequests
const listDeliveryRequestsRegex = /return rows\.map\(\(m: any\) => \{[\s\S]*?\}\);/;
// Actually wait, let's just make a generic replace for both.
// Let's use `multi_replace` tool via node for better precision.

fs.writeFileSync(file, code);
