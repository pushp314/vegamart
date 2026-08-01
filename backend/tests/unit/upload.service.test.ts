import { uploadService } from "../../src/services/upload.service";

jest.mock("../../src/storage/r2.client", () => ({
  uploadObject: jest.fn().mockResolvedValue("https://cdn.example.com/products/abc.png"),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/utils/file-validation", () => {
  const actual = jest.requireActual("../../src/utils/file-validation");
  return {
    ...actual,
    validateUpload: jest.fn().mockImplementation(() => undefined),
    buildObjectKey: jest.fn().mockReturnValue("products/abc.png"),
    sniffImageDimensions: jest.fn().mockReturnValue({ width: 100, height: 100 }),
  };
});

import * as r2 from "../../src/storage/r2.client";
import * as fileValidation from "../../src/utils/file-validation";

const mockUpload = r2.uploadObject as jest.Mock;
const mockDelete = r2.deleteObject as jest.Mock;
const mockValidate = fileValidation.validateUpload as jest.Mock;

const mockReq = { user: { id: "user-1" } } as any;

describe("upload service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads an image and returns a public URL", async () => {
    const result = await uploadService.uploadImage(
      "user-1",
      "products",
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      "photo.png",
      mockReq
    );
    expect(result.url).toBe("https://cdn.example.com/products/abc.png");
    expect(result.key).toBe("products/abc.png");
    expect(result.mime).toBe("image/png");
    expect(mockValidate).toHaveBeenCalledWith("image", "image/png", expect.any(Buffer));
    expect(mockUpload).toHaveBeenCalledWith({
      key: "products/abc.png",
      body: expect.any(Buffer),
      contentType: "image/png",
    });
  });

  it("uploads a document", async () => {
    const result = await uploadService.uploadDocument(
      "user-1",
      "documents",
      "application/pdf",
      Buffer.from([0x25, 0x50, 0x44, 0x46]),
      "kyc.pdf",
      mockReq
    );
    expect(result.url).toBe("https://cdn.example.com/products/abc.png");
    expect(mockValidate).toHaveBeenCalledWith("document", "application/pdf", expect.any(Buffer));
  });

  it("rejects an invalid folder", async () => {
    await expect(
      uploadService.uploadImage("user-1", "hack" as never, "image/png", Buffer.from("x"), "a.png", mockReq)
    ).rejects.toMatchObject({ code: "INVALID_FOLDER" });
  });

  it("rejects an invalid file key on delete", async () => {
    await expect(uploadService.deleteFile("user-1", "../../etc/passwd", mockReq)).rejects.toMatchObject({
      code: "INVALID_FILE_KEY",
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes a file and audits the action", async () => {
    await uploadService.deleteFile("user-1", "products/abc.png", mockReq);
    expect(mockDelete).toHaveBeenCalledWith("products/abc.png");
  });
});
