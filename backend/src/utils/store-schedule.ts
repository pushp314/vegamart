export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export interface StoreDaySchedule {
  isOpen: boolean;
  open: string;  // "HH:mm" 24h format, e.g. "10:00"
  close: string; // "HH:mm" 24h format, e.g. "19:00"
}

export interface StoreScheduleConfig {
  timezone?: string;
  useSameHours?: boolean;
  defaultOpen?: string;
  defaultClose?: string;
  days: Record<DayOfWeek, StoreDaySchedule>;
}

export type ManualOverrideStatus =
  | "NONE"
  | "FORCE_OPEN"
  | "FORCE_CLOSE"
  | "TEMPORARY_CLOSE";

export interface StoreAvailabilityResult {
  isOpen: boolean;
  reason: "MANUAL" | "SCHEDULE" | "FORCE_OPEN" | "FORCE_CLOSE" | "TEMPORARY_CLOSE";
  statusText: string;
  displayMessage: string;
  nextOpenTime: string | null;
  nextCloseTime: string | null;
  autoScheduleEnabled: boolean;
  manualOverrideStatus: ManualOverrideStatus | null;
  manualOverrideUntil: Date | null;
  todaySchedule: StoreDaySchedule | null;
}

export function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(":")) return time24 || "";
  const parts = time24.split(":");
  const hStr = parts[0] ?? "0";
  const mStr = parts[1] ?? "0";
  let hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mPad = String(minutes).padStart(2, "0");
  return `${hours}:${mPad} ${ampm}`;
}

export function parseMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(":")) return 0;
  const parts = timeStr.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "0";
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}

export function getDefaultSchedule(defaultOpen = "10:00", defaultClose = "19:00"): StoreScheduleConfig {
  const days = {} as Record<DayOfWeek, StoreDaySchedule>;
  for (const day of DAYS_OF_WEEK) {
    days[day] = {
      isOpen: true,
      open: defaultOpen,
      close: defaultClose,
    };
  }
  return {
    timezone: "Asia/Kolkata",
    useSameHours: true,
    defaultOpen,
    defaultClose,
    days,
  };
}

export function normalizeStoreSchedule(raw: any): StoreScheduleConfig {
  const def = getDefaultSchedule();
  if (!raw || typeof raw !== "object") return def;

  const timezone = typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone.trim() : "Asia/Kolkata";
  const useSameHours = raw.useSameHours !== false;
  const defaultOpen = typeof raw.defaultOpen === "string" && raw.defaultOpen ? raw.defaultOpen : "10:00";
  const defaultClose = typeof raw.defaultClose === "string" && raw.defaultClose ? raw.defaultClose : "19:00";

  const rawDays = raw.days && typeof raw.days === "object" ? raw.days : {};
  const days = {} as Record<DayOfWeek, StoreDaySchedule>;

  for (const day of DAYS_OF_WEEK) {
    const rawDay = rawDays[day];
    if (rawDay && typeof rawDay === "object") {
      days[day] = {
        isOpen: Boolean(rawDay.isOpen ?? true),
        open: typeof rawDay.open === "string" && rawDay.open ? rawDay.open : defaultOpen,
        close: typeof rawDay.close === "string" && rawDay.close ? rawDay.close : defaultClose,
      };
    } else {
      days[day] = {
        isOpen: true,
        open: defaultOpen,
        close: defaultClose,
      };
    }
  }

  return {
    timezone,
    useSameHours,
    defaultOpen,
    defaultClose,
    days,
  };
}

export interface VendorScheduleInput {
  is_open?: boolean;
  auto_schedule_enabled?: boolean | null;
  store_schedule?: any;
  manual_override_status?: string | null;
  manual_override_until?: Date | string | null;
}

