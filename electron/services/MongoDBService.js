import { MongoClient } from 'mongodb';
// No need to check for process.env here if it's already handled in main process, 
// but keeping it for flexibility.

class MongoDBService {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect(uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gemdesk') {
    try {
      if (!uri) {
        throw new Error('MONGODB_URI is not defined in environment variables');
      }
      
      console.log(`[MongoDB] Attempting to connect to: ${uri.replace(/:([^:@]+)@/, ':****@')}`);
      
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        heartbeatFrequencyMS: 2000,
      });

      await this.client.connect();
      
      // Verify connection by pinging the database
      const db = this.client.db();
      await db.command({ ping: 1 });
      
      this.db = db;
      console.log('[MongoDB] Connected successfully and pinged!');
      return true;
    } catch (error) {
      console.error('[MongoDB] Connection failed!');
      console.error('[MongoDB] Error Name:', error.name);
      console.error('[MongoDB] Error Message:', error.message);
      
      if (error.message.includes('MONGODB_URI is not defined')) {
        console.error('[MongoDB] TIP: Check your .env file and ensure MONGODB_URI is set correctly.');
      } else if (error.name === 'MongoServerSelectionError') {
        console.error('[MongoDB] TIP: This usually means the MongoDB server is unreachable. Check your network or firewall.');
      }
      
      if (error.code) console.error('[MongoDB] Error Code:', error.code);
      if (error.stack) console.error('[MongoDB] Stack:', error.stack);
      
      this.db = null;
      this.client = null;
      return false;
    }
  }

  getDb() {
    if (!this.db) {
      console.error('[MongoDB] Database not connected. Call connect() first.');
    }
    return this.db;
  }

  isConnected() {
    return this.db !== null && this.client !== null;
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log('MongoDB connection closed');
    }
  }
}

export default new MongoDBService();
