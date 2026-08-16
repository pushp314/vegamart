I found the real root cause! The frontend payment method was a red herring (the API automatically transforms `upi` to `RAZORPAY` before it hits the database, so that was perfectly fine).

The actual issue was discovered in your PM2 `backend-out.log`:
```
Invalid prisma.order.create() invocation: Unknown argument `delivery_note`
```

Even though the database migration correctly applied and added the `delivery_note` column to PostgreSQL, **the Prisma Client generated in your node_modules was outdated!** This happened because your `deploy.sh` script installs dependencies with `npm install`, but there was no `postinstall` script to automatically regenerate the Prisma Client. As a result, the backend was still using the old schema definition without `delivery_note`, causing it to crash when trying to save the order!

**The Fix:**
I have updated your `deploy/deploy.sh` script to explicitly run `npm run prisma:generate` right after installing the backend dependencies. This ensures that the newly generated Prisma Client will always perfectly match the latest schema.

I also saw that you killed the process running on port 8080 manually. Don't worry, PM2 is managing it! 

**Please run this command to deploy the fix:**
```bash
sudo vegamart update
```

This will run the updated deploy script, correctly generate the Prisma Client with the `delivery_note` field, and cleanly restart your PM2 instances. 
Once it's done, your checkout should work flawlessly!
