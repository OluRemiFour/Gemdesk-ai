import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (as it's in the root)
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('Error: MONGODB_URI not found in .env file');
  process.exit(1);
}

console.log(`Connecting to: ${uri.replace(/:([^:@]+)@/, ':****@')}`);

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    console.log('Successfully connected to MongoDB!');
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log('Collections available:', collections.map(c => c.name));
    
  } catch (error) {
    console.error('Failed to connect to MongoDB:');
    console.error(error.message);
  } finally {
    await client.close();
  }
}

run();
