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
    // 1. Create User
    const userResult: QueryResult<UserRow> = await client.query(`
      INSERT INTO "User" ("id", "email", "password", "name", "role", "createdAt", "updatedAt")
      VALUES ('user-demo-1', 'demo@smart360.com', 'hashed-123', 'Demo Owner', 'STORE_OWNER', NOW(), NOW())
      ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name"
      RETURNING "id";
    `);

    let finalUserId = 'user-demo-1';

    if (userResult.rows.length > 0) {
      finalUserId = userResult.rows[0].id;
    } else {
      // Check if user exists if upsert didn't return (though RETURNING should work with DO UPDATE in PG)
      const existing: QueryResult<UserRow> = await client.query(
        `SELECT id FROM "User" WHERE email = 'demo@smart360.com'`,
      );
      if (existing.rows.length > 0) {
        finalUserId = existing.rows[0].id;
      }
    }

    // 2. Create Store
    await client.query(
      `
      INSERT INTO "Store" ("id", "name", "slug", "ownerId", "createdAt", "updatedAt")
      VALUES ('store-123', 'Demo Furniture Store', 'demo-store', $1, NOW(), NOW())
      ON CONFLICT ("id") DO NOTHING;
    `,
      [finalUserId],
    );

    // 3. Create Products
    // Clear old products for this store first to avoid dupes/mess
    await client.query(`DELETE FROM "Product" WHERE "storeId" = 'store-123'`);

    await client.query(`
      INSERT INTO "Product" ("id", "storeId", "title", "category", "price", "description", "currency", "galleryImages", "tags", "createdAt", "updatedAt")
      VALUES 
      (gen_random_uuid(), 'store-123', 'Modern Office Chair', 'chair', 199.99, 'Ergonomic black office chair', 'USD', ARRAY[]::text[], ARRAY[]::text[], NOW(), NOW()),
      (gen_random_uuid(), 'store-123', 'Executive Desk Laptop', 'laptop', 999.00, 'High performance laptop', 'USD', ARRAY[]::text[], ARRAY[]::text[], NOW(), NOW()),
      (gen_random_uuid(), 'store-123', 'Decorative Plant', 'potted plant', 25.50, 'Green fern', 'USD', ARRAY[]::text[], ARRAY[]::text[], NOW(), NOW());
    `);

    console.log('✅ Seed successful! Store: store-123 created with products.');
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
