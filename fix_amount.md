Ah, you got a `400 (Bad Request)` on `/payments/verify`!

I've found exactly why that happened.

**The Cause:**
When a customer chooses "Self Pickup", the vendor might require only an advance percentage (like 10%) to be paid online via Razorpay, while the rest is paid at the shop.
The Razorpay widget correctly launched for `₹2.00` (which is the advance amount of the full order).
However, when the payment succeeds and the frontend sends the Razorpay signature back to the backend to verify, the backend was strictly comparing the Razorpay captured amount against the **total order amount** instead of the **expected advance payment amount**. Since `₹2.00` didn't equal the total order cost, the backend instantly rejected the payment as a "Payment Amount Mismatch" (400 Bad Request) as a security measure!

**The Fix:**
I have updated `backend/src/services/payment.service.ts` to correctly compare the Razorpay captured amount against the exact `payment.amount` that was requested (the 10% advance), rather than the entire order total.

I've committed this fix. **Please run the deployment command again:**
```bash
sudo vegamart update
```

Once that's done, your payment verification will succeed and the order will be confirmed! Let me know when it goes through!
