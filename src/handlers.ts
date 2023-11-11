import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const headers = {
  "content-type": "application/json",
};

class HttpError extends Error {
  constructor(public statusCode: number, body: Record<string, unknown> = {}) {
    super(JSON.stringify(body));
  }
}

const handleError = (e: unknown) => {
  if (e instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: `invalid request body format : "${e.message}"`,
      }),
    };
  }

  if (e instanceof HttpError) {
    return {
      statusCode: e.statusCode,
      headers,
      body: e.message,
    };
  }

  throw e;
};

export const createProduct = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string);

    // Additional logic or validation if needed

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ message: "Product created successfully" }),
    };
  } catch (e) {
    return handleError(e);
  }
};

export const getProduct = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: "Product retrieved successfully" }),
  };
};

export const updateProduct = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: "Product updated successfully" }),
  };
};

export const deleteProduct = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 204,
    body: "",
  };
};

export const listProduct = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: "Product list retrieved successfully" }),
  };
};
