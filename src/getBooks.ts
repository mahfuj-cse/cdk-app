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
        console.log("🚀 ~ file: getBooks.ts:16 ~ consthandler:Handler= ~ admin:", admin);

        // Instantiate RDS Client with Admin
        console.log('instantiating rds client with admin...');
        const client = new Client({
            host: admin.host,
            user: admin.username,
            password: admin.password,
            database: 'libraryDatabase', // Use the newly created database name
            port: 5432,
        });

        // Connect to RDS instance with Admin
        console.log('connecting to rds with admin...');
        await client.connect();

        console.log('getting books...');
        const query = await client.query('SELECT * FROM library LIMIT 10');
        console.log(query.rows);

        // Break connection
        console.log('tasks completed!');
        await client.end();
    } catch (error) {
        console.error('Error retrieving books:', error);
        throw error;
    }
};
