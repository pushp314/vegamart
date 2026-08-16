I think I've found the issue! PM2 might be sending the error logs to `backend-out.log` instead of `backend-error.log` because Winston logs all levels to `stdout`.

To confirm my theory, could you please run this command and share the output?
```bash
sudo cat /opt/vegamart/current/logs/backend-out.log | tail -n 50
```

I suspect the frontend is sending an invalid payment method (like "UPI" or "CARD") which isn't defined in the Prisma database `PaymentMethod` enum, causing the checkout to crash. Your logs will confirm this instantly!
