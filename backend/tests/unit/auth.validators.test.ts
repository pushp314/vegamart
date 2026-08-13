import {
  changePasswordSchema,
  loginSchema,
  loginWithOtpSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../../src/validators/auth.validators";

describe("auth validators", () => {
  describe("registerSchema", () => {
    it("accepts a valid customer registration", () => {
      const result = registerSchema.safeParse({
        name: "Asha Sharma",
        email: "  ASHA@Example.COM ",
        password: "StrongPass1!",
        phone: "+919876543210",
        role: "customer",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("asha@example.com");
        expect(result.data.name).toBe("Asha Sharma");
      }
    });

    it("rejects a weak password", () => {
      const result = registerSchema.safeParse({
        name: "Asha",
        email: "asha@example.com",
        password: "weak",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("password"))).toBe(true);
      }
    });

    it("rejects a non-self-service role", () => {
      const result = registerSchema.safeParse({
        name: "Asha",
        email: "asha@example.com",
        password: "StrongPass1!",
        role: "super_admin",
      });
      expect(result.success).toBe(false);
    });

    it("rejects vendor or delivery self-registration", () => {
      const vendor = registerSchema.safeParse({
        name: "Asha",
        email: "vendor@example.com",
        password: "StrongPass1!",
        role: "vendor",
      });
      const delivery = registerSchema.safeParse({
        name: "Asha",
        email: "delivery@example.com",
        password: "StrongPass1!",
        role: "delivery",
      });
      expect(vendor.success).toBe(false);
      expect(delivery.success).toBe(false);
    });

    it("rejects an invalid phone number", () => {
      const result = registerSchema.safeParse({
        name: "Asha",
        email: "asha@example.com",
        password: "StrongPass1!",
        phone: "123abc",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("normalizes the email and requires a password", () => {
      const ok = loginSchema.safeParse({ email: "  ASHA@EXAMPLE.com ", password: "StrongPass1!" });
      expect(ok.success).toBe(true);
      if (ok.success) expect(ok.data.email).toBe("asha@example.com");

      const missing = loginSchema.safeParse({ email: "asha@example.com" });
      expect(missing.success).toBe(false);
    });
  });

  describe("loginWithOtpSchema", () => {
    it("requires a 6 digit otp", () => {
      expect(loginWithOtpSchema.safeParse({ email: "a@b.com", otp: "123456" }).success).toBe(true);
      expect(loginWithOtpSchema.safeParse({ email: "a@b.com", otp: "12345" }).success).toBe(false);
      expect(loginWithOtpSchema.safeParse({ email: "a@b.com", otp: "abcdef" }).success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("requires a valid otp and strong password", () => {
      expect(
        resetPasswordSchema.safeParse({ email: "a@b.com", otp: "123456", password: "StrongPass1!" }).success
      ).toBe(true);
      expect(resetPasswordSchema.safeParse({ email: "a@b.com", otp: "x", password: "StrongPass1!" }).success).toBe(
        false
      );
    });
  });

  describe("changePasswordSchema", () => {
    it("requires both current and new passwords", () => {
      expect(
        changePasswordSchema.safeParse({ current_password: "OldPass1!", new_password: "NewPass1!" }).success
      ).toBe(true);
      expect(changePasswordSchema.safeParse({ current_password: "OldPass1!" }).success).toBe(false);
    });
  });

  describe("verifyOtpSchema", () => {
    it("accepts a known purpose enum value", () => {
      const result = verifyOtpSchema.safeParse({
        identifier: "a@b.com",
        purpose: "PASSWORD_RESET",
        otp: "123456",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unknown purpose", () => {
      const result = verifyOtpSchema.safeParse({
        identifier: "a@b.com",
        purpose: "NOT_A_PURPOSE",
        otp: "123456",
      });
      expect(result.success).toBe(false);
    });
  });
});
