import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cr from "aws-cdk-lib/custom-resources";

export class RDSStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "MyVPC", {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "PrivateSubnet",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const adminSecret = new secretsmanager.Secret(this, "MyAdminSecret", {
      secretName: "admin-secret",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: "your-master-username",
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: "password",
      },
    });


    
    // RDS Instance
    const rdsInstance = new rds.DatabaseInstance(this, "MyRDSInstance", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      credentials: rds.Credentials.fromGeneratedSecret("adminSecret"),
    });

    // IAM Role
    const role = new iam.Role(this, "MyRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    // Grant permissions to the RDS instance secret
    if (rdsInstance.secret) {
      rdsInstance.secret.grantRead(role);
    } else {
      console.error("rdsInstance.secret is not set. Check your RDS instance configuration.");
    }

    // Lambda function
    const instantiateFunction = new lambda.Function(this, "InstantiateFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("src"), // Assuming your Lambda code is in a 'src' directory
      role,
      environment: {
        RDS_SECRET_ARN: rdsInstance.secret?.secretArn || "", // Pass the secret ARN to Lambda
        DB_NAME: "mydatabase",
        TABLE_NAME: "products",
      },
    });

    // Use the AWS SDK to get the Lambda function ARN
    const lambdaFunctionArn = instantiateFunction.functionArn;

    // Attach a policy to grant Lambda InvokeFunction permission
    role.attachInlinePolicy(
      new iam.Policy(this, 'LambdaInvokePolicy', {
        statements: [
          new iam.PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            effect: iam.Effect.ALLOW,
            resources: [lambdaFunctionArn],
          }),
        ],
      })
    );

    // Trigger Lambda function with a custom resource
    new cr.AwsCustomResource(this, "TriggerInstantiate", {
      onUpdate: {
        service: "Lambda",
        action: "invoke",
        physicalResourceId: cr.PhysicalResourceId.of("TriggerInstantiate"),
        parameters: {
          FunctionName: instantiateFunction.functionName,
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [lambdaFunctionArn],
      }),
    });
  }
}
