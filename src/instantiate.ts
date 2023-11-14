import { Handler } from 'aws-lambda';
import { SecretsManager } from 'aws-sdk';
import { Client } from 'pg';

const RDS_ARN = process.env.RDS_ARN!;

const secrets = new SecretsManager();

export const handler: Handler = async () => {
    try {
      // Retrieve RDS Admin credentials
      console.log('retrieving admin credentials...');
      const adminSecret = await secrets.getSecretValue({ SecretId: RDS_ARN }).promise();
      const admin = JSON.parse(adminSecret.SecretString as string);
  
      // Instantiate RDS Client with Admin
      console.log('instantiating client with admin...', admin);
      const client = new Client({
        host: admin.host,
        user: admin.username,
        password: admin.password,
        database: 'libraryDatabase',
        port: 5432,
      });
  
      // Connect to RDS instance with Admin
      console.log('connecting to rds with admin credentials...');
      await client.connect();
  
      // Setting up new database
      console.log('setting up new database...');
      // await client.query('CREATE DATABASE productdb;');
  
      // Instantiate RDS Client with admin for further operations
      console.log('instantiating client for further operations...');
      const adminClient = new Client({
        host: admin.host,
        user: admin.username,
        password: admin.password,
        database: 'libraryDatabase', // Use the newly created database
        port: 5432,
      });

      // Connect to RDS instance with Admin for further operations
      console.log('connecting to rds for further operations...');
      await adminClient.connect();
  
      // Creating new table
      console.log('creating new table...');
      const createTableCommand = [
        'CREATE TABLE library (',
        'isbn VARCHAR(50) UNIQUE NOT NULL, ',
        'name VARCHAR(50) NOT NULL, ',
        'authors VARCHAR(50)[] NOT NULL, ',
        'languages VARCHAR(50)[] NOT NULL, ',
        'countries VARCHAR(50)[] NOT NULL, ',
        'numberOfPages integer, ',
        'releaseDate VARCHAR(50) NOT NULL);',
      ];
      await adminClient.query(createTableCommand.join(''));
      console.log('tasks completed!');
  
      // Close connections
      await adminClient.end();
      await client.end();

    } catch (error) {
      console.error('Error creating database:', error);
      throw error;
    }
};
