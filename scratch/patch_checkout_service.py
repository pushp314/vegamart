import re

with open('scratch/checkout.service.ts', 'r') as f:
    code = f.read()

# Update CheckoutResult
code = code.replace(
'''interface CheckoutResult {
  summary: CheckoutSummary;
  orders: Array<{ order: SerializedOrder; payment: SerializedPayment }>;
}''',
'''interface CheckoutResult {
  summary: CheckoutSummary;
  master_order: any;
  master_payment?: any;
  orders: Array<{ order: SerializedOrder; payment: SerializedPayment }>;
}'''
)

# In placeOrder, generate master_order
# We will find the transaction block
tx_start = '''      await prisma.$transaction(async (tx) => {
        // Reserve the key first'''
tx_replacement = '''      await prisma.$transaction(async (tx) => {
        // Reserve the key first'''
# Actually, let's just use string replacement for the loop and before the loop
before_loop = '''        const sharedOtp = generateDeliveryOtp();'''

master_order_creation = '''        const sharedOtp = generateDeliveryOtp();
        
        // 1. Create MasterOrder
        const masterOrderNumber = generateOrderNumber();
        const masterOrder = await orderRepo.createMasterOrder({
          order_number: masterOrderNumber,
          user_id: userId,
          address_id: address.id,
          total_amount: summary.total,
          delivery_fee: summary.delivery_fee,
          tax: summary.tax || 0,
          payment_method: paymentMethod,
        }, tx);
        
        let masterAmountCharged = summary.total;
        if (paymentMethod === "RAZORPAY") {
          // Check if any advance payment
          // If we want to support advance, we calculate the sum of amountCharged from all computations
          masterAmountCharged = computations.reduce((sum, c) => {
            const optConfig = c.group.delivery_configs ? getDeliveryOptionConfig(input.delivery_slot, c.group.delivery_configs)?.config : null;
            if (paymentType === "ADVANCE" && optConfig?.advance_payment_enabled) {
              const advancePct = optConfig.advance_percentage || 20;
              if (advancePct > 0 && advancePct < 100) {
                 return sum + Math.max(1, Math.round(c.groupTotal * (advancePct / 100) * 100) / 100);
              }
            }
            return sum + c.groupTotal;
          }, 0);
          
          if (masterAmountCharged > 0 && masterAmountCharged < 1) masterAmountCharged = 1;
        }

        let masterPayment;
        if (paymentMethod === "RAZORPAY") {
           masterPayment = await paymentRepo.createForOrder({
              order_id: undefined as any,
              master_order_id: masterOrder.id,
              amount: masterAmountCharged,
              method: "RAZORPAY",
              razorpay_order_id: Array.isArray(gatewayOrders) && gatewayOrders.length > 0 ? gatewayOrders[0]?.id : undefined,
           }, tx);
        } else {
           masterPayment = await paymentRepo.createForOrder({
              order_id: undefined as any,
              master_order_id: masterOrder.id,
              amount: summary.total,
              method: "COD",
           }, tx);
        }
'''

code = code.replace(before_loop, master_order_creation)

# Inside the loop:
# Update createOrder call
order_create_target = '''            {
              order_number: orderNumber,
              user_id: userId,
              vendor_id: group.vendor_id,'''
order_create_replacement = '''            {
              order_number: orderNumber,
              master_order_id: masterOrder.id,
              user_id: userId,
              vendor_id: group.vendor_id,'''

code = code.replace(order_create_target, order_create_replacement)

# Remove the payment creation from inside the loop
loop_payment_target = '''          let payment;
          if (paymentMethod === "RAZORPAY") {
            if (amountCharged === 0) {
              payment = await paymentRepo.createForOrder(
                {
                  order_id: order.id,
                  amount: 0,
                  method: "COD",
                },
                tx
              );
            } else {
              payment = await paymentRepo.createForOrder(
                {
                  order_id: order.id,
                  amount: amountCharged,
                  method: "RAZORPAY",
                  razorpay_order_id: gatewayOrders[i]?.id,
                },
                tx
              );
            }
          } else {
            payment = await paymentRepo.createForOrder(
              {
                order_id: order.id,
                amount: groupTotal,
                method: "COD",
              },
              tx
            );
          }

          serializedOrders.push(serializeOrder(updated, payment));'''

loop_payment_replacement = '''          // Payments are now tracked at the MasterOrder level.
          serializedOrders.push(serializeOrder(updated, null as any));'''

code = code.replace(loop_payment_target, loop_payment_replacement)

# Then at the end of the transaction:
tx_end_target = '''        // Persist the serialized result for idempotent replays.
        if (idempotencyKey) {
          await checkoutIdempotencyRepo.setResponse(tx, idempotencyKey, userId, {
            summary,
            orders: serializedOrders,
          } as unknown as Prisma.InputJsonValue);
        }
      });'''
tx_end_replacement = '''        // Persist the serialized result for idempotent replays.
        const txResult = {
          summary,
          master_order: masterOrder,
          master_payment: masterPayment,
          orders: serializedOrders,
        };
        if (idempotencyKey) {
          await checkoutIdempotencyRepo.setResponse(tx, idempotencyKey, userId, txResult as unknown as Prisma.InputJsonValue);
        }
        return txResult;
      });'''

code = code.replace(tx_end_target, tx_end_replacement)

# Replace the return statement
return_target = '''    return { summary, orders: serializedOrders };'''
return_replacement = '''    const resultData = await prisma.$transaction(... /* Handled inside we just return the variable */); // We need to capture the tx return
    // Wait, let's just use a top level variable
'''
# Actually, prisma.$transaction doesn't have a variable assignment in the original code. Let's fix that.
tx_call_target = '''      await prisma.$transaction(async (tx) => {'''
tx_call_replacement = '''      let txResultData: any;
      await prisma.$transaction(async (tx) => {'''

code = code.replace(tx_call_target, tx_call_replacement)

tx_end_target2 = '''        const txResult = {
          summary,
          master_order: masterOrder,
          master_payment: masterPayment,
          orders: serializedOrders,
        };
        if (idempotencyKey) {
          await checkoutIdempotencyRepo.setResponse(tx, idempotencyKey, userId, txResult as unknown as Prisma.InputJsonValue);
        }
        return txResult;
      });'''

tx_end_replacement2 = '''        const txResult = {
          summary,
          master_order: masterOrder,
          master_payment: masterPayment,
          orders: serializedOrders,
        };
        if (idempotencyKey) {
          await checkoutIdempotencyRepo.setResponse(tx, idempotencyKey, userId, txResult as unknown as Prisma.InputJsonValue);
        }
        txResultData = txResult;
      });'''

code = code.replace(tx_end_target2, tx_end_replacement2)

code = code.replace(return_target, '''    return txResultData;''')

with open('scratch/checkout.service.ts', 'w') as f:
    f.write(code)

