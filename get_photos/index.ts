import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { APIGatewayEvent, Context } from "aws-lambda";

export const handler = async (event: APIGatewayEvent, context: Context) => {
  const client = new DynamoDBClient();
  const params = {
    TableName: process.env.table_name,
  };
  const command = new ScanCommand(params);
  const data = await client.send(command);

  const response = {
    statusCode: 200,
    body: JSON.stringify(data),
  };

  return response;
};
