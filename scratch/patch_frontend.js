const fs = require("fs");
let content = fs.readFileSync("/Users/pushp/Desktop/vegamart/gali-connect-main/src/routes/orders.$orderId.track.tsx", "utf-8");

// Remove QR code modal state
content = content.replace("  const [showQrModal, setShowQrModal] = useState(false);\\n", "");

// Remove "Scan UPI QR" button from the unpaid fallback
content = content.replace(/\\s*<button\\n\\s*onClick=\\{.*?setShowQrModal\\(true\\)\\}\\n\\s*className="flex-1 sm:flex-none flex items-center justify-center gap-1\\.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-bold text-xs px-4 py-2\\.5 shadow-xs transition-colors"\\n\\s*>\\n\\s*<QrCode className="h-3\\.5 w-3\\.5 text-emerald-600" \\/>\\n\\s*Scan UPI QR\\n\\s*<\\/button>/s, "");

// Remove "Scan UPI QR" button from the main action buttons
content = content.replace(/\\s*<button\\n\\s*onClick=\\{.*?setShowQrModal\\(true\\)\\}\\n\\s*className="w-full sm:w-auto flex-1 bg-white border border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 text-emerald-800 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"\\n\\s*>\\n\\s*<QrCode className="h-3\\.5 w-3\\.5 text-emerald-600" \\/>\\n\\s*Scan UPI QR\\n\\s*<\\/button>/s, "");

// Remove the Dialog modal for QR Code
content = content.replace(/\\s*\\{\\/\\* UPI QR Modal for Instant Scan & Pay \\*\\/\\}\\n\\s*<Dialog open=\\{showQrModal\\} onOpenChange=\\{setShowQrModal\\}>[\\s\\S]*?<\\/Dialog>/s, "");

fs.writeFileSync("/Users/pushp/Desktop/vegamart/gali-connect-main/src/routes/orders.$orderId.track.tsx", content);
