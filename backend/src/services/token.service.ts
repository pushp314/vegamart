import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken";

import { env } from "../config";
import {
  ACCESS_TOKEN_TYPE,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_HEX_LENGTH,
} from "../constants/auth";
import type { JwtAccessPayload } from "../types";
import { ApiError } from "../utils/ApiError";
import { generateOpaqueToken, sha256Hex } from "../utils/crypto";
import { HttpStatus } from "../utils/httpStatus";

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: string;
  session_id: string;
  guest?: boolean;
}

export interface RefreshTokenRecord {
  token: string;
  token_hash: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  const payload: JwtAccessPayload = {
    sub: claims.sub,
    email: claims.email,
    role: claims.role,
    session_id: claims.session_id,
    type: ACCESS_TOKEN_TYPE,
    ...(claims.guest ? { guest: true } : {}),
  };

  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };

  if (!env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  const options: VerifyOptions = {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };

  if (!env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, options);
    if (typeof decoded === "string") {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid token type.", { code: "INVALID_TOKEN" });
    }
    const payload = decoded as JwtAccessPayload;
    if (payload.type !== ACCESS_TOKEN_TYPE) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid token type.", { code: "INVALID_TOKEN" });
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Access token expired.", { code: "TOKEN_EXPIRED" });
    }
    throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid or malformed access token.", {
      code: "INVALID_TOKEN",
    });
  }
}

export function createRefreshToken(): RefreshTokenRecord {
  const token = generateOpaqueToken(REFRESH_TOKEN_BYTES);
  return {
    token,
    token_hash: sha256Hex(token),
  };
}

export function hashRefreshToken(token: string): string {
  return sha256Hex(token);
}

export function isValidRefreshTokenFormat(token: string): boolean {
  return typeof token === "string" && new RegExp(`^[a-f0-9]{${REFRESH_TOKEN_HEX_LENGTH}}$`).test(token);
}
