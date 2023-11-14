import { Handler } from 'aws-lambda';
import { SecretsManager } from 'aws-sdk';
import { Client } from 'pg';

const RDS_SECRET_ARN = process.env.RDS_SECRET_ARN!;
const DB_NAME = process.env.DB_NAME!;
const TABLE_NAME = process.env.TABLE_NAME!;

const secrets = new SecretsManager();

export const handler: Handler = async () => {
    try {
      // Retrieve RDS Admin credentials
      const adminSecret = await secrets.getSecretValue({ SecretId: RDS_SECRET_ARN }).promise();
      const admin = JSON.parse(adminSecret.SecretString as string);

      // Instantiate RDS Client with Admin
      const client = new Client({
        host: admin.host,
        user: admin.username,
        password: admin.password,
        database: 'postgres',
        port: 5432,
      });

      // Connect to RDS instance with Admin
      await client.connect();
      console.log('Setting up a new database...');
      await client.query(`CREATE DATABASE ${DB_NAME};`);
      await client.query(`\\c ${DB_NAME}`);
      console.log('Setting up a new table...');
      const createTableCommand = `
        CREATE TABLE ${TABLE_NAME} (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          description VARCHAR(1000),
          price DECIMAL(10, 2)
        );`;
      await client.query(createTableCommand);
      console.log('Setup completed!');
      await client.end();

    } catch (error) {
      console.error('Error creating database:', error);
      throw error;
    }
};
