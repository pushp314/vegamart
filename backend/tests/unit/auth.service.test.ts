import { UserStatus } from "@prisma/client";

import { authService } from "../../src/services/auth.service";
import { findByEmail } from "../../src/repositories/user.repository";
import { UnauthorizedError } from "../../src/utils/ApiError";

jest.mock("../../src/repositories/user.repository", () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  incrementLoginFailures: jest.fn(),
  resetLoginFailures: jest.fn(),
  setLastLogin: jest.fn(),
  setLocked: jest.fn(),
  updatePassword: jest.fn(),
  update: jest.fn(),
}));

jest.mock("../../src/repositories/session.repository", () => ({
  createSession: jest.fn(),
  countActive: jest.fn().mockResolvedValue(0),
  findActiveById: jest.fn(),
  revoke: jest.fn(),
  revokeAllForUser: jest.fn(),
  updateLastActivity: jest.fn(),
}));

jest.mock("../../src/repositories/refresh-token.repository", () => ({
  createRefreshToken: jest.fn(),
  findByTokenHash: jest.fn(),
  revoke: jest.fn(),
  revokeAllForSession: jest.fn(),
  revokeAllForUser: jest.fn(),
  revokeAllForUserExceptSession: jest.fn(),
  rotate: jest.fn(),
}));

jest.mock("../../src/repositories/otp.repository", () => ({
  findLatest: jest.fn(),
  createOtp: jest.fn(),
  findByHash: jest.fn(),
  markUsed: jest.fn(),
  revokeActiveFor: jest.fn(),
}));

jest.mock("../../src/repositories/role.repository", () => ({
  findBySlug: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/email.service", () => ({
  emailService: {
    sendWelcomeEmail: jest.fn(),
    sendPasswordResetOtp: jest.fn(),
    sendOtp: jest.fn(),
  },
}));

jest.mock("../../src/services/otp.service", () => ({
  generateAndStoreOtp: jest.fn(),
  verifyOtp: jest.fn(),
  otpPurposeLabel: jest.fn(),
}));

jest.mock("../../src/services/google-oauth.service", () => ({
  exchangeGoogleCode: jest.fn(),
}));

jest.mock("../../src/monitoring/security-events", () => ({
  securityEventFromReq: jest.fn(),
}));

jest.mock("../../src/utils/password", () => ({
  assertStrongPassword: jest.fn(),
  hashPassword: jest.fn().mockResolvedValue("hashed"),
  normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
  verifyPassword: jest.fn(),
}));

jest.mock("../../src/utils/password-policy", () => ({
  enforcePasswordPolicy: jest.fn().mockResolvedValue({ history: [] }),
  checkPasswordExpiry: jest.fn().mockResolvedValue(false),
}));

import { verifyPassword } from "../../src/utils/password";
import { securityEventFromReq } from "../../src/monitoring/security-events";
import {
  findByTokenHash,
  rotate as rotateRepo,
  revokeAllForSession,
  revoke as revokeToken,
  revokeAllForUserExceptSession,
} from "../../src/repositories/refresh-token.repository";
import { findActiveById, revoke as revokeSession, revokeAllForUser } from "../../src/repositories/session.repository";

const minimumUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "u1",
  email: "a@b.com",
  name: "A",
  password_hash: "h",
  status: UserStatus.ACTIVE,
  deleted_at: null,
  failed_login_attempts: 0,
  locked_until: null,
  phone: null,
  avatar_url: null,
  is_verified: false,
  provider: "local",
  created_at: new Date(),
  ...overrides,
});

function makeReq() {
  return { ip: "127.0.0.1", headers: { "user-agent": "jest" }, user: undefined } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  (verifyPassword as jest.Mock).mockResolvedValue(true);
});

const mockedCreateRefreshToken = require("../../src/repositories/refresh-token.repository")
  .createRefreshToken as jest.Mock;

function mockCreateRefreshToken() {
  mockedCreateRefreshToken.mockResolvedValue({ id: "t2", token_hash: "h2", session_id: "s1" });
}

