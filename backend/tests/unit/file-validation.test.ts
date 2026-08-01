import {
  buildObjectKey,
  hasValidMagicBytes,
  isAllowedMime,
  maxSizeFor,
  sniffImageDimensions,
  validateUpload,
} from "../../src/utils/file-validation";

describe("file-validation", () => {
  describe("isAllowedMime", () => {
    it("accepts supported image mime types", () => {
      expect(isAllowedMime("image", "image/jpeg")).toBe(true);
      expect(isAllowedMime("image", "image/png")).toBe(true);
      expect(isAllowedMime("image", "image/webp")).toBe(true);
      expect(isAllowedMime("image", "image/avif")).toBe(true);
      expect(isAllowedMime("image", "image/gif")).toBe(true);
    });

    it("rejects unsupported image mime types", () => {
      expect(isAllowedMime("image", "image/svg+xml")).toBe(false);
      expect(isAllowedMime("image", "application/pdf")).toBe(false);
    });

    it("accepts supported document mime types", () => {
      expect(isAllowedMime("document", "application/pdf")).toBe(true);
      expect(isAllowedMime("document", "text/plain")).toBe(true);
    });

    it("rejects an image uploaded as a document", () => {
      expect(isAllowedMime("document", "image/png")).toBe(false);
    });
  });

  describe("maxSizeFor", () => {
    it("caps images at 5 MB and documents at 10 MB", () => {
      expect(maxSizeFor("image")).toBe(5 * 1024 * 1024);
      expect(maxSizeFor("document")).toBe(10 * 1024 * 1024);
    });
  });

  describe("hasValidMagicBytes", () => {
    it("detects a PNG signature", () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      expect(hasValidMagicBytes("image/png", png)).toBe(true);
    });

    it("detects a JPEG signature", () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
      expect(hasValidMagicBytes("image/jpeg", jpeg)).toBe(true);
    });

    it("rejects a PNG masquerading as a JPEG", () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      expect(hasValidMagicBytes("image/jpeg", png)).toBe(false);
    });

    it("treats text/plain as valid regardless of bytes", () => {
      expect(hasValidMagicBytes("text/plain", Buffer.from("hello world"))).toBe(true);
    });
  });

  describe("sniffImageDimensions", () => {
    it("reads PNG dimensions from the IHDR chunk", () => {
      const png = Buffer.alloc(24);
      png[0] = 0x89;
      png[1] = 0x50;
      png.writeUInt32BE(800, 16);
      png.writeUInt32BE(600, 20);
      expect(sniffImageDimensions(png)).toEqual({ width: 800, height: 600 });
    });

    it("reads GIF dimensions", () => {
      const gif = Buffer.alloc(10);
      gif[0] = 0x47;
      gif[1] = 0x49;
      gif.writeUInt16LE(320, 6);
      gif.writeUInt16LE(240, 8);
      expect(sniffImageDimensions(gif)).toEqual({ width: 320, height: 240 });
    });

    it("returns null for buffers too short or unknown", () => {
      expect(sniffImageDimensions(Buffer.from("hi"))).toBeNull();
    });
  });

  describe("validateUpload", () => {
    it("throws on a mismatched magic signature", () => {
      const text = Buffer.from("not an image at all");
      expect(() => validateUpload("image", "image/png", text)).toThrow(
        "does not match its declared type"
      );
    });

    it("throws when a file exceeds the size cap", () => {
      const big = Buffer.alloc(maxSizeFor("image") + 1, 0x89);
      expect(() => validateUpload("image", "image/png", big)).toThrow("exceeds the maximum");
    });

    it("throws on an empty file", () => {
      expect(() => validateUpload("image", "image/png", Buffer.alloc(0))).toThrow("Empty file");
    });

    it("throws on an unsupported mime", () => {
      expect(() => validateUpload("image", "image/svg+xml", Buffer.from("abc"))).toThrow(
        "Unsupported file type"
      );
    });
  });

  describe("buildObjectKey", () => {
    it("builds a key under the requested folder with a safe extension", () => {
      const key = buildObjectKey("products", "photo.jpg");
      expect(key).toMatch(/^products\/[0-9a-f-]{36}\.jpg$/);
    });

    it("strips a dangerous extension", () => {
      const key = buildObjectKey("vendors", "logo.svg;.png");
      expect(key).toMatch(/\.png$/);
    });

    it("falls back to no extension when none is safe", () => {
      const key = buildObjectKey("products", "photo");
      expect(key).toMatch(/^products\/[0-9a-f-]{36}$/);
    });
  });
});
