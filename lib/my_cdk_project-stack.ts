import * as cdk from "aws-cdk-lib";
import * as constructs from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as kms from "aws-cdk-lib/aws-kms";

export class MyCdkProjectStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "MyVPC", {
      maxAzs: 2, // Number of availability zones
      subnetConfiguration: [
        {
          cidrMask: 24, // Subnet size (adjust as needed)
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC, // Public subnet
        },
        {
          cidrMask: 24, // Subnet size (adjust as needed)
          name: "PrivateSubnet",
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT, // Private subnet with NAT
        },
      ],
    });

    const myKey = new kms.Key(this, "MyKey");
    const postgresEngine = rds.DatabaseInstanceEngine.postgres({
      version: rds.PostgresEngineVersion.VER_15_2, // Adjust the version as needed
    });

    new rds.DatabaseInstance(this, "InstanceWithCustomizedSecret", {
      engine: postgresEngine, // Use the PostgreSQL engine
      vpc,
      credentials: rds.Credentials.fromGeneratedSecret("postgres", {
        secretName: "my-cool-name",
        encryptionKey: myKey,
        excludeCharacters: "!&*^#@()",
        replicaRegions: [{ region: "eu-west-1" }, { region: "eu-west-2" }],
      }),
    });

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
