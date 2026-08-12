-- Add delivery OTP expiration and bounded failed-attempt tracking.
-- otp_code is cleared after successful verification (replay prevention),
-- otp_expires_at bounds the OTP lifetime and otp_attempts caps brute-force guesses.
ALTER TABLE "orders"
  ADD COLUMN     "otp_expires_at" TIMESTAMP(3),
  ADD COLUMN     "otp_attempts" INTEGER NOT NULL DEFAULT 0;
