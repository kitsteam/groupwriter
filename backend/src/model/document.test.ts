import { describe, expect, it, vi } from "vitest";
import {
  deleteOldDocuments,
  fetchDocument,
  updateLastAccessedAt,
  updateDocument,
  isValidModificationSecret,
  deleteDocument,
  createDocument,
  getDocumentsByOwner,
} from "./document";
import { buildFullDocument } from "../../tests/helpers/documentHelpers";
import { buildFullExampleImage } from "../../tests/helpers/imageHelpers";
import { deleteImage } from "./image";
import { deleteImageFromBucket } from "../utils/s3";
import { prismaMock } from "../../tests/helpers/mockPrisma";
import { randomUUID } from "crypto";

vi.mock("./image");

vi.mock("../utils/s3");

describe("deleteOldDocuments", () => {
  it("should delete old documents, but keep new documents", async () => {
    const oldDoc = buildFullDocument();

    prismaMock.document.findMany.mockResolvedValue([
      { id: oldDoc.id },
    ] as never);
    prismaMock.image.findMany.mockResolvedValue([]);
    prismaMock.document.delete.mockResolvedValue(oldDoc);

    await deleteOldDocuments(prismaMock);

    expect(prismaMock.document.findMany).toHaveBeenCalledWith({
      where: {
        lastAccessedAt: { lt: expect.any(Date) as Date },
      },
      select: { id: true },
    });
    expect(prismaMock.document.delete).toHaveBeenCalledWith({
      where: { id: oldDoc.id },
    });
  });

  it("should delete linked images", async () => {
    const oldDoc = buildFullDocument();
    const image = buildFullExampleImage(oldDoc.id);

    prismaMock.document.findMany.mockResolvedValue([
      { id: oldDoc.id },
    ] as never);
    prismaMock.image.findMany.mockResolvedValue([image]);
    prismaMock.document.delete.mockResolvedValue(oldDoc);
    vi.mocked(deleteImage).mockResolvedValue(image);
    vi.mocked(deleteImageFromBucket).mockResolvedValue(null);

    await deleteOldDocuments(prismaMock);

    expect(deleteImageFromBucket).toHaveBeenCalledWith(image.id);
    expect(deleteImage).toHaveBeenCalledWith(prismaMock, image.id);
  });
});

describe("deleteDocument", () => {
  it("should delete the document", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({ id: doc.id } as never);
    prismaMock.image.findMany.mockResolvedValue([]);
    prismaMock.document.delete.mockResolvedValue(doc);

    const result = await deleteDocument(
      prismaMock,
      doc.id,
      doc.modificationSecret,
    );

    expect(result).toBeTruthy();
    expect(prismaMock.document.delete).toHaveBeenCalledWith({
      where: { id: doc.id },
    });
  });

  it("should delete linked images", async () => {
    const doc = buildFullDocument();
    const image = buildFullExampleImage(doc.id);
    prismaMock.document.findFirst.mockResolvedValue({ id: doc.id } as never);
    prismaMock.image.findMany.mockResolvedValue([image]);
    prismaMock.document.delete.mockResolvedValue(doc);
    vi.mocked(deleteImage).mockResolvedValue(image);
    vi.mocked(deleteImageFromBucket).mockResolvedValue(null);

    const result = await deleteDocument(
      prismaMock,
      doc.id,
      doc.modificationSecret,
    );

    expect(result).toBeTruthy();
    expect(deleteImageFromBucket).toHaveBeenCalledWith(image.id);
    expect(deleteImage).toHaveBeenCalledWith(prismaMock, image.id);
  });

  it("should not delete the document if the id is missing", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue(null);

    const result = await deleteDocument(
      prismaMock,
      "missing",
      doc.modificationSecret,
    );

    expect(result).toBeFalsy();
    expect(prismaMock.document.delete).not.toHaveBeenCalled();
  });

  it("should not delete the document if the modificationSecret is wrong", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue(null);

    const result = await deleteDocument(prismaMock, doc.id, "wrong-secret");

    expect(result).toBeFalsy();
    expect(prismaMock.document.delete).not.toHaveBeenCalled();
  });
});

describe("updateLastAccessedAt", () => {
  it("updates the lastAccessedAt value", async () => {
    const doc = buildFullDocument();
    const updatedDoc = { ...doc, lastAccessedAt: new Date() };
    prismaMock.document.update.mockResolvedValue(updatedDoc);

    await updateLastAccessedAt(prismaMock, doc.id);

    expect(prismaMock.document.update).toHaveBeenCalledWith({
      where: { id: doc.id },
      data: { lastAccessedAt: expect.any(Date) as Date },
    });
  });

  it("does not update the value for an invalid document id", async () => {
    await updateLastAccessedAt(prismaMock, "invalid");

    expect(prismaMock.document.update).not.toHaveBeenCalled();
  });
});

