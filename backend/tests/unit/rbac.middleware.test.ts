import type { NextFunction, Request, Response } from "express";

import { requirePermission, requireRole } from "../../src/middlewares/rbac.middleware";
import { ForbiddenError, UnauthorizedError } from "../../src/utils/ApiError";

jest.mock("../../src/repositories/user.repository", () => ({
  findById: jest.fn(),
}));

import { findById as findUserById } from "../../src/repositories/user.repository";

const mockedFindUserById = findUserById as jest.Mock;

function makeReq(user?: Partial<Express.Request["user"]>): Request {
  return { user } as Request;
}

function makeRes() {
  const res = {} as Response;
  return res;
}

function expectError(next: jest.Mock, type: unknown) {
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toBeInstanceOf(type as never);
}

describe("rbac middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireRole", () => {
    it("passes when the user role is allowed", () => {
      const next = jest.fn();
      requireRole("admin", "super_admin")(makeReq({ role: "admin" }), makeRes(), next as NextFunction);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeUndefined();
    });

    it("forbids when the role is not allowed", () => {
      const next = jest.fn();
      requireRole("admin")(makeReq({ role: "customer" }), makeRes(), next as NextFunction);
      expectError(next, ForbiddenError);
    });

    it("rejects when there is no user", () => {
      const next = jest.fn();
      requireRole("admin")(makeReq(), makeRes(), next as NextFunction);
      expectError(next, UnauthorizedError);
    });
  });

  describe("requirePermission", () => {
    it("passes when the user already carries the permission", async () => {
      const next = jest.fn();
      const req = makeReq({ permissions: ["products:create"], role_id: "r1" });
      await requirePermission("products:create")(req, makeRes(), next as NextFunction);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeUndefined();
      expect(mockedFindUserById).not.toHaveBeenCalled();
    });

    it("hydrates permissions from the repository and passes", async () => {
      mockedFindUserById.mockResolvedValue({
        id: "u1",
        role_id: "r1",
        role: { slug: "vendor", role_permissions: [{ permission: { slug: "products:create" } }] },
      });
      const next = jest.fn();
      const req = makeReq({ id: "u1", role: "vendor", permissions: [] });
      await requirePermission("products:create")(req, makeRes(), next as NextFunction);
      expect(mockedFindUserById).toHaveBeenCalledWith("u1", { role: true });
      expect(next.mock.calls[0][0]).toBeUndefined();
    });

    it("forbids when the permission is missing", async () => {
      mockedFindUserById.mockResolvedValue({
        id: "u1",
        role_id: "r1",
        role: { slug: "customer", role_permissions: [] },
      });
      const next = jest.fn();
      const req = makeReq({ id: "u1", role: "customer", permissions: [] });
      await requirePermission("products:create")(req, makeRes(), next as NextFunction);
      expectError(next, ForbiddenError);
    });

    it("rejects when the user record cannot be found", async () => {
      mockedFindUserById.mockResolvedValue(null);
      const next = jest.fn();
      const req = makeReq({ id: "u1", role: "customer", permissions: [] });
      await requirePermission("products:create")(req, makeRes(), next as NextFunction);
      expectError(next, UnauthorizedError);
    });
  });
});
