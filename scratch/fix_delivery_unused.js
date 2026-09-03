const fs = require('fs');
const path = 'backend/src/services/delivery.service.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove orderRepo import
code = code.replace(/import \* as orderRepo from "\.\.\/repositories\/order\.repository";\n/, '');

// 2. Remove realtime import
code = code.replace(/import \{ realtime \} from "\.\.\/realtime\/realtime";\n/, '');

// 3. Remove ORDER_STATUS_MAP
code = code.replace(/const ORDER_STATUS_MAP: Record<string, string> = \{\s*[\s\S]*?\n\};\n\n/, '');

// 4. Remove extractGatewayMethod
code = code.replace(/\/\/ The Razorpay payment entity[\s\S]*?function extractGatewayMethod\([\s\S]*?\} \| null \{\n[\s\S]*?\n\}\n\n/, '');

// 5. Remove DELIVERY_TRANSITIONS and assertDeliveryTransition
code = code.replace(/\/\/ Forward-only state machine[\s\S]*?function assertDeliveryTransition\([\s\S]*?\n\}\n\n/, '');

// 6. Remove imports from order-delivery.service and order-lifecycle.service
code = code.replace(/import \{\n  completeDelivery,\n  DELIVERY_PARTNER_DELIVERY_STATES,\n  verifyDeliveryOtp,\n\} from "\.\/order-delivery\.service";\n/, '');
code = code.replace(/import \{ assertOrderTransition \} from "\.\/order-lifecycle\.service";\n/, '');

// 7. Remove resolveTrackingAccess
code = code.replace(/\/\*\*[\s\S]*?\* Resolves what tracking data a requester may see[\s\S]*?function resolveTrackingAccess\([\s\S]*?\n\}\n/, '');

// 8. Remove `updated` variable in updateDeliveryLocation
code = code.replace(/const updated = await deliveryRepo\.updateDelivery/, 'await deliveryRepo.updateDelivery');

// Wait, I should also remove TrackingViewer type
code = code.replace(/type TrackingViewer =[\s\S]*?kind: "admin"; canSeeDriverInfo: true \};\n\n/, '');

fs.writeFileSync(path, code);
console.log('Fixed unused variables in delivery.service.ts');