export function calculateStoreAvailability(
  vendor: VendorScheduleInput,
  referenceDate = new Date()
): StoreAvailabilityResult {
  const autoScheduleEnabled = Boolean(vendor.auto_schedule_enabled);
  const manualIsOpen = Boolean(vendor.is_open);

  // If automated schedule is disabled, rely purely on manual is_open toggle
  if (!autoScheduleEnabled) {
    return {
      isOpen: manualIsOpen,
      reason: "MANUAL",
      statusText: manualIsOpen ? "Store is Open" : "Store is Closed",
      displayMessage: manualIsOpen
        ? "Store is open for orders."
        : "This store is currently closed.",
      nextOpenTime: null,
      nextCloseTime: null,
      autoScheduleEnabled: false,
      manualOverrideStatus: null,
      manualOverrideUntil: null,
      todaySchedule: null,
    };
  }

  const schedule = normalizeStoreSchedule(vendor.store_schedule);
  const tz = schedule.timezone || "Asia/Kolkata";

  // Check manual override
  const overrideStatus = (vendor.manual_override_status || "NONE").toUpperCase() as ManualOverrideStatus;
  const overrideUntil = vendor.manual_override_until ? new Date(vendor.manual_override_until) : null;
  const isOverrideActive =
    overrideStatus !== "NONE" &&
    (!overrideUntil || referenceDate.getTime() < overrideUntil.getTime());

  if (isOverrideActive) {
    if (overrideStatus === "FORCE_OPEN") {
      return {
        isOpen: true,
        reason: "FORCE_OPEN",
        statusText: "Store is Open (Manual)",
        displayMessage: "Store is open now (manual override).",
        nextOpenTime: null,
        nextCloseTime: overrideUntil ? formatTime12h(formatTimeInTz(overrideUntil, tz)) : null,
        autoScheduleEnabled: true,
        manualOverrideStatus: "FORCE_OPEN",
        manualOverrideUntil: overrideUntil,
        todaySchedule: null,
      };
    }

    if (overrideStatus === "FORCE_CLOSE" || overrideStatus === "TEMPORARY_CLOSE") {
      const untilStr = overrideUntil ? formatTime12h(formatTimeInTz(overrideUntil, tz)) : null;
      return {
        isOpen: false,
        reason: overrideStatus,
        statusText: overrideStatus === "TEMPORARY_CLOSE" ? "Temporarily Closed" : "Store is Closed (Manual)",
        displayMessage: overrideStatus === "TEMPORARY_CLOSE" && untilStr
          ? `This store is temporarily closed. Opens at ${untilStr}.`
          : "This store is currently closed.",
        nextOpenTime: untilStr,
        nextCloseTime: null,
        autoScheduleEnabled: true,
        manualOverrideStatus: overrideStatus,
        manualOverrideUntil: overrideUntil,
        todaySchedule: null,
      };
    }
  }

  // Calculate current day and time in vendor's timezone
  const { dayOfWeek: currentDay, minutes: currentMinutes } = getDayAndTimeInTz(referenceDate, tz);
  const currentDayIndex = Math.max(0, DAYS_OF_WEEK.indexOf(currentDay));
  const todaySchedule = schedule.days[currentDay] || { isOpen: true, open: "10:00", close: "19:00" };

  // If today is scheduled open
  if (todaySchedule.isOpen) {
    const openMinutes = parseMinutes(todaySchedule.open);
    const closeMinutes = parseMinutes(todaySchedule.close);

    // Standard day shift: e.g. 10:00 to 19:00
    if (closeMinutes > openMinutes) {
      if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
        const closeFormatted = formatTime12h(todaySchedule.close);
        return {
          isOpen: true,
          reason: "SCHEDULE",
          statusText: "Store is Open",
          displayMessage: `Store is open now • Closes at ${closeFormatted}`,
          nextOpenTime: null,
          nextCloseTime: closeFormatted,
          autoScheduleEnabled: true,
          manualOverrideStatus: null,
          manualOverrideUntil: null,
          todaySchedule,
        };
      } else if (currentMinutes < openMinutes) {
        const openFormatted = formatTime12h(todaySchedule.open);
        return {
          isOpen: false,
          reason: "SCHEDULE",
          statusText: "Store is Closed",
          displayMessage: `This store is currently closed. Opens at ${openFormatted}.`,
          nextOpenTime: openFormatted,
          nextCloseTime: null,
          autoScheduleEnabled: true,
          manualOverrideStatus: null,
          manualOverrideUntil: null,
          todaySchedule,
        };
      }
      // currentMinutes >= closeMinutes falls through to find next opening day
    } else {
      // Overnight shift: e.g. 20:00 to 04:00
      if (currentMinutes >= openMinutes || currentMinutes < closeMinutes) {
        const closeFormatted = formatTime12h(todaySchedule.close);
        return {
          isOpen: true,
          reason: "SCHEDULE",
          statusText: "Store is Open",
          displayMessage: `Store is open now • Closes at ${closeFormatted}`,
          nextOpenTime: null,
          nextCloseTime: closeFormatted,
          autoScheduleEnabled: true,
          manualOverrideStatus: null,
          manualOverrideUntil: null,
          todaySchedule,
        };
      }
    }
  }

  // Find next opening time across next 7 days
  let nextOpenTimeStr: string | null = null;
  for (let offset = 1; offset <= 7; offset++) {
    const nextDayIndex = (currentDayIndex + offset) % 7;
    const nextDayName = DAYS_OF_WEEK[nextDayIndex] ?? "monday";
    const nextDaySchedule = schedule.days[nextDayName];
    if (nextDaySchedule && nextDaySchedule.isOpen) {
      const openFormatted = formatTime12h(nextDaySchedule.open);
      if (offset === 1) {
        nextOpenTimeStr = `Tomorrow at ${openFormatted}`;
      } else {
        const capitalizedDay = nextDayName.charAt(0).toUpperCase() + nextDayName.slice(1);
        nextOpenTimeStr = `${capitalizedDay} at ${openFormatted}`;
      }
      break;
    }
  }

  return {
    isOpen: false,
    reason: "SCHEDULE",
    statusText: "Store is Closed",
    displayMessage: nextOpenTimeStr
      ? `This store is currently closed. Opens ${nextOpenTimeStr}.`
      : "This store is currently closed.",
    nextOpenTime: nextOpenTimeStr,
    nextCloseTime: null,
    autoScheduleEnabled: true,
    manualOverrideStatus: null,
    manualOverrideUntil: null,
    todaySchedule,
  };
}

function getDayAndTimeInTz(date: Date, timezone: string): { dayOfWeek: DayOfWeek; time24: string; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    let weekdayStr = "monday";
    let hour = 0;
    let minute = 0;

    for (const p of parts) {
      if (p.type === "weekday") weekdayStr = p.value.toLowerCase();
      if (p.type === "hour") hour = parseInt(p.value, 10);
      if (p.type === "minute") minute = parseInt(p.value, 10);
    }

    if (hour === 24) hour = 0;
    const validDay = DAYS_OF_WEEK.includes(weekdayStr as DayOfWeek) ? (weekdayStr as DayOfWeek) : "monday";
    const minutes = hour * 60 + minute;
    const time24 = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    return { dayOfWeek: validDay, time24, minutes };
  } catch {
    // Fallback to UTC if timezone invalid
    const days: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const validDay = days[date.getUTCDay()] || "monday";
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    return {
      dayOfWeek: validDay,
      time24: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      minutes: hour * 60 + minute,
    };
  }
}

function formatTimeInTz(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    let hour = "10";
    let minute = "00";
    for (const p of parts) {
      if (p.type === "hour") hour = p.value;
      if (p.type === "minute") minute = p.value;
    }
    return `${hour}:${minute}`;
  } catch {
    return "10:00";
  }
}
