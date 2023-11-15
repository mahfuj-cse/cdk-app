import * as cdk from "aws-cdk-lib";
import * as constructs from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class ApiGatewayStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    const api = new apigateway.RestApi(this, "MyApi", {
      restApiName: "My API",
    });

    const rootResource = api.root;

    const getAllIntegration = new apigateway.LambdaIntegration(
      listProductFunction
    );
    rootResource.addMethod("GET", getAllIntegration);

    const productResource = rootResource.addResource("product");

    const createProductFunction = new lambda.Function(
      this,
      "CreateProductFunction",
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "src/handlers.createProduct",
        code: lambda.Code.fromAsset("src"),
      }
    );

    const createProductIntegration = new apigateway.LambdaIntegration(
      createProductFunction
    );
    productResource.addMethod("POST", createProductIntegration);

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

    const productsResource = rootResource.addResource("products");
    const listProductsIntegration = new apigateway.LambdaIntegration(
      listProductFunction
    );
    productsResource.addMethod("GET", listProductsIntegration);
  }
}
