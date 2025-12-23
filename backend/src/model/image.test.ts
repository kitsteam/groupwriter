import { describe, expect, it } from "vitest";
import { createImage, deleteImage, getImage } from "./image";
import { randomUUID } from "crypto";
import { buildFullExampleImage } from "../../tests/helpers/imageHelpers";
import { prismaMock } from "../../tests/helpers/mockPrisma";

describe("createImage", () => {
  it("should create an image", async () => {
    const documentId = randomUUID();
    const mockImage = buildFullExampleImage(documentId, { name: "image.png" });
    prismaMock.image.create.mockResolvedValue(mockImage);

    const image = await createImage(
      prismaMock,
      documentId,
      "image/png",
      "test.png",
    );

    expect(image).not.toBeNull();
    expect(prismaMock.image.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId,
        mimetype: "image/png",
      }) as { documentId: string; mimetype: string; name: string },
    });
  });

  it("should set an anonymized image name", async () => {
    const documentId = randomUUID();
    const mockImage = buildFullExampleImage(documentId, { name: "image.png" });
    prismaMock.image.create.mockResolvedValue(mockImage);

    const image = await createImage(
      prismaMock,
      documentId,
      "image/png",
      "test.png",
    );

    expect(image.name).toBe("image.png");
  });
});

describe("deleteImage", () => {
  it("should delete an image", async () => {
    const documentId = randomUUID();
    const mockImage = buildFullExampleImage(documentId);
    prismaMock.image.delete.mockResolvedValue(mockImage);

    const deleted = await deleteImage(prismaMock, mockImage.id);

    expect(deleted).toEqual(mockImage);
    expect(prismaMock.image.delete).toHaveBeenCalledWith({
      where: { id: mockImage.id },
    });
  });
});

describe("getImage", () => {
  it("should get an image", async () => {
    const documentId = randomUUID();
    const mockImage = buildFullExampleImage(documentId);
    prismaMock.image.findUnique.mockResolvedValue(mockImage);

    const fetchedImage = await getImage(prismaMock, mockImage.id);

    expect(fetchedImage).toEqual(mockImage);
    expect(prismaMock.image.findUnique).toHaveBeenCalledWith({
      where: { id: mockImage.id },
    });
  });

  it("returns null if the image does not exist", async () => {
    prismaMock.image.findUnique.mockResolvedValue(null);

    const fetchedImage = await getImage(prismaMock, randomUUID());

    expect(fetchedImage).toBeNull();
  });

  it("returns null if the parameter is undefined", async () => {
    const fetchedImage = await getImage(prismaMock, undefined);

    expect(fetchedImage).toBeNull();
    expect(prismaMock.image.findUnique).not.toHaveBeenCalled();
  });
});
