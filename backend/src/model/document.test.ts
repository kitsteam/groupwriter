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
import {
  buildFullDocument,
  buildCreatedDocument,
  buildListedDocument,
} from "../../tests/helpers/documentHelpers";
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
      omit: { ownerExternalId: true },
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
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      modificationSecret: doc.modificationSecret,
    } as never);
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
      omit: { ownerExternalId: true },
    });
  });

  it("should delete linked images", async () => {
    const doc = buildFullDocument();
    const image = buildFullExampleImage(doc.id);
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      modificationSecret: doc.modificationSecret,
    } as never);
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

  it("should not query Prisma when the document id is not a valid UUID", async () => {
    const result = await deleteDocument(prismaMock, "not-a-uuid", "secret");

    expect(result).toBeFalsy();
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
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
      omit: { ownerExternalId: true },
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
      omit: { ownerExternalId: true },
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
    it("records the ownerExternalId insert value but omits it from the query result", async () => {
      const doc = buildFullDocument({ ownerExternalId: "owner-123" });
      prismaMock.document.create.mockResolvedValue(doc);

      await createDocument(prismaMock, "owner-123");

      expect(prismaMock.document.create).toHaveBeenCalledWith({
        data: { ownerExternalId: "owner-123" },
        omit: { ownerExternalId: true },
      });
    });

    it("records a null ownerExternalId when null is passed and still omits it", async () => {
      const doc = buildFullDocument({ ownerExternalId: null });
      prismaMock.document.create.mockResolvedValue(doc);

      await createDocument(prismaMock, null);

      expect(prismaMock.document.create).toHaveBeenCalledWith({
        data: { ownerExternalId: null },
        omit: { ownerExternalId: true },
      });
    });

    it("returns the created document without the ownerExternalId field", async () => {
      // Simulate Prisma honouring the `omit` clause (the mock cannot do this
      // on its own); createDocument returns that production-shape row verbatim,
      // so an exact match proves no ownerExternalId key is present.
      const created = buildCreatedDocument();
      prismaMock.document.create.mockResolvedValue(created as never);

      const result = await createDocument(prismaMock, "owner-123");

      expect(result).toEqual(created);
    });
  });

  describe("getDocumentsByOwner", () => {
    it("scopes the query to the owner and omits ownerExternalId and data", async () => {
      // The `where` clause is what isolates one owner's documents from
      // another's, so asserting it covers ownership filtering (AC5).
      const ownerA = "owner-A";
      prismaMock.document.findMany.mockResolvedValue([]);

      await getDocumentsByOwner(prismaMock, ownerA);

      expect(prismaMock.document.findMany).toHaveBeenCalledWith({
        where: { ownerExternalId: ownerA },
        orderBy: { createdAt: "desc" },
        omit: { ownerExternalId: true, data: true },
      });
    });

    it("returns the owner's documents without the ownerExternalId field", async () => {
      // Simulate Prisma honouring the `omit` clause for owned documents; an
      // exact match proves no element carries an ownerExternalId key.
      const ownerADocs = [buildListedDocument(), buildListedDocument()];
      prismaMock.document.findMany.mockResolvedValue(ownerADocs as never);

      const docs = await getDocumentsByOwner(prismaMock, "owner-A");

      expect(docs).toEqual(ownerADocs);
    });

    it("returns an empty list without querying when ownerExternalId is an empty string", async () => {
      const docs = await getDocumentsByOwner(prismaMock, "");

      expect(docs).toEqual([]);
      expect(prismaMock.document.findMany).not.toHaveBeenCalled();
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

    it("returns an empty list if ownerExternalId is not a string", async () => {
      // Guards against a Prisma filter object reaching the where clause.
      const docs = await getDocumentsByOwner(prismaMock, {
        not: null,
      } as unknown as string);

      expect(docs).toEqual([]);
      expect(prismaMock.document.findMany).not.toHaveBeenCalled();
    });
  });
});