describe("fetchDocument", () => {
  it("accepts a valid uuidv4", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    const result = await fetchDocument(prismaMock, doc.id);

    expect(result?.id).toEqual(doc.id);
    expect(prismaMock.document.findFirst).toHaveBeenCalledWith({
      where: { id: doc.id },
      select: { id: true, data: true, modificationSecret: true },
    });
  });

  it("does not accept an invalid document id", async () => {
    const result = await fetchDocument(prismaMock, "invalid");

    expect(result).toBeNull();
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
  });

  it("returns null if the document does not exist", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);

    const result = await fetchDocument(prismaMock, randomUUID());

    expect(result).toBeNull();
  });
});

describe("isValidModificationSecret", () => {
  it("returns true for valid modificationSecret", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    const result = await isValidModificationSecret(
      prismaMock,
      doc.id,
      doc.modificationSecret,
    );

    expect(result).toBeTruthy();
  });

  it("returns false for invalid modificationSecret", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    const result = await isValidModificationSecret(
      prismaMock,
      doc.id,
      "invalid",
    );

    expect(result).toBeFalsy();
  });

  it("does not accept an invalid document id", async () => {
    const result = await isValidModificationSecret(
      prismaMock,
      "invalid",
      "invalid",
    );

    expect(result).toBeFalsy();
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
  });
});

describe("updateDocument", () => {
  it("updates an existing document", async () => {
    const doc = buildFullDocument();
    const newData = new TextEncoder().encode("new");
    prismaMock.document.update.mockResolvedValue({ ...doc, data: newData });

    const result = await updateDocument(prismaMock, doc.id, newData);

    expect(result).toBeTruthy();
    expect(prismaMock.document.update).toHaveBeenCalledWith({
      where: { id: doc.id },
      data: {
        data: expect.any(Uint8Array) as Uint8Array,
        updatedAt: expect.any(Date) as Date,
        lastAccessedAt: expect.any(Date) as Date,
      },
    });
  });

  it("returns false when document does not exist", async () => {
    prismaMock.document.update.mockRejectedValue(new Error("Record not found"));

    const result = await updateDocument(
      prismaMock,
      "00000000-0000-0000-0000-000000000000",
      new Uint8Array(),
    );

    expect(result).toBeFalsy();
  });

  it("does not accept an invalid document id", async () => {
    const result = await updateDocument(prismaMock, "invalid", undefined);

    expect(result).toBeFalsy();
    expect(prismaMock.document.update).not.toHaveBeenCalled();
  });
});

describe("document ownership", () => {
  describe("createDocument", () => {
    it("assigns ownerExternalId when passed", async () => {
      const doc = buildFullDocument({ ownerExternalId: "owner-123" });
      prismaMock.document.create.mockResolvedValue(doc);

      const result = await createDocument(prismaMock, "owner-123");

      expect(result.ownerExternalId).toBe("owner-123");
      expect(prismaMock.document.create).toHaveBeenCalledWith({
        data: { ownerExternalId: "owner-123" },
      });
    });

    it("sets ownerExternalId to null when null is passed", async () => {
      const doc = buildFullDocument({ ownerExternalId: null });
      prismaMock.document.create.mockResolvedValue(doc);

      const result = await createDocument(prismaMock, null);

      expect(result.ownerExternalId).toBeNull();
    });
  });

  describe("getDocumentsByOwner", () => {
    it("returns only documents with matching ownerExternalId in the correct order", async () => {
      const ownerA = "owner-A";
      const doc1 = buildFullDocument({ ownerExternalId: ownerA });
      const doc2 = buildFullDocument({ ownerExternalId: ownerA });

      prismaMock.document.findMany.mockResolvedValue([doc1, doc2]);

      const docs = await getDocumentsByOwner(prismaMock, ownerA);

      expect(docs.length).toBe(2);
      expect(prismaMock.document.findMany).toHaveBeenCalledWith({
        where: { ownerExternalId: ownerA },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns an empty list if owner has no documents", async () => {
      prismaMock.document.findMany.mockResolvedValue([]);

      const docs = await getDocumentsByOwner(prismaMock, "owner-234");

      expect(docs).toEqual([]);
    });

    it("returns an empty list if ownerExternalId is null", async () => {
      const docs = await getDocumentsByOwner(prismaMock, null);

      expect(docs).toEqual([]);
      expect(prismaMock.document.findMany).not.toHaveBeenCalled();
    });
  });
});
