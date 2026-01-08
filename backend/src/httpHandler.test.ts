import { IncomingMessage, ServerResponse } from "http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import {
  handleCreateDocumentRequest,
  handleDeleteDocumentRequest,
  handleDeleteImageRequest,
  handleGetImageRequest,
  handleUploadImageRequest,
  handleGetOwnDocumentsRequest,
  handleHealthRequest,
} from "./httpHandler";
import { Document } from "../generated/prisma/client";
import { downloadEncryptedImage } from "./utils/uploaderDownloader";
import { deleteImageFromBucket } from "./utils/s3";
import { DeleteObjectCommandOutput } from "@aws-sdk/client-s3";
import { prismaMock } from "../tests/helpers/mockPrisma";
import { buildFullDocument } from "../tests/helpers/documentHelpers";
import { buildFullExampleImage } from "../tests/helpers/imageHelpers";

vi.mock("stream/promises");
vi.mock("./utils/uploaderDownloader");
vi.mock("./utils/s3");

const { mockFormidableParse } = vi.hoisted(() => ({
  mockFormidableParse: vi.fn().mockResolvedValue([
    {},
    {
      file: [
        {
          filepath: "test",
          mimetype: "image/png",
          originalFilename: "test.png",
        },
      ],
    },
  ]),
}));

vi.mock("formidable", () => ({
  default: () => {
    return {
      parse: mockFormidableParse,
    };
  },
}));

describe("handleHealthRequest", () => {
  it("responds with OK to health check", () => {
    const response = mock<ServerResponse<IncomingMessage>>();
    handleHealthRequest(response);
    const result = response.end.mock.calls[0][0] as string;
    expect(result).toEqual("OK");
  });
});

describe("handleCreateDocumentRequest", () => {
  it("creates a document without owner", async () => {
    const doc = buildFullDocument({ ownerExternalId: null });
    prismaMock.document.create.mockResolvedValue(doc);

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleCreateDocumentRequest(response, prismaMock, null);

    const result = JSON.parse(
      response.end.mock.calls[0][0] as string,
    ) as Document;
    expect(result.id).toBeDefined();
    expect(result.ownerExternalId).toBeNull();
  });

  it("creates a document with owner", async () => {
    const doc = buildFullDocument({ ownerExternalId: "123" });
    prismaMock.document.create.mockResolvedValue(doc);

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleCreateDocumentRequest(response, prismaMock, "123");

    const result = JSON.parse(
      response.end.mock.calls[0][0] as string,
    ) as Document;
    expect(result.id).toBeDefined();
    expect(result.ownerExternalId).toEqual("123");
  });
});

describe("handleGetOwnDocumentsRequest", () => {
  it("returns empty list when no ownerId is provided", async () => {
    const response = mock<ServerResponse<IncomingMessage>>();
    await handleGetOwnDocumentsRequest(response, prismaMock, null);

    const result = JSON.parse(
      response.end.mock.calls[0][0] as string,
    ) as Document;
    expect(result).toEqual([]);
    expect(prismaMock.document.findMany).not.toHaveBeenCalled();
  });

  it("returns list when ownerId is provided", async () => {
    const doc = buildFullDocument({ ownerExternalId: "owner-234" });
    prismaMock.document.findMany.mockResolvedValue([doc]);

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleGetOwnDocumentsRequest(response, prismaMock, "owner-234");

    const result = JSON.parse(
      response.end.mock.calls[0][0] as string,
    ) as Document[];
    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(doc.id);
  });
});

describe("handleDeleteDocumentRequest", () => {
  it("deletes a document", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({ id: doc.id } as never);
    prismaMock.image.findMany.mockResolvedValue([]);
    prismaMock.document.delete.mockResolvedValue(doc);

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleDeleteDocumentRequest(
      doc.id,
      doc.modificationSecret,
      response,
      prismaMock,
    );

    expect(response.writeHead.mock.calls[0][0]).toBe(200);
  });

  it("does not delete a document when secret is wrong", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue(null);

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleDeleteDocumentRequest(doc.id, "test", response, prismaMock);

    expect(response.writeHead.mock.calls[0][0]).toBe(404);
  });
});

describe("handleUploadImageRequest", () => {
  beforeEach(() => {
    mockFormidableParse.mockResolvedValue([
      {},
      {
        file: [
          {
            filepath: "test",
            mimetype: "image/png",
            originalFilename: "test.png",
          },
        ],
      },
    ]);
  });

  it("uploads an image", async () => {
    const doc = buildFullDocument();
    const image = buildFullExampleImage(doc.id);
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);
    prismaMock.image.create.mockResolvedValue(image);

    const response = mock<ServerResponse<IncomingMessage>>();
    const request = mock<IncomingMessage>();
    await handleUploadImageRequest(
      doc.id,
      doc.modificationSecret,
      request,
      response,
      prismaMock,
    );

    expect(response.writeHead.mock.calls[0][0]).toBe(200);
    expect(response.end.mock.calls[0][0]).toContain("images/");
  });

  it("does not upload an image when the secret is wrong", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    const response = mock<ServerResponse<IncomingMessage>>();
    const request = mock<IncomingMessage>();
    await expect(
      handleUploadImageRequest(doc.id, "wrong", request, response, prismaMock),
    ).rejects.toBeUndefined();

    expect(response.writeHead.mock.calls[0][0]).toBe(403);
  });

  it("returns 413 when file size exceeds maximum allowed size", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    mockFormidableParse.mockRejectedValueOnce(
      new Error("maxTotalFileSize exceeded"),
    );

    const response = mock<ServerResponse<IncomingMessage>>();
    const request = mock<IncomingMessage>();
    await handleUploadImageRequest(
      doc.id,
      doc.modificationSecret,
      request,
      response,
      prismaMock,
    );

    expect(response.writeHead.mock.calls[0][0]).toBe(413);
    expect(response.end.mock.calls[0][0]).toContain(
      "File size exceeds maximum allowed size",
    );
  });
});

describe("handleGetImageRequest", () => {
  it("returns an image", async () => {
    const doc = buildFullDocument();
    const image = buildFullExampleImage(doc.id, {
      name: "test.png",
      mimetype: "image/png",
    });
    prismaMock.image.findUnique.mockResolvedValue(image);
    vi.mocked(downloadEncryptedImage).mockResolvedValue(Buffer.from("test"));

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleGetImageRequest(image.id, response, prismaMock);

    expect(response.writeHead.mock.calls[0][0]).toEqual(200);
    expect(response.writeHead.mock.calls[0][1]).toHaveProperty(
      "Content-Disposition",
      "inline; filename=test.png",
    );
    expect(response.writeHead.mock.calls[0][1]).toHaveProperty(
      "Content-Type",
      "image/png",
    );
  });
});

describe("handleDeleteImageRequest", () => {
  it("deletes an image", async () => {
    const doc = buildFullDocument();
    const image = buildFullExampleImage(doc.id);
    prismaMock.image.findUnique.mockResolvedValue(image);
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);
    prismaMock.image.delete.mockResolvedValue(image);
    vi.mocked(deleteImageFromBucket).mockResolvedValue(
      {} as DeleteObjectCommandOutput,
    );

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleDeleteImageRequest(
      image.id,
      doc.modificationSecret,
      response,
      prismaMock,
    );

    expect(response.writeHead.mock.calls[0][0]).toEqual(204);
  });

  it("does not delete an image when the secret is wrong", async () => {
    const doc = buildFullDocument();
    const image = buildFullExampleImage(doc.id);
    prismaMock.image.findUnique.mockResolvedValue(image);
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);
    vi.mocked(deleteImageFromBucket).mockResolvedValue(
      {} as DeleteObjectCommandOutput,
    );

    const response = mock<ServerResponse<IncomingMessage>>();
    await expect(
      handleDeleteImageRequest(doc.id, "wrong", response, prismaMock),
    ).rejects.toBeUndefined();

    expect(response.writeHead.mock.calls[0][0]).toBe(403);
  });
});
