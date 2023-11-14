#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CdkTsRdsStack } from "../lib/my_cdk_project-stack";
import { ApiGatewayStack } from "../lib/api-gateway-stack";

const app = new cdk.App();
new CdkTsRdsStack(app, "MyCdkProjectStack", {});
new ApiGatewayStack(app, "ApiGatewayStack", {});
