import { Handler } from 'aws-lambda';
import { SecretsManager } from 'aws-sdk';
import { Client } from 'pg';

const RDS_ARN = process.env.RDS_ARN!;
const HOST = process.env.HOST!;

const secrets = new SecretsManager();

interface IAddEvent {
  isbn: string,
  name: string,
  authors: string[],
  languages: string[],
  countries: string[],
  numberOfPages: number,
  releaseDate: string,
}

export const handler: Handler = async (event:IAddEvent) => {
    try {
      // Retrieve RDS User credentials
      console.log('retrieving library credentials...');
      const adminSecret = await secrets.getSecretValue({ SecretId: RDS_ARN }).promise();
      const admin = JSON.parse(adminSecret.SecretString as string);
  
      // Instantiate RDS Client
      console.log('instantiating rds client...');
      const client = new Client({
        host: admin.host,
        user: admin.username,
        password: admin.password,
        database: 'libraryDatabase',
        port: 5432,
      });
  
      // Connect to RDS instance
      console.log('connecting to rds...');
      await client.connect();

      console.log('adding book...');
      await client.query(`INSERT INTO library (isbn, name, authors, languages, countries, numberOfPages, releaseDate) VALUES('${
        event.isbn
      }', '${
        event.name
      }', '{${
        event.authors
      }}', '{${
        event.languages
      }}', '{${
        event.countries
      }}', '${
        event.numberOfPages
      }', '${
        event.releaseDate
      }')`);

      // Break connection
      console.log('tasks completed!');
      await client.end();
    } catch (error) {
      console.error('Error creating database:', error);
      throw error;
    }
  };