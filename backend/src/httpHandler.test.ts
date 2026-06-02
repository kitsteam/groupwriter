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
import {
  buildFullDocument,
  buildCreatedDocument,
  buildListedDocument,
} from "../tests/helpers/documentHelpers";
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
  it("does not include ownerExternalId in the response body", async () => {
    prismaMock.document.create.mockResolvedValue(
      buildCreatedDocument() as never,
    );

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleCreateDocumentRequest(response, prismaMock, "owner-123");

    const body = response.end.mock.calls[0][0] as string;
    expect(body).not.toContain("ownerExternalId");
  });

  it("returns the document produced by the model", async () => {
    // The model omits ownerExternalId, so the mock returns the production
    // shape; the handler serializes it verbatim (dates become ISO strings).
    const created = buildCreatedDocument();
    prismaMock.document.create.mockResolvedValue(created as never);

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleCreateDocumentRequest(response, prismaMock, "owner-123");

    const body = response.end.mock.calls[0][0] as string;
    expect(JSON.parse(body)).toEqual(JSON.parse(JSON.stringify(created)));
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

  it("does not include ownerExternalId in any returned document", async () => {
    const doc = buildListedDocument({ ownerExternalId: "owner-234" });
    prismaMock.document.findMany.mockResolvedValue([doc] as never);

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleGetOwnDocumentsRequest(response, prismaMock, "owner-234");

    const body = response.end.mock.calls[0][0] as string;
    expect(body).not.toContain("ownerExternalId");
  });

  it("returns the owner's documents produced by the model", async () => {
    // The model omits ownerExternalId and data, so the mock returns the
    // production shape (id, modificationSecret, timestamps); the handler
    // serializes it verbatim (dates become ISO strings).
    const doc = buildListedDocument({ ownerExternalId: "owner-234" });
    prismaMock.document.findMany.mockResolvedValue([doc] as never);

    const response = mock<ServerResponse<IncomingMessage>>();
    await handleGetOwnDocumentsRequest(response, prismaMock, "owner-234");

    const body = response.end.mock.calls[0][0] as string;
    expect(JSON.parse(body)).toEqual(JSON.parse(JSON.stringify([doc])));
  });
});

describe("handleDeleteDocumentRequest", () => {
  it("deletes a document", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      modificationSecret: doc.modificationSecret,
    } as never);
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
    await handleUploadImageRequest(
      doc.id,
      "wrong",
      request,
      response,
      prismaMock,
    );

    expect(response.writeHead.mock.calls[0][0]).toBe(403);
  });

  it("returns 422 when createImage returns null", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);
    prismaMock.image.create.mockResolvedValue(null);

    const response = mock<ServerResponse<IncomingMessage>>();
    const request = mock<IncomingMessage>();
    await handleUploadImageRequest(
      doc.id,
      doc.modificationSecret,
      request,
      response,
      prismaMock,
    );

    expect(response.writeHead.mock.calls[0][0]).toBe(422);
  });

  it("returns 400 when file is missing", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    mockFormidableParse.mockResolvedValueOnce([{}, {}]);

    const response = mock<ServerResponse<IncomingMessage>>();
    const request = mock<IncomingMessage>();
    await handleUploadImageRequest(
      doc.id,
      doc.modificationSecret,
      request,
      response,
      prismaMock,
    );

    expect(response.writeHead.mock.calls[0][0]).toBe(400);
  });

  it("rolls back DB entry when S3 upload fails", async () => {
    const doc = buildFullDocument();
    const image = buildFullExampleImage(doc.id);
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);
    prismaMock.image.create.mockResolvedValue(image);
    prismaMock.image.delete.mockResolvedValue(image);

    const { uploadEncryptedImage } = await import("./utils/uploaderDownloader");
    vi.mocked(uploadEncryptedImage).mockRejectedValueOnce(
      new Error("S3 upload failed"),
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

    expect(prismaMock.image.delete).toHaveBeenCalledWith({
      where: { id: image.id },
    });
    expect(response.writeHead.mock.calls[0][0]).toBe(500);
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
      'inline; filename="test.png"',
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
    await handleDeleteImageRequest(doc.id, "wrong", response, prismaMock);

    expect(response.writeHead.mock.calls[0][0]).toBe(403);
  });
});
