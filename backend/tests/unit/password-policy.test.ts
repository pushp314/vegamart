jest.mock("../../src/utils/password", () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock("../../src/config/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn(), child: jest.fn() },
}));

jest.mock("../../src/config", () => ({
  env: {
    PASSWORD_HISTORY_LIMIT: 2,
    PASSWORD_EXPIRY_DAYS: 90,
  },
  isTest: true,
}));

import { checkPasswordExpiry, enforcePasswordPolicy } from "../../src/utils/password-policy";
import { ValidationError } from "../../src/utils/ApiError";
import { verifyPassword } from "../../src/utils/password";

const mockedVerify = verifyPassword as jest.Mock;

describe("password-policy", () => {
  beforeEach(() => {
    mockedVerify.mockReset();
  });

  it("appends the current hash to history and returns a valid ring", async () => {
    mockedVerify.mockResolvedValue(false);
    const { history, changed } = await enforcePasswordPolicy("h1", ["h0"], "NewPass@123");
    expect(changed).toBe(true);
    expect(history).toEqual(["h0", "h1"]);
  });

  it("rejects a password equal to the current one", async () => {
    mockedVerify.mockImplementation(async (pw: string) => pw === "SamePass@123");
    await expect(enforcePasswordPolicy("h1", [], "SamePass@123")).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a password reused from history", async () => {
    mockedVerify.mockImplementation(async (pw: string) => pw === "OldPass@123");
    await expect(enforcePasswordPolicy("h1", ["h_old"], "OldPass@123")).rejects.toBeInstanceOf(ValidationError);
  });

  it("trims history to the configured limit", async () => {
    mockedVerify.mockResolvedValue(false);
    const { history } = await enforcePasswordPolicy("h3", ["h1", "h2"], "NewPass@123");
    expect(history).toEqual(["h2", "h3"]);
  });

  it("ignores malformed history entries", async () => {
    mockedVerify.mockResolvedValue(false);
    const { history } = await enforcePasswordPolicy("h1", ["h0", 42, null], "NewPass@123");
    expect(history).toEqual(["h0", "h1"]);
  });

  it("handles an empty history array", async () => {
    mockedVerify.mockResolvedValue(false);
    const { history } = await enforcePasswordPolicy("h1", null, "NewPass@123");
    expect(history).toEqual(["h1"]);
  });

  it("checkPasswordExpiry flags an old password", async () => {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    expect(await checkPasswordExpiry(old)).toBe(true);
    const recent = new Date();
    expect(await checkPasswordExpiry(recent)).toBe(false);
  });

  it("checkPasswordExpiry is false when no changed-at timestamp", async () => {
    expect(await checkPasswordExpiry(null)).toBe(false);
    expect(await checkPasswordExpiry(undefined)).toBe(false);
  });
});
