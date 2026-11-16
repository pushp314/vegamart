import {
  calculateStoreAvailability,
  formatTime12h,
  getDefaultSchedule,
} from "../../src/utils/store-schedule";

describe("store-schedule utility", () => {
  it("formats 24h time to 12h time correctly", () => {
    expect(formatTime12h("10:00")).toBe("10:00 AM");
    expect(formatTime12h("19:00")).toBe("7:00 PM");
    expect(formatTime12h("00:00")).toBe("12:00 AM");
    expect(formatTime12h("12:30")).toBe("12:30 PM");
    expect(formatTime12h("23:45")).toBe("11:45 PM");
  });

  it("handles manual mode when auto_schedule_enabled is false", () => {
    const openVendor = { is_open: true, auto_schedule_enabled: false };
    const resOpen = calculateStoreAvailability(openVendor);
    expect(resOpen.isOpen).toBe(true);
    expect(resOpen.reason).toBe("MANUAL");

    const closedVendor = { is_open: false, auto_schedule_enabled: false };
    const resClosed = calculateStoreAvailability(closedVendor);
    expect(resClosed.isOpen).toBe(false);
    expect(resClosed.reason).toBe("MANUAL");
  });

  describe("automated scheduling based on hours", () => {
    // Construct a schedule where Monday is 10:00 to 19:00
    const schedule = getDefaultSchedule("10:00", "19:00");
    const vendor = {
      is_open: true,
      auto_schedule_enabled: true,
      store_schedule: schedule,
    };

    it("reports store as OPEN during business hours", () => {
      // 2026-11-16 is Monday. 14:30 IST is 09:00 UTC
      const mondayAfternoon = new Date("2026-11-16T09:00:00Z"); // 14:30 IST
      const res = calculateStoreAvailability(vendor, mondayAfternoon);
      expect(res.isOpen).toBe(true);
      expect(res.reason).toBe("SCHEDULE");
      expect(res.nextCloseTime).toBe("7:00 PM");
      expect(res.displayMessage).toContain("Store is open now");
    });

    it("reports store as CLOSED before opening time and displays opening time", () => {
      // 08:30 IST is 03:00 UTC
      const mondayMorning = new Date("2026-11-16T03:00:00Z"); // 08:30 IST
      const res = calculateStoreAvailability(vendor, mondayMorning);
      expect(res.isOpen).toBe(false);
      expect(res.reason).toBe("SCHEDULE");
      expect(res.nextOpenTime).toBe("10:00 AM");
      expect(res.displayMessage).toBe("This store is currently closed. Opens at 10:00 AM.");
    });

    it("reports store as CLOSED after closing time and displays next day opening time", () => {
      // 20:30 IST is 15:00 UTC
      const mondayNight = new Date("2026-11-16T15:00:00Z"); // 20:30 IST
      const res = calculateStoreAvailability(vendor, mondayNight);
      expect(res.isOpen).toBe(false);
      expect(res.reason).toBe("SCHEDULE");
      expect(res.nextOpenTime).toBe("Tomorrow at 10:00 AM");
      expect(res.displayMessage).toBe("This store is currently closed. Opens Tomorrow at 10:00 AM.");
    });

    it("handles closed days (e.g. closed on Sunday)", () => {
      const scheduleWithSundayClosed = getDefaultSchedule("10:00", "19:00");
      scheduleWithSundayClosed.days.sunday.isOpen = false;

      const sundayVendor = {
        is_open: false,
        auto_schedule_enabled: true,
        store_schedule: scheduleWithSundayClosed,
      };

      // 2026-11-15 is Sunday
      const sundayNoon = new Date("2026-11-15T06:30:00Z"); // 12:00 IST
      const res = calculateStoreAvailability(sundayVendor, sundayNoon);
      expect(res.isOpen).toBe(false);
      expect(res.nextOpenTime).toBe("Tomorrow at 10:00 AM");
      expect(res.displayMessage).toBe("This store is currently closed. Opens Tomorrow at 10:00 AM.");
    });
  });

  describe("manual overrides with automated schedule", () => {
    const schedule = getDefaultSchedule("10:00", "19:00");

    it("allows manual FORCE_OPEN outside scheduled hours", () => {
      // Monday 08:30 IST (normally closed)
      const mondayEarly = new Date("2026-11-16T03:00:00Z");
      const vendor = {
        is_open: false,
        auto_schedule_enabled: true,
        store_schedule: schedule,
        manual_override_status: "FORCE_OPEN",
      };

      const res = calculateStoreAvailability(vendor, mondayEarly);
      expect(res.isOpen).toBe(true);
      expect(res.reason).toBe("FORCE_OPEN");
    });

    it("allows manual FORCE_CLOSE during scheduled hours", () => {
      // Monday 14:30 IST (normally open)
      const mondayNoon = new Date("2026-11-16T09:00:00Z");
      const vendor = {
        is_open: true,
        auto_schedule_enabled: true,
        store_schedule: schedule,
        manual_override_status: "FORCE_CLOSE",
      };

      const res = calculateStoreAvailability(vendor, mondayNoon);
      expect(res.isOpen).toBe(false);
      expect(res.reason).toBe("FORCE_CLOSE");
    });

    it("handles TEMPORARY_CLOSE with expiration", () => {
      // Monday 14:00 IST = 08:30 UTC
      const now = new Date("2026-11-16T08:30:00Z");
      // Temporary close until 16:00 IST = 10:30 UTC
      const closeUntil = new Date("2026-11-16T10:30:00Z");

      const vendor = {
        is_open: true,
        auto_schedule_enabled: true,
        store_schedule: schedule,
        manual_override_status: "TEMPORARY_CLOSE",
        manual_override_until: closeUntil,
      };

      // While temporary close is active:
      const resActive = calculateStoreAvailability(vendor, now);
      expect(resActive.isOpen).toBe(false);
      expect(resActive.reason).toBe("TEMPORARY_CLOSE");

      // After temporary close expires (at 16:30 IST = 11:00 UTC):
      const later = new Date("2026-11-16T11:00:00Z");
      const resExpired = calculateStoreAvailability(vendor, later);
      expect(resExpired.isOpen).toBe(true); // Should resume normal open schedule!
      expect(resExpired.reason).toBe("SCHEDULE");
    });
  });
});
