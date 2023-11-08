import * as cdk from "aws-cdk-lib";
import * as constructs from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class MyCdkProjectStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const dynamoTable = new dynamodb.Table(this, "MyDynamoDBTable", {
      partitionKey: { name: "itemId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Adjust as needed
      billingMode: dynamodb.BillingMode.PROVISIONED, // Use Provisioned billing mode for Free Tier
      readCapacity: 5, // Adjust based on your expected usage within Free Tier limits
      writeCapacity: 5, // Adjust based on your expected usage within Free Tier limits
    });

    // Lambda Functions
    const getAllItemsFunction = new lambda.Function(
      this,
      "getAllItemsFunction",
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "get-all.handler",
        code: lambda.Code.fromAsset("src"), // Replace with the correct code directory
        environment: {
          TABLE_NAME: dynamoTable.tableName,
          PRIMARY_KEY: "itemId",
        },
      }
    );

    const createItemFunction = new lambda.Function(this, "createItemFunction", {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "create.handler",
      code: lambda.Code.fromAsset("src"), // Replace with the correct code directory
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        PRIMARY_KEY: "itemId",
      },
    });

    // Grant Permissions
    dynamoTable.grantReadWriteData(createItemFunction);
    dynamoTable.grantReadData(getAllItemsFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, "MyApi", {
      restApiName: "My API",
    });

    const rootResource = api.root;

    // Integration with Lambda Functions
    const getAllIntegration = new apigateway.LambdaIntegration(
      getAllItemsFunction
    );
    rootResource.addMethod("GET", getAllIntegration);

    const createIntegration = new apigateway.LambdaIntegration(
      createItemFunction
    );
    rootResource.addResource("create").addMethod("POST", createIntegration);
  }
}
