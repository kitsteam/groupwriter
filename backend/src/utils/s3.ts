import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  GetObjectCommandOutput,
  DeleteObjectCommandOutput,
  PutObjectCommandOutput,
} from "@aws-sdk/client-s3";

const client = new S3Client({
  region: process.env.OBJECT_STORAGE_REGION,
  endpoint: `${process.env.OBJECT_STORAGE_SCHEME}${process.env.OBJECT_STORAGE_HOST}:${process.env.OBJECT_STORAGE_PORT}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_USER,
    secretAccessKey: process.env.OBJECT_STORAGE_PASSWORD,
  },
});

export const uploadImageToBucket = async (
  data: Buffer,
  newFilename: string,
  contentType: string,
): Promise<PutObjectCommandOutput> => {
  const params = {
    Bucket: process.env.OBJECT_STORAGE_BUCKET,
    Key: newFilename,
    Body: data,
    ContentType: contentType,
  };
  return await client.send(new PutObjectCommand(params));
};

export const getImageFromBucket = async (
  filename: string,
): Promise<GetObjectCommandOutput | undefined> => {
  if (!filename) return undefined;

  const params = {
    Bucket: process.env.OBJECT_STORAGE_BUCKET,
    Key: filename,
  };
  return client.send(new GetObjectCommand(params));
};

export const deleteImageFromBucket = (
  filename: string,
): Promise<DeleteObjectCommandOutput> => {
  const params = {
    Bucket: process.env.OBJECT_STORAGE_BUCKET,
    Key: filename,
  };
  return client.send(new DeleteObjectCommand(params));
};
