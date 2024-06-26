import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { APIGatewayEvent, Context } from "aws-lambda";

export const handler = async (event: APIGatewayEvent, context: Context) => {
  const client = new DynamoDBClient();

  const params: QueryCommandInput = {
    TableName: process.env.table_name,
    ProjectionExpression:
      "PhotoId, PhotoUrl, AlbumName, PhotoOrder, PhotoWidth, PhotoHeight",
    KeyConditionExpression: "AlbumId = :album_id",
    ExpressionAttributeValues: {
      ":album_id": { S: "all" },
    },
    Limit: 10,
    ScanIndexForward: false,
  };
  const command = new QueryCommand(params);
  const queryResult = await client.send(command);
  const data = {
    photos: queryResult.Items?.map((item) => {
      return {
        id: item.PhotoId?.S,
        url: item.PhotoUrl?.S,
        albumName: item.AlbumName?.S,
        itemCreatedAt: item.ItemCreatedAt?.N,
        width: item.PhotoWidth?.N,
        height: item.PhotoHeight?.N,
      };
    }),
    meta: {
      total: queryResult.Count,
      lastEvaluatedKey: queryResult.LastEvaluatedKey,
      limit: 10,
    },
  };

  console.info(data.photos);

  const response = {
    statusCode: 200,
    body: JSON.stringify(data),
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    },
  };

  return response;
};
