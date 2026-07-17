import { db } from './src/db/index.js';
import * as schema from './src/db/schema.js';

async function test() {
  const data = [
    { id: '1', skuId: 'A', skuName: 'A', barcode: 'A', brand: 'A', location: 'A', warehouse: 'A', expiredDate: 'A' },
    { id: '2', skuId: 'B', skuName: 'B', barcode: 'B', brand: 'B', location: 'B', warehouse: 'B', expiredDate: 'B' }
  ];
  try {
    await db.insert(schema.inventory).values(data).onConflictDoUpdate({
      target: schema.inventory.id,
      set: {
        qty: 0
      }
    });
    console.log("Bulk upsert supported!");
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
test();
