import { Handler } from "aws-lambda";
import { SecretsManager } from "aws-sdk";
import { Client } from "pg";

const RDS_ARN = process.env.RDS_ARN!;
const CREDENTIALS_ARN = process.env.CREDENTIALS_ARN!;

const secrets = new SecretsManager();

export const handler: Handler = async () => {
  try {
    // Retrieve RDS Admin credentials
    console.log("retrieving admin credentials...");
    const adminSecret = await secrets
      .getSecretValue({ SecretId: RDS_ARN })
      .promise();
    const admin = JSON.parse(adminSecret.SecretString as string);

    // Retrieve RDS User credentials
    console.log("retrieving library credentials...");
    const credentialsSecret = await secrets
      .getSecretValue({ SecretId: CREDENTIALS_ARN })
      .promise();
    const credentials = JSON.parse(credentialsSecret.SecretString as string);

    // Instantiate RDS Client with Admin
    console.log("instantiating client with admin...");
    const client = new Client({
      host: admin.host,
      user: admin.username,
      password: admin.password,
      database: "postgres",
      port: 5432,
    });

    // Connect to RDS instance with Admin
    console.log("connecting to rds with admin...");
    await client.connect();

    // Check if the database already exists
    const databaseExistsQuery = "SELECT 1 FROM pg_database WHERE datname = $1";
    const databaseExistsResult = await client.query(databaseExistsQuery, [
      "products",
    ]);

    if (databaseExistsResult.rows.length === 0) {
      // Database doesn't exist, create it
      console.log("setting up new database...");
      await client.query("CREATE DATABASE products;");
    } else {
      console.log("database already exists, skipping creation...");
    }

    await client.end();

    // Instantiate RDS Client with new user
    console.log("instantiating client with new user...");
    const userClient = new Client({
      host: admin.host,
      user: credentials.username,
      password: credentials.password,
      database: "products",
      port: 5432,
    });

    // Connect to RDS instance
    console.log("connecting to rds with new user...");
    console.log("Admin credentials:", admin);
    console.log("Library credentials:", credentials);

    await userClient.connect();

    // Check if the table already exists
    const tableExistsQuery = "SELECT to_regclass($1) IS NOT NULL";
    const tableExistsResult = await userClient.query(tableExistsQuery, [
      "library",
    ]);

    if (!tableExistsResult.rows[0].is_not_null) {
      // Table doesn't exist, create it
      console.log("creating new table...");
      const createTableCommand = [
        "CREATE TABLE library (",
        "isbn VARCHAR(50) UNIQUE NOT NULL, ",
        "name VARCHAR(50) NOT NULL, ",
        "authors VARCHAR(50)[] NOT NULL, ",
        "languages VARCHAR(50)[] NOT NULL, ",
        "countries VARCHAR(50)[] NOT NULL, ",
        "numberOfPages integer, ",
        "releaseDate VARCHAR(50) NOT NULL);",
      ];
      await userClient.query(createTableCommand.join(""));
    } else {
      console.log("table already exists, skipping creation...");
    }

    console.log("tasks completed!");
    await userClient.end();
  } catch (error) {
    console.error("Error creating database:", error);
    throw error;
  }
};
