import { saveDbState, getDbState } from './src/db/sync.js';
import { initialInventory, initialOrders, initialInbound, initialReturns, initialTasks, initialUsers } from './src/data/initialData.js';

async function test() {
  try {
    console.log("Starting full save test...");
    await saveDbState({
      users: initialUsers,
      inventory: initialInventory,
      orders: initialOrders,
      inbounds: initialInbound,
      returns: initialReturns,
      tasks: initialTasks
    });
    console.log("Full save succeeded!");
    const dbState = await getDbState();
    console.log("Fetched users count:", dbState.users.length);
    console.log("Fetched inventory count:", dbState.inventory.length);
    console.log("Fetched orders count:", dbState.orders.length);
    console.log("Fetched inbounds count:", dbState.inbounds.length);
    console.log("Fetched returns count:", dbState.returns.length);
    console.log("Fetched tasks count:", dbState.tasks.length);
  } catch (error: any) {
    console.error("Full save test failed:", error);
    if (error.stack) console.error(error.stack);
  }
  process.exit(0);
}

test();
