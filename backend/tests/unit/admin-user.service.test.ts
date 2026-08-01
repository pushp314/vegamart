import { adminUserService } from "../../src/services/admin-user.service";

jest.mock("../../src/repositories/user.repository", () => ({
  listUsersAdmin: jest.fn(),
  findByIdAdmin: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  softDelete: jest.fn(),
  restore: jest.fn(),
  update: jest.fn(),
  updatePassword: jest.fn(),
  changeRole: jest.fn(),
}));

jest.mock("../../src/repositories/session.repository", () => ({
  revokeAllForUser: jest.fn(),
}));

jest.mock("../../src/repositories/refresh-token.repository", () => ({
  revokeAllForUser: jest.fn(),
}));

jest.mock("../../src/repositories/role.repository", () => ({
  findBySlug: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/utils/password", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed"),
  verifyPassword: jest.fn().mockResolvedValue(false),
}));

import * as userRepo from "../../src/repositories/user.repository";
import * as sessionRepo from "../../src/repositories/session.repository";
import * as roleRepo from "../../src/repositories/role.repository";

const repo = userRepo as jest.Mocked<typeof userRepo>;
const mockSessionRepo = sessionRepo as jest.Mocked<typeof sessionRepo>;
const mockRoleRepo = roleRepo as jest.Mocked<typeof roleRepo>;

const mockReq = { user: { id: "admin-1" } } as any;

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    role_id: "r1",
    name: "Test User",
    email: "user@example.com",
    phone: null,
    password_hash: "$2a$secret",
    status: "ACTIVE",
    is_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("admin user service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sanitizes password_hash from suspend response", async () => {
    repo.findById.mockResolvedValue(makeUser() as any);
    repo.updateStatus.mockResolvedValue(makeUser({ status: "SUSPENDED" }) as any);

    const result = (await adminUserService.suspend("admin-1", "u1", null, mockReq)) as any;

    expect(result.status).toBe("SUSPENDED");
    expect(result).not.toHaveProperty("password_hash");
    expect(mockSessionRepo.revokeAllForUser).toHaveBeenCalledWith("u1");
  });

  it("prevents suspending your own account", async () => {
    repo.findById.mockResolvedValue(makeUser({ id: "admin-1" }) as any);

    await expect(adminUserService.suspend("admin-1", "admin-1", null, mockReq)).rejects.toMatchObject({
      code: "SELF_ACTION",
    });
  });

  it("resets a password and forces logout", async () => {
    repo.findById.mockResolvedValue(makeUser() as any);
    repo.update.mockResolvedValue(makeUser() as any);
    repo.updatePassword.mockResolvedValue(makeUser() as any);

    const result = await adminUserService.resetPassword("admin-1", "u1", "NewPass@123", mockReq);

    expect(repo.updatePassword).toHaveBeenCalledWith(
      "u1",
      "hashed",
      ["$2a$secret"]
    );
    expect(repo.update).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ failed_login_attempts: 0 })
    );
    expect(result).toEqual({ success: true });
  });

  it("changes a user role to a known role", async () => {
    repo.findById.mockResolvedValue(makeUser() as any);
    mockRoleRepo.findBySlug.mockResolvedValue({ id: "r2", slug: "vendor", name: "Vendor" });
    repo.changeRole.mockResolvedValue(makeUser({ role_id: "r2" }) as any);

    const result = (await adminUserService.changeRole("admin-1", "u1", "vendor", mockReq)) as any;

    expect(repo.changeRole).toHaveBeenCalledWith("u1", "r2");
    expect(result).not.toHaveProperty("password_hash");
  });

  it("rejects an unknown role", async () => {
    repo.findById.mockResolvedValue(makeUser() as any);
    mockRoleRepo.findBySlug.mockResolvedValue(null);

    await expect(adminUserService.changeRole("admin-1", "u1", "nope", mockReq)).rejects.toMatchObject({
      code: "UNKNOWN_ROLE",
    });
  });

  it("throws NOT_FOUND for a missing user", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(adminUserService.suspend("admin-1", "u1", null, mockReq)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
