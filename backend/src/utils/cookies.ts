import type { Response } from "express";

import { env, isProduction } from "../config";
import { REFRESH_TOKEN_COOKIE } from "../constants";
import { parseDurationToMs } from "./time";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction || env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE as "lax" | "strict" | "none",
  path: "/",
};

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions,
    maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...baseCookieOptions,
    maxAge: 0,
  });
}