describe("authService.login — enumeration hardening", () => {
  it("returns a generic message for an unknown email", async () => {
    (findByEmail as jest.Mock).mockResolvedValue(null);
    await expect(authService.login("a@b.com", "password", makeReq())).rejects.toThrow(
      UnauthorizedError
    );
    expect(securityEventFromReq).toHaveBeenCalled();
  });

  it("returns a generic message for a soft-deleted account", async () => {
    (findByEmail as jest.Mock).mockResolvedValue(minimumUser({ deleted_at: new Date() }));
    await expect(authService.login("a@b.com", "password", makeReq())).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("blocks an INACTIVE account with the same generic message", async () => {
    (findByEmail as jest.Mock).mockResolvedValue(minimumUser({ status: UserStatus.INACTIVE }));
    await expect(authService.login("a@b.com", "password", makeReq())).rejects.toThrow(
      UnauthorizedError
    );
    expect(securityEventFromReq).toHaveBeenCalled();
  });

  it("blocks a suspended account with a generic message", async () => {
    (findByEmail as jest.Mock).mockResolvedValue(minimumUser({ status: UserStatus.SUSPENDED }));
    await expect(authService.login("a@b.com", "password", makeReq())).rejects.toThrow(
      UnauthorizedError
    );
  });
});

describe("authService.refresh — atomic rotation & reuse detection", () => {
  const activeSession = { id: "s1", user_id: "u1", is_active: true };
  const activeUser = {
    id: "u1",
    email: "a@b.com",
    name: "A",
    role_id: "r1",
    phone: null,
    avatar_url: null,
    is_verified: false,
    provider: "local",
    created_at: new Date(),
    deleted_at: null,
    status: UserStatus.ACTIVE,
    role: { id: "r1", slug: "customer", name: "Customer", role_permissions: [] },
    vendor_profile: null,
    delivery_profile: null,
  };
  const validToken = "a".repeat(96);
  const validRecord = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: "t1",
    user_id: "u1",
    session_id: "s1",
    token_hash: "h",
    expires_at: new Date(Date.now() + 100000),
    revoked_at: null,
    replaced_by: null,
    ip_address: null,
    user_agent: null,
    ...overrides,
  });

  it("rotates atomically and issues a new access token", async () => {
    mockCreateRefreshToken();
    (findByTokenHash as jest.Mock).mockResolvedValue(validRecord());
    (findActiveById as jest.Mock).mockResolvedValue(activeSession);
    (require("../../src/services/auth.service") ? {} : {});
    // findUserById is mocked via the user repo mock
    const { findById } = require("../../src/repositories/user.repository") as {
      findById: jest.Mock;
    };
    findById.mockResolvedValue(activeUser);
    (rotateRepo as jest.Mock).mockResolvedValue(true);
    (revokeToken as jest.Mock).mockResolvedValue({});

    const result = await authService.refresh(validToken, makeReq());
    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
    expect(result.user).toBeDefined();
  });

  it("revokes the family and rejects when the token was already rotated", async () => {
    (findByTokenHash as jest.Mock).mockResolvedValue(validRecord({ replaced_by: "t2" }));
    await expect(authService.refresh(validToken, makeReq())).rejects.toThrow(UnauthorizedError);
    expect(revokeSession).toHaveBeenCalledWith("s1");
    expect(revokeAllForSession).toHaveBeenCalledWith("s1");
  });

  it("revokes the family when the atomic rotate loses the race", async () => {
    mockCreateRefreshToken();
    (findByTokenHash as jest.Mock).mockResolvedValue(validRecord());
    (findActiveById as jest.Mock).mockResolvedValue(activeSession);
    const { findById } = require("../../src/repositories/user.repository") as {
      findById: jest.Mock;
    };
    findById.mockResolvedValue(activeUser);
    (rotateRepo as jest.Mock).mockResolvedValue(false);

    await expect(authService.refresh(validToken, makeReq())).rejects.toThrow(UnauthorizedError);
    expect(revokeSession).toHaveBeenCalledWith("s1");
    expect(revokeAllForSession).toHaveBeenCalledWith("s1");
  });

  it("rejects a revoked token", async () => {
    (findByTokenHash as jest.Mock).mockResolvedValue(validRecord({ revoked_at: new Date() }));
    await expect(authService.refresh(validToken, makeReq())).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a token for a user who is no longer active", async () => {
    (findByTokenHash as jest.Mock).mockResolvedValue(validRecord());
    (findActiveById as jest.Mock).mockResolvedValue(activeSession);
    const { findById } = require("../../src/repositories/user.repository") as {
      findById: jest.Mock;
    };
    findById.mockResolvedValue({ ...activeUser, status: UserStatus.SUSPENDED });
    await expect(authService.refresh(validToken, makeReq())).rejects.toThrow(UnauthorizedError);
  });
});

describe("authService.changePassword — session revocation", () => {
  it("revokes other sessions/tokens but keeps the current session", async () => {
    const { findById } = require("../../src/repositories/user.repository") as {
      findById: jest.Mock;
    };
    findById.mockResolvedValue(minimumUser());
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    const authUser = {
      id: "u1",
      email: "a@b.com",
      name: "A",
      role: "customer",
      role_id: "r1",
      permissions: [],
      is_verified: false,
      session_id: "current-session",
    };

    await authService.changePassword(authUser, "old", "NewPassword1!", makeReq());

    expect(revokeAllForUser).toHaveBeenCalledWith("u1", "current-session");
    expect(revokeAllForUserExceptSession).toHaveBeenCalledWith("u1", "current-session");
  });
});