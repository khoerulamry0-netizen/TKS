import { db } from './src/db/index.js';
import * as schema from './src/db/schema.js';
import { sql } from 'drizzle-orm';

async function test() {
  const data = [
    { id: '1', skuId: 'A', skuName: 'A', barcode: 'A', brand: 'A', location: 'A', warehouse: 'A', expiredDate: 'A', qty: 10 },
  ];
  try {
    await db.insert(schema.inventory).values(data).onConflictDoUpdate({
      target: schema.inventory.id,
      set: {
        qty: sql`excluded.qty`
      }
    });
    console.log("Excluded syntax works!");
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
test();
