import {
  DynamoDBClient,
  DeleteItemCommand,
  DeleteItemCommandInput,
  QueryCommandInput,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { APIGatewayEvent, Context } from "aws-lambda";

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
    if (!result.Items) {
      throw new Error("Items not returned from DynamoDB query");
    }

    return result.Items.map((item, i) => {
      if (!item.AlbumId.S) {
        throw new Error(`${i + 1}th item is missing AlbumId`);
      }
      if (!item.ItemCreatedAt.N) {
        throw new Error(`${i + 1}th item is missing ItemCreatedAt`);
      }

      return {
        AlbumId: item.AlbumId.S,
        ItemCreatedAt: Number(item.ItemCreatedAt.N),
      };
    });
  } catch (error) {
    console.error(error);
    throw new Error("Error getting item keys from DynamoDB");
  }
};

export const handler = async (event: APIGatewayEvent, context: Context) => {
  const client = new DynamoDBClient();

  const requestBody: RequestBody = JSON.parse(event.body || "{}");
  const itemKeys = await getItemKeys(requestBody.albumId, requestBody.photoIds);

  console.log(itemKeys);

  const responseBody: ResponseBody = await Promise.all(
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
        await client.send(command);
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

  const response = {
    statusCode: 200,
    body: JSON.stringify(responseBody),
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    },
  };

  return response;
};
