import type { Request } from "express";

export interface DeviceInfo {
  device_name: string;
  device_type: string;
  user_agent: string;
  ip_address: string;
}

export function parseDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.headers["user-agent"] ?? "";
  const ipAddress =
    (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()) ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";

  const ua = userAgent.toLowerCase();
  let deviceType = "other";
  let deviceName = "Unknown Device";

  if (/iphone|ipad|ipod/.test(ua)) {
    deviceType = "mobile";
    deviceName = "Apple iOS Device";
  } else if (/android/.test(ua)) {
    deviceType = "mobile";
    deviceName = "Android Device";
  } else if (/windows/.test(ua)) {
    deviceType = "desktop";
    deviceName = "Windows Device";
  } else if (/macintosh|mac os x/.test(ua)) {
    deviceType = "desktop";
    deviceName = "Apple Mac";
  } else if (/linux/.test(ua)) {
    deviceType = "desktop";
    deviceName = "Linux Device";
  }

  const browserMatch = /(chrome|firefox|safari|edg|opera|vivaldi|brave)[/ ]([\d.]+)/.exec(ua);
  if (browserMatch) {
    const raw = browserMatch[1] ?? "";
    const browser = raw === "edg" ? "Edge" : raw === "opera" ? "Opera" : raw.charAt(0).toUpperCase() + raw.slice(1);
    deviceName = `${deviceName} - ${browser}`;
  }

  return {
    device_name: deviceName,
    device_type: deviceType,
    user_agent: userAgent,
    ip_address: ipAddress,
  };
}
