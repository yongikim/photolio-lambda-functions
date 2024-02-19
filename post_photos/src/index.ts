import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { APIGatewayEvent, Context } from "aws-lambda";
import { ulid } from "ulid";

type RequestItem = {
  imageBase64: "string";
  title?: "string";
};

type UploadResult = {
  photoId?: string;
  photoUrl?: string;
  photoTitle?: string;
  success: boolean;
};

const getPhotoUrl = (photoId: string) =>
  `https://photolio-photos.s3.ap-northeast-1.amazonaws.com/${photoId}.jpeg`;

const uploadToS3 = async (
  s3Client: S3Client,
  body: RequestItem
): Promise<UploadResult> => {
  const photoId = ulid();
  const command = new PutObjectCommand({
    Bucket: "photolio-photos",
    Key: `${photoId}.jpeg`,
    Body: Buffer.from(body.imageBase64, "base64"),
  });
  try {
    await s3Client.send(command);
    const photoUrl = getPhotoUrl(photoId);
    return {
      photoUrl,
      photoId,
      photoTitle: body.title,
      success: true,
    };
  } catch (err) {
    console.error(err);
    return {
      photoTitle: body.title,
      success: false,
    };
  }
};

export const handler = async (event: APIGatewayEvent, context: Context) => {
  const s3Client = new S3Client();
  // Request body will be validated by API Gateway
  const requestBody: RequestItem[] = JSON.parse(event.body || "{}").photos;
  console.log(event);
  const uploadResult: UploadResult[] = await Promise.all(
    requestBody.map(async (body) => await uploadToS3(s3Client, body))
  );

  const dynamoClient = new DynamoDBClient();
  const putItemResult = await Promise.all(
    uploadResult.map(async (photo, i) => {
      if (!photo.success || !photo.photoId || !photo.photoUrl) return;

      const now = new Date();
      const itemCreatedAt = Math.floor(now.getTime() / 1000);
      const command = new PutItemCommand({
        TableName: process.env.table_name,
        Item: {
          AlbumId: { S: "all" },
          ItemCreatedAt: { N: itemCreatedAt.toString() },
          PhotoId: { S: photo.photoId },
          PhotoUrl: { S: photo.photoUrl },
          PhotoTitle: { S: photo.photoTitle || "" },
        },
      });
      try {
        await dynamoClient.send(command);
        return {
          id: photo.photoId,
          url: photo.photoUrl,
          title: photo.photoTitle,
          success: true,
        };
      } catch (err) {
        console.error(err);
        return {
          id: photo.photoId,
          url: photo.photoUrl,
          title: photo.photoTitle,
          success: false,
        };
      }
    })
  );

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      photos: putItemResult,
    }),
  };

  return response;
};
