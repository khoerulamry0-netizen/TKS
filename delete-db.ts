import { db } from './src/db/index.js';
import * as schema from './src/db/schema.js';
async function run() {
  await db.delete(schema.inventory);
  await db.delete(schema.users);
  await db.delete(schema.orders);
  await db.delete(schema.inbounds);
  await db.delete(schema.returns);
  await db.delete(schema.tasks);
  process.exit(0);
}
run();
