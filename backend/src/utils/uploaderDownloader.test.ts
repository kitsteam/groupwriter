import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import {
  downloadEncryptedImage,
  uploadEncryptedImage,
} from "./uploaderDownloader";
import { getImageFromBucket, uploadImageToBucket } from "./s3";
import { decrypt, encrypt } from "./crypto";
import { sdkStreamMixin } from "@smithy/util-stream";
import { Readable } from "stream";

vi.mock("../utils/crypto");
vi.mock("../utils/s3");

const { mockReadFile, mockRm } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockRm: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: mockReadFile,
    rm: mockRm,
  },
}));

describe("uploadEncryptedImage", () => {
  it("calls encrypt with the data and iv", async () => {
    vi.mocked(uploadImageToBucket).mockResolvedValue(null);
    vi.mocked(encrypt).mockReturnValue(null);
    mockRm.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("test"));

    const imageid = randomUUID();
    await uploadEncryptedImage(imageid, "image/png", "/tmp/test.png");
    expect(encrypt).toHaveBeenCalledWith(
      Buffer.from("test"),
      imageid.slice(0, 16),
    );
    expect(mockRm).toHaveBeenCalledWith("/tmp/test.png", { force: true });
    expect(mockReadFile).toHaveBeenCalledWith("/tmp/test.png");
  });

  it("cleans up temp file even when S3 upload fails", async () => {
    vi.mocked(uploadImageToBucket).mockRejectedValue(
      new Error("S3 upload failed"),
    );
    vi.mocked(encrypt).mockReturnValue(Buffer.from("encrypted"));
    mockRm.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("test"));

    const imageid = randomUUID();
    await expect(
      uploadEncryptedImage(imageid, "image/png", "/tmp/test.png"),
    ).rejects.toThrow("S3 upload failed");
    expect(mockRm).toHaveBeenCalledWith("/tmp/test.png", { force: true });
  });

  it("cleans up temp file even when encrypt fails", async () => {
    vi.mocked(encrypt).mockImplementation(() => {
      throw new Error("encrypt failed");
    });
    mockRm.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("test"));

    const imageid = randomUUID();
    await expect(
      uploadEncryptedImage(imageid, "image/png", "/tmp/test.png"),
    ).rejects.toThrow("encrypt failed");
    expect(mockRm).toHaveBeenCalledWith("/tmp/test.png", { force: true });
  });
});

describe("downloadEncryptedImage", () => {
  it("calls decrypt", async () => {
    const imageId = randomUUID();
    vi.mocked(decrypt).mockReturnValue(Buffer.from("test"));
    const stream = new Readable();
    stream.push("hello world");
    stream.push(null);
    const sdkStream = sdkStreamMixin(stream);
    vi.mocked(getImageFromBucket).mockResolvedValue({
      $metadata: {},
      Body: sdkStream,
    });
    await downloadEncryptedImage(imageId);
    expect(decrypt).toHaveBeenCalled();
  });

  it("returns null when S3 returns error", async () => {
    const imageId = randomUUID();
    vi.mocked(getImageFromBucket).mockRejectedValue(new Error("NoSuchKey"));
    const result = await downloadEncryptedImage(imageId);
    expect(result).toBeNull();
  });

  it("returns null when Body is undefined", async () => {
    const imageId = randomUUID();
    vi.mocked(getImageFromBucket).mockResolvedValue({
      $metadata: {},
      Body: undefined,
    });
    const result = await downloadEncryptedImage(imageId);
    expect(result).toBeNull();
  });
});
