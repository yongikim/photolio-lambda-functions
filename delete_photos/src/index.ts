import {
  DynamoDBClient,
  DeleteItemCommand,
  DeleteItemCommandInput,
  QueryCommandInput,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { APIGatewayEvent, Context } from "aws-lambda";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const handler = async (event: APIGatewayEvent, context: Context) => {
  const requestBody: RequestBody = JSON.parse(event.body || "{}");

  const itemKeys = await getItemKeys(requestBody.albumId, requestBody.photoIds);
  console.log(itemKeys);

  const responseBody = await deleteItems(itemKeys);

  return {
    statusCode: 200,
    body: JSON.stringify(responseBody),
    headers,
  };
};

const headers = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE",
};

type RequestBody = {
  albumId: string;
  photoIds: string[];
};

type ResponseBody = {
  success: Boolean;
}[];

type ItemKey = {
  AlbumId: string;
  ItemCreatedAt: number;
  PhotoId: string;
};

const getItemKeys = async (
  albumId: string,
  photoIds: string[]
): Promise<ItemKey[]> => {
  const client = new DynamoDBClient();

  const expressionAttributeValues: {
    [key: string]: { S: string };
  } = {
    ":album_id": { S: albumId },
  };
  photoIds.forEach((id, i) => {
    expressionAttributeValues[`:photo_ids${i}`] = { S: id };
  });

  const filterExpression = `PhotoId IN (${photoIds
    .map((_, i) => `:photo_ids${i}`)
    .join(",")})`;

  const params: QueryCommandInput = {
    TableName: process.env.table_name,
    KeyConditionExpression: "AlbumId = :album_id",
    FilterExpression: filterExpression,
    ExpressionAttributeValues: expressionAttributeValues,
  };

  try {
    const result = await client.send(new QueryCommand(params));
    if (!result.Items || !result.Items.length) {
      throw new Error("Items not returned from DynamoDB query");
    }

    return result.Items.map((item, i) => {
      if (!item.AlbumId.S) {
        throw new Error(`${i + 1}th item is missing AlbumId`);
      }
      if (!item.ItemCreatedAt.N) {
        throw new Error(`${i + 1}th item is missing ItemCreatedAt`);
      }
      if (!item.PhotoId.S) {
        throw new Error(`${i + 1}th item is missing PhotoId`);
      }

      return {
        AlbumId: item.AlbumId.S,
        ItemCreatedAt: Number(item.ItemCreatedAt.N),
        PhotoId: item.PhotoId.S,
      };
    });
  } catch (error) {
    console.error(error);
    throw new Error("Error getting item keys from DynamoDB");
  }
};

const deleteItems = async (itemKeys: ItemKey[]): Promise<ResponseBody> => {
  const dynamoDBClient = new DynamoDBClient();
  const s3Client = new S3Client();
  return await Promise.all(
    itemKeys.map(async (key) => {
      const params: DeleteItemCommandInput = {
        TableName: process.env.table_name,
        Key: {
          AlbumId: { S: key.AlbumId },
          ItemCreatedAt: { N: key.ItemCreatedAt.toString() },
        },
      };
      const command = new DeleteItemCommand(params);
      try {
        await dynamoDBClient.send(command);
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: "photolio-photos",
            Key: `${key.PhotoId}.jpeg`,
          })
        );
        return {
          success: true,
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
        };
      }
    })
  );
};
