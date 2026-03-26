import { Client, QueryResult } from 'pg';
import 'dotenv/config';

interface UserRow {
  id: string;
}

async function main() {
  console.log('🌱 Starting seed via PG...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const users = [
      { id: 'user-1', email: 'user1@smart360.com', name: 'Alice (User 1)', storeId: 'store-1', storeName: 'Alice Furniture' },
      { id: 'user-2', email: 'user2@smart360.com', name: 'Bob (User 2)', storeId: 'store-2', storeName: 'Bob Electronics' },
      { id: 'user-3', email: 'user3@smart360.com', name: 'Charlie (User 3)', storeId: 'store-3', storeName: 'Charlie Sports' },
    ];

    for (const u of users) {
      // 1. Create User
      await client.query(`
        INSERT INTO "User" ("id", "email", "password", "name", "role", "createdAt", "updatedAt")
        VALUES ($1, $2, 'mock-password', $3, 'STORE_OWNER', NOW(), NOW())
        ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name";
      `, [u.id, u.email, u.name]);

      // 2. Create Store
      await client.query(`
        INSERT INTO "Store" ("id", "name", "slug", "ownerId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT ("id") DO NOTHING;
      `, [u.storeId, u.storeName, `${u.storeId}-slug`, u.id]);
      
      console.log(`✅ Seeded User: ${u.name} and Store: ${u.storeName}`);
    }

    console.log('✅ Seed successful! 3 mock users and stores created.');
  } catch (e) {
    console.error('Seed Error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
