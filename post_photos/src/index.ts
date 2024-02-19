import {
  DynamoDBClient,
  QueryCommand,
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
  photoId: string;
  photoUrl?: string;
  photoTitle?: string;
  success: boolean;
};

const uploadToS3 = async (
  s3Client: S3Client,
  body: RequestItem
): Promise<UploadResult> => {
  const uniqueId = ulid();
  const command = new PutObjectCommand({
    Bucket: "photolio-photos",
    Key: `${uniqueId}.jpeg`,
    Body: Buffer.from(body.imageBase64, "base64"),
  });
  try {
    await s3Client.send(command);
    const photoUrl = `s3://photolio-photos/${uniqueId}.jpeg`;
    return {
      photoUrl,
      photoId: uniqueId,
      photoTitle: body.title,
      success: true,
    };
  } catch (err) {
    console.error(err);
    return {
      photoId: uniqueId,
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

  // const dynamoClient = new DynamoDBClient();
  // const params: QueryCommandInput = {
  //   TableName: process.env.table_name,
  //   ProjectionExpression: "PhotoId, PhotoUrl, AlbumName, PhotoOrder",
  //   KeyConditionExpression: "AlbumId = :album_id",
  //   ExpressionAttributeValues: {
  //     ":album_id": { S: "all" },
  //   },
  //   Limit: 10,
  //   ScanIndexForward: false,
  // };
  // const command = new QueryCommand(params);
  // const data = await dynamoClient.send(command);

  const response = {
    statusCode: 200,
    body: JSON.stringify(uploadResult),
  };

  return response;
};
