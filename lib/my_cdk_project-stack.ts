import * as cdk from "aws-cdk-lib";
import * as constructs from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as cr from "aws-cdk-lib/custom-resources";

export class MyCdkProjectStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda Functions
    const createProductFunction = new lambda.Function(
      this,
      "CreateProductFunction",
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "src/handlers.createProduct",
        code: lambda.Code.fromAsset("src"),
      }
    );

    const getProductFunction = new lambda.Function(this, "GetProductFunction", {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "src/handlers.getProduct",
      code: lambda.Code.fromAsset("src"),
    });

    const updateProductFunction = new lambda.Function(
      this,
      "UpdateProductFunction",
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "src/handlers.updateProduct",
        code: lambda.Code.fromAsset("src"),
      }
    );

    const deleteProductFunction = new lambda.Function(
      this,
      "DeleteProductFunction",
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "src/handlers.deleteProduct",
        code: lambda.Code.fromAsset("src"),
      }
    );

    const listProductFunction = new lambda.Function(
      this,
      "ListProductFunction",
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "src/handlers.listProduct",
        code: lambda.Code.fromAsset("src"),
      }
    );

    // API Gateway
    const api = new apigateway.RestApi(this, "MyApi", {
      restApiName: "My API",
    });

    const rootResource = api.root;

    // Integration with Lambda Functions
    const getAllIntegration = new apigateway.LambdaIntegration(
      listProductFunction
    );
    rootResource.addMethod("GET", getAllIntegration);

    // Create resource for individual product
    const productResource = rootResource.addResource("product");

    // POST - /product
    const createProductIntegration = new apigateway.LambdaIntegration(
      createProductFunction
    );
    productResource.addMethod("POST", createProductIntegration);

    // GET, PUT, DELETE - /product/{id}
    const productIdResource = productResource.addResource("{id}");

    const getProductIntegration = new apigateway.LambdaIntegration(
      getProductFunction
    );
    productIdResource.addMethod("GET", getProductIntegration);

    const updateProductIntegration = new apigateway.LambdaIntegration(
      updateProductFunction
    );
    productIdResource.addMethod("PUT", updateProductIntegration);

    const deleteProductIntegration = new apigateway.LambdaIntegration(
      deleteProductFunction
    );
    productIdResource.addMethod("DELETE", deleteProductIntegration);

    // GET - /products
    const listProductsIntegration = new apigateway.LambdaIntegration(
      listProductFunction
    );
    const productsResource = rootResource.addResource("products");
    productsResource.addMethod("GET", listProductsIntegration);
    // VPC for RDS and Lambda resolvers
    const vpc = new ec2.Vpc(this, "VPC", {
      vpcName: "rds-vpc",
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
          name: "rds",
        },
      ],
    });

    // Security Groups
    const securityGroupResolvers = new ec2.SecurityGroup(
      this,
      "SecurityGroupResolvers",
      {
        vpc,
        securityGroupName: "resolvers-sg",
        description: "Security Group with Resolvers",
      }
    );
    const securityGroupRds = new ec2.SecurityGroup(this, "SecurityGroupRds", {
      vpc,
      securityGroupName: "rds-sg",
      description: "Security Group with RDS",
    });

    // Ingress and Egress Rules
    securityGroupRds.addIngressRule(
      securityGroupResolvers,
      ec2.Port.tcp(5432),
      "Allow inbound traffic to RDS"
    );

    // VPC Interfaces
    vpc.addInterfaceEndpoint("LAMBDA", {
      service: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
      subnets: { subnets: vpc.isolatedSubnets },
      securityGroups: [securityGroupResolvers],
    });
    vpc.addInterfaceEndpoint("SECRETS_MANAGER", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnets: vpc.isolatedSubnets },
      securityGroups: [securityGroupResolvers],
    });

    // IAM Role
    const role = new iam.Role(this, "Role", {
      roleName: "rds-role",
      description: "Role used in the RDS stack",
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("ec2.amazonaws.com"),
        new iam.ServicePrincipal("lambda.amazonaws.com")
      ),
    });
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "cloudwatch:PutMetricData",
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:DescribeInstances",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeRouteTables",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "lambda:InvokeFunction",
          "secretsmanager:GetSecretValue",
          "kms:decrypt",
          "rds-db:connect",
        ],
        resources: ["*"],
      })
    );

    // RDS PostgreSQL Instance
    const rdsInstance = new rds.DatabaseInstance(this, "PostgresRds", {
      vpc,
      securityGroups: [securityGroupRds],
      vpcSubnets: { subnets: vpc.isolatedSubnets },
      availabilityZone: vpc.isolatedSubnets[0].availabilityZone,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.SMALL
      ),
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14_6,
      }),
      port: 5432,
      instanceIdentifier: "librarydb-instance",
      allocatedStorage: 10,
      maxAllocatedStorage: 10,
      deleteAutomatedBackups: true,
      backupRetention: cdk.Duration.millis(0),
      credentials: rds.Credentials.fromUsername("libraryadmin"),
      publiclyAccessible: false,
    });
    rdsInstance.secret?.grantRead(role);

    // Secrets for database credentials.
    // const credentials = secrets.Secret.fromSecretCompleteArn(this, 'CredentialsSecret', 'arn:aws:secretsmanager:us-east-1:253399877957:secret:rds-db-creds-W8vvei')
    // credentials.grantRead(role)

    // Secrets for database credentials.
    const credentialsSecret = new secrets.Secret(this, "CredentialsSecret", {
      secretName: "rds-db-credsv", // Replace with your desired secret name
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "libraryadmin" }), // Replace with the desired username
        generateStringKey: "password",
        excludePunctuation: true,
        passwordLength: 20, // Adjust the length as needed
      },
    });

    // Grant read permissions to the IAM role
    credentialsSecret.grantRead(role);

    const credentials = secrets.Secret.fromSecretCompleteArn(
      this,
      "CredentialsSecretReference",
      credentialsSecret.secretArn
    );
    credentials.grantRead(role);

    // Returns function to connect with RDS instance.
    const createResolver = (name: string, entry: string) =>
      new nodejs.NodejsFunction(this, name, {
        functionName: name,
        entry: entry,
        bundling: {
          externalModules: ["pg-native"],
        },
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: cdk.Duration.minutes(2),
        role,
        vpc,
        vpcSubnets: { subnets: vpc.isolatedSubnets },
        securityGroups: [securityGroupResolvers],
        environment: {
          RDS_ARN: rdsInstance.secret!.secretArn,
          CREDENTIALS_ARN: credentials.secretArn,
          HOST: rdsInstance.dbInstanceEndpointAddress,
        },
      });

    const instantiate = createResolver("instantiate", "src/instantiate.ts");
    instantiate.node.addDependency(rdsInstance);

    // Set environment variables for the Lambda function
    instantiate.addEnvironment(
      "CREDENTIALS_ARN",
      "arn:aws:secretsmanager:us-east-1:253399877957:secret:rds-db-credsv-1BLINF"
    ); // Replace with your actual ARN
    instantiate.addEnvironment(
      "HOST",
      "librarydb-instance.c4x9s2sxkrza.us-east-1.rds.amazonaws.com"
    ); // Replace with your actual RDS host

    // Lambda function for adding a book in the RDS table.
    const addBook = createResolver("add-book", "src/addBook.ts");
    addBook.node.addDependency(rdsInstance);
    addBook.addEnvironment(
      "CREDENTIALS_ARN",
      "arn:aws:secretsmanager:us-east-1:253399877957:secret:rds-db-credsv-1BLINF"
    ); // Replace with your actual ARN
    addBook.addEnvironment(
      "HOST",
      "librarydb-instance.c4x9s2sxkrza.us-east-1.rds.amazonaws.com"
    ); // Replace with your actual RDS host

    // Lambda function for getting books from the RDS table.
    const getBooks = createResolver("get-books", "src/getBooks.ts");
    getBooks.node.addDependency(rdsInstance);
    getBooks.addEnvironment(
      "CREDENTIALS_ARN",
      "arn:aws:secretsmanager:us-east-1:253399877957:secret:rds-db-credsv-1BLINF"
    ); // Replace with your actual ARN
    getBooks.addEnvironment(
      "HOST",
      "librarydb-instance.c4x9s2sxkrza.us-east-1.rds.amazonaws.com"
    ); // Replace with your actual RDS host

    // Custom Resource to execute instantiate function.
    const customResource = new cr.AwsCustomResource(
      this,
      "TriggerInstantiate",
      {
        functionName: "trigger-instantiate",
        role,
        onUpdate: {
          service: "Lambda",
          action: "invoke",
          parameters: {
            FunctionName: instantiate.functionName,
          },
          physicalResourceId: cr.PhysicalResourceId.of("TriggerInstantiate"),
        },
        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
          resources: [instantiate.functionArn],
        }),
      }
    );
    customResource.node.addDependency(instantiate);
  }
}
