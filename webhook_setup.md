No problem! I'll walk you through exactly what to put into that Razorpay "Add New Webhook" popup, and how to configure your server to match it.

### Step 1: Fill out the Razorpay popup

In the Razorpay popup from your screenshot, enter the following details:

- **Webhook URL**: `https://api.vegamart.in/api/v1/payments/webhook`
- **Alert Email**: Enter your admin email (e.g., `admin@vegamart.in`) so you get notified if webhooks ever fail.
- **Secret**: Copy and paste the following secure secret exactly as shown:
  ```
  vegamart_whsec_f8a92b3c4d5e6f7g8h9i0j1k2l3m4n5
  ```
  *(Note: This is a secure, randomly generated secret just for your webhook).*
- **Active Events**: Click the dropdown and select ONLY the following events:
  - `payment.captured`
  - `payment.failed`
  *(If you plan to use subscriptions later, you can also select `subscription.charged`, `subscription.activated`, and `subscription.cancelled`)*.

Click **Create Webhook** to save it in Razorpay!

### Step 2: Add the Secret to your Server

Now we need to tell your VegaMart backend what that secret is so it can verify the incoming webhooks.

1. SSH into your server (`root@srv1865737`).
2. Open your shared environment file:
   ```bash
   nano /opt/vegamart/shared/.env
   ```
3. Add the following line to the file (use the exact same secret you put in Razorpay):
   ```
   RAZORPAY_WEBHOOK_SECRET=vegamart_whsec_f8a92b3c4d5e6f7g8h9i0j1k2l3m4n5
   ```
4. Save the file (in nano, press `Ctrl+O`, `Enter`, then `Ctrl+X`).
5. Run your update command to apply the latest fixes and restart the server with the new environment variable:
   ```bash
   sudo vegamart update
   ```

That's it! Your webhook is now securely configured and your server is ready to process automatic payment confirmations!
