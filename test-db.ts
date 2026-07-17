import { db } from './src/db/index.js';
import * as schema from './src/db/schema.js';
import { saveDbState } from './src/db/sync.js';

async function test() {
  try {
    console.log("Starting test save");
    await saveDbState({
      inventory: [{
        id: 'TEST-123',
        skuId: 'TEST-SKU',
        skuName: 'TEST NAME',
        barcode: '12345',
        brand: 'TEST',
        qty: 10,
        location: 'A1',
        warehouse: 'W1',
        expiredDate: '31/12/2028',
        lowStockThreshold: 10
      }]
    });
    console.log("Saved successfully");
    const inv = await db.select().from(schema.inventory);
    console.log("Inventory count:", inv.length);
    const usr = await db.select().from(schema.users);
    console.log("Users count:", usr.length);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
test();
