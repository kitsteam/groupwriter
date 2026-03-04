import { decrypt, encrypt } from "./crypto";
import { getImageFromBucket, uploadImageToBucket } from "./s3";
import fs from "fs/promises";

export const uploadEncryptedImage = async (
  imageId: string,
  mimetype: string,
  tmpFilepath: string,
): Promise<void> => {
  try {
    const data = await fs.readFile(tmpFilepath);
    const encrypted = encrypt(data, imageId.slice(0, 16));
    await uploadImageToBucket(encrypted, imageId, mimetype);
  } finally {
    await fs.rm(tmpFilepath, { force: true });
  }
};

export const downloadEncryptedImage = async (
  imageId: string,
): Promise<Buffer | null> => {
  try {
    const imageFromBucket = await getImageFromBucket(imageId);
    if (imageFromBucket?.Body) {
      return decrypt(
        Buffer.from(await imageFromBucket.Body.transformToByteArray()),
        imageId.slice(0, 16),
      );
    }
    return null;
  } catch (error) {
    console.error("Failed to download image:", error);
    return null;
  }
};
