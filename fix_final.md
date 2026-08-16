The reason your payment was spinning for 2+ minutes in the screenshot is actually visible right in the console errors you shared: `401 Unauthorized`. 

Your login session (access token) simply expired while you were testing for the past hour! Because your session expired, when the frontend tried to send the payment signature to the backend to verify it, the backend rejected it for being unauthorized, causing the verification flow to hang.

**I have also just discovered and fixed a MASSIVE bug before you set up your webhook!**
The backend was incorrectly coded to use the `RAZORPAY_WEBHOOK_SECRET` to verify the frontend signature! If you had set up the webhook secret, **all** frontend checkouts would have permanently broken with "Invalid Signature". I have just committed a fix for this so that it correctly uses the `RAZORPAY_KEY_SECRET` for the frontend verification and the webhook secret strictly for webhooks.

### What you need to do now:

**1. Deploy all the fixes to the server:**
```bash
sudo vegamart update
```

**2. Refresh your browser & Log in again:**
Since your session expired, refresh the VegaMart page and log back in so you have a fresh token.

**3. How to set up the Razorpay Webhook:**
1. Go to your **Razorpay Dashboard** -> Account & Settings -> Webhooks.
2. Click **Add New Webhook**.
3. **Webhook URL:** `https://api.vegamart.in/api/v1/payments/webhook`
4. **Secret:** You must generate a random string (e.g. `my_super_secret_string`). 
   *IMPORTANT:* You must add this exact string to your `/opt/vegamart/shared/.env` file on your server as `RAZORPAY_WEBHOOK_SECRET=my_super_secret_string`, and then restart the backend (`pm2 restart vegamart-backend`).
5. **Active Events to subscribe to:**
   - `payment.captured`
   - `payment.failed`
   - `order.paid`

Once you've done this, run your test checkout again with your fresh login session, and it will confirm the order instantly!
