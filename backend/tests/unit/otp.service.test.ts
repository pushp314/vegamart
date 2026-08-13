import { generateAndStoreOtp, verifyOtp } from "../../src/services/otp.service";
import {
  createOtp,
  findLatest,
  incrementAttemptsIfBelow,
  markUsed,
  revokeActiveFor,
} from "../../src/repositories/otp.repository";
import { ValidationError } from "../../src/utils/ApiError";

jest.mock("../../src/repositories/otp.repository");
jest.mock("../../src/utils/crypto");
jest.mock("../../src/config", () => ({
  env: { OTP_RESEND_COOLDOWN_SECONDS: 60 },
}));

import { generateOtp, safeEqual, sha256Hex } from "../../src/utils/crypto";

const mocked = {
  findLatest: findLatest as jest.MockedFunction<typeof findLatest>,
  createOtp: createOtp as jest.MockedFunction<typeof createOtp>,
  markUsed: markUsed as jest.MockedFunction<typeof markUsed>,
  incrementAttemptsIfBelow: incrementAttemptsIfBelow as jest.MockedFunction<typeof incrementAttemptsIfBelow>,
  revokeActiveFor: revokeActiveFor as jest.MockedFunction<typeof revokeActiveFor>,
  generateOtp: generateOtp as jest.MockedFunction<typeof generateOtp>,
  safeEqual: safeEqual as jest.MockedFunction<typeof safeEqual>,
  sha256Hex: sha256Hex as jest.MockedFunction<typeof sha256Hex>,
};

beforeEach(() => {
  jest.clearAllMocks();
  mocked.generateOtp.mockReturnValue("123456");
  mocked.sha256Hex.mockReturnValue("hashed");
  mocked.safeEqual.mockImplementation((a: string, b: string) => a === b);
  mocked.markUsed.mockResolvedValue({} as never);
  mocked.incrementAttemptsIfBelow.mockResolvedValue(true);
  mocked.createOtp.mockResolvedValue({} as never);
  mocked.revokeActiveFor.mockResolvedValue({} as never);
});

function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();
  return {
    id: "otp-1",
    identifier: "a@b.com",
    purpose: "LOGIN",
    otp_hash: "hashed",
    is_used: false,
    created_at: new Date(now),
    expires_at: new Date(now + 600000),
    attempts: 0,
    ...overrides,
  };
}

describe("otp.service verifyOtp", () => {
  it("accepts a correct active code", async () => {
    mocked.findLatest.mockResolvedValue(makeRecord() as never);
    await verifyOtp("a@b.com", "LOGIN" as never, "123456");
    expect(mocked.markUsed).toHaveBeenCalled();
  });

  it("rejects a used code", async () => {
    mocked.findLatest.mockResolvedValue(makeRecord({ is_used: true }) as never);
    await expect(verifyOtp("a@b.com", "LOGIN" as never, "123456")).rejects.toThrow(ValidationError);
  });

  it("rejects an expired code", async () => {
    mocked.findLatest.mockResolvedValue(
      makeRecord({ expires_at: new Date(Date.now() - 1000) }) as never
    );
    await expect(verifyOtp("a@b.com", "LOGIN" as never, "123456")).rejects.toThrow(ValidationError);
  });

  it("throws OTP_ATTEMPTS_EXCEEDED after max attempts", async () => {
    mocked.findLatest.mockResolvedValue(makeRecord({ attempts: 5 }) as never);
    await expect(verifyOtp("a@b.com", "LOGIN" as never, "123456")).rejects.toMatchObject({
      code: "OTP_ATTEMPTS_EXCEEDED",
    });
  });

  it("increments attempts on a wrong code", async () => {
    mocked.findLatest.mockResolvedValue(makeRecord() as never);
    mocked.safeEqual.mockReturnValue(false);
    await expect(verifyOtp("a@b.com", "LOGIN" as never, "999999")).rejects.toThrow(ValidationError);
    expect(mocked.incrementAttemptsIfBelow).toHaveBeenCalledWith("otp-1", 5);
  });

  it("throws OTP_ATTEMPTS_EXCEEDED when the atomic increment is refused", async () => {
    mocked.findLatest.mockResolvedValue(makeRecord({ attempts: 4 }) as never);
    mocked.safeEqual.mockReturnValue(false);
    mocked.incrementAttemptsIfBelow.mockResolvedValue(false);
    await expect(verifyOtp("a@b.com", "LOGIN" as never, "999999")).rejects.toMatchObject({
      code: "OTP_ATTEMPTS_EXCEEDED",
    });
    expect(mocked.markUsed).not.toHaveBeenCalled();
  });
});

describe("otp.service generateAndStoreOtp cooldown", () => {
  it("generates a new code when there is no previous record", async () => {
    mocked.findLatest.mockResolvedValue(null);
    const result = await generateAndStoreOtp("a@b.com", "LOGIN" as never);
    expect(result.plain).toBe("123456");
    expect(mocked.createOtp).toHaveBeenCalled();
    expect(mocked.revokeActiveFor).toHaveBeenCalled();
  });

  it("throws a resend cooldown error when a fresh code exists", async () => {
    mocked.findLatest.mockResolvedValue(
      makeRecord({ created_at: new Date(Date.now() - 5000) }) as never
    );
    await expect(generateAndStoreOtp("a@b.com", "LOGIN" as never)).rejects.toMatchObject({
      code: "OTP_RESEND_COOLDOWN",
    });
    expect(mocked.createOtp).not.toHaveBeenCalled();
  });

  it("allows a new code once the cooldown has elapsed", async () => {
    mocked.findLatest.mockResolvedValue(
      makeRecord({ created_at: new Date(Date.now() - 65000) }) as never
    );
    const result = await generateAndStoreOtp("a@b.com", "LOGIN" as never);
    expect(result.plain).toBe("123456");
    expect(mocked.createOtp).toHaveBeenCalled();
  });

  it("allows a new code when the previous code is already used", async () => {
    mocked.findLatest.mockResolvedValue(
      makeRecord({ is_used: true, created_at: new Date(Date.now() - 5000) }) as never
    );
    const result = await generateAndStoreOtp("a@b.com", "LOGIN" as never);
    expect(result.plain).toBe("123456");
    expect(mocked.createOtp).toHaveBeenCalled();
  });
});