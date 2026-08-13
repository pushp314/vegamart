import { parseDateParam } from "../../src/utils/time";

describe("parseDateParam", () => {
  it("returns null for an unparseable value", () => {
    expect(parseDateParam("not-a-date", false)).toBeNull();
    expect(parseDateParam("", true)).toBeNull();
  });

  it("treats date-only start bound as server-local midnight", () => {
    const date = parseDateParam("2026-08-13", false)!;
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7); // August
    expect(date.getDate()).toBe(13);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });

  it("treats date-only end bound as server-local end-of-day", () => {
    const date = parseDateParam("2026-08-13", true)!;
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(13);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
    expect(date.getMilliseconds()).toBe(999);
  });

  it("normalises an explicit UTC midnight on the end bound to end-of-day", () => {
    const date = parseDateParam("2026-08-13T00:00:00.000Z", true)!;
    expect(date.toISOString()).toBe("2026-08-13T23:59:59.999Z");
  });

  it("does not touch a non-midnight UTC timestamp on the end bound", () => {
    const date = parseDateParam("2026-08-13T18:30:00.000Z", true)!;
    expect(date.toISOString()).toBe("2026-08-13T18:30:00.000Z");
  });

  it("keeps the start bound as the exact timestamp", () => {
    const date = parseDateParam("2026-08-13T18:30:00.000Z", false)!;
    expect(date.toISOString()).toBe("2026-08-13T18:30:00.000Z");
  });
});
