import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type HomeRole = "customer" | "vendor" | "delivery" | "admin" | "super_admin";

export function homePathForRole(role?: HomeRole | null): string {
  switch (role) {
    case "vendor":
      return "/vendor";
    case "delivery":
      return "/delivery";
    case "admin":
    case "super_admin":
      return "/admin";
    default:
      return "/";
  }
}

export function getSafeRedirect(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("redirect");
    if (!raw) return null;
    if (!raw.startsWith("/") || raw.startsWith("//")) return null;
    return raw;
  } catch {
    return null;
  }
}
