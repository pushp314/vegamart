const fs = require("fs");
let content = fs.readFileSync("/Users/pushp/Desktop/vegamart/backend/src/services/payment.service.ts", "utf-8");

content = content.replace(
  "const { order, isMasterOrder, userIdOwner, orderNumber } = await this.resolveOrderContext(orderId);",
  "const { order, userIdOwner } = await this.resolveOrderContext(orderId);"
);

fs.writeFileSync("/Users/pushp/Desktop/vegamart/backend/src/services/payment.service.ts", content);
