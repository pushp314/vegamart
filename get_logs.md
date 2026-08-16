Okay, the deployment finished successfully, which is great! However, you're still seeing the "Database operation failed" error. This means there's another underlying issue with the checkout logic that we need to uncover.

Could you please fetch the backend error logs so I can see exactly what Prisma error code is being thrown? 

**Please run this command on your server and share the output:**
```bash
sudo cat /opt/vegamart/current/logs/backend-error.log | tail -n 20
```

Once I see the exact error code (like `P2000` or `P2011`), I'll know exactly what to fix!
