import fs from 'fs';

const content = `import { db } from './index.js';
import * as schema from './schema.js';
import { eq, inArray, notInArray, sql } from 'drizzle-orm';
import { initialInventory, initialOrders, initialInbound, initialReturns, initialTasks, initialUsers } from '../data/initialData.js';

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export async function getDbState() {
  let rawUsers = await db.select().from(schema.users);
  let inventory = await db.select().from(schema.inventory);
  
  if (inventory.length === 0) {
    console.log("Database empty, seeding initial data...");
    await saveDbState({
      users: initialUsers,
      inventory: initialInventory,
      orders: initialOrders,
      inbounds: initialInbound,
      returns: initialReturns,
      tasks: initialTasks
    });
    // Re-fetch after seeding
    inventory = await db.select().from(schema.inventory);
    rawUsers = await db.select().from(schema.users);
  }
  
  const users = rawUsers.map(u => {
    const initUser = initialUsers.find(iu => iu.id === u.uid);
    return {
      ...u,
      id: u.uid,
      password: initUser?.password || 'password123'
    };
  });
  
  const orders = await db.select().from(schema.orders);
  const inbounds = await db.select().from(schema.inbounds);
  const returns = await db.select().from(schema.returns);
  const tasks = await db.select().from(schema.tasks);
  
  return {
    users,
    inventory,
    orders,
    inbounds,
    returns,
    tasks,
    lastUpdated: Date.now() // Return current timestamp so client knows it's fresh
  };
}

export async function saveDbState(state: any) {
  await db.transaction(async (tx) => {
    // Users
    if (state.users) {
      const userIds = state.users.map((u: any) => u.id || u.uid).filter(Boolean);
      if (userIds.length > 0) {
        await tx.delete(schema.users).where(notInArray(schema.users.uid, userIds));
      } else {
        await tx.delete(schema.users);
      }
      if (state.users.length > 0) {
        const chunks = chunkArray(state.users, 100);
        for (const chunk of chunks) {
          await tx.insert(schema.users).values(chunk.map((user: any) => ({
            uid: user.id || user.uid || 'N/A',
            email: user.email || 'N/A',
            name: user.name || 'N/A',
            username: user.username || 'N/A',
            role: user.role || 'WORKER',
            avatar: user.avatar || null,
            joinDate: user.joinDate || new Date().toISOString()
          }))).onConflictDoUpdate({
            target: schema.users.uid,
            set: {
              name: sql\`excluded.name\`,
              role: sql\`excluded.role\`,
              avatar: sql\`excluded.avatar\`,
              email: sql\`excluded.email\`,
              username: sql\`excluded.username\`
            }
          });
        }
      }
    }

    // Inventory
    if (state.inventory) {
      const inventoryIds = state.inventory.map((item: any) => item.id).filter(Boolean);
      if (inventoryIds.length > 0) {
        await tx.delete(schema.inventory).where(notInArray(schema.inventory.id, inventoryIds));
      } else {
        await tx.delete(schema.inventory);
      }
      if (state.inventory.length > 0) {
        const chunks = chunkArray(state.inventory, 100);
        for (const chunk of chunks) {
          await tx.insert(schema.inventory).values(chunk.map((item: any) => ({
            id: item.id,
            skuId: item.skuId || 'N/A',
            skuName: item.skuName || 'Unknown SKU',
            barcode: item.barcode || 'N/A',
            brand: item.brand || 'No Brand',
            qty: item.qty || 0,
            location: item.location || 'N/A',
            warehouse: item.warehouse || 'N/A',
            expiredDate: item.expiredDate || '31/12/2028',
            lowStockThreshold: item.lowStockThreshold || 0,
            notes: item.notes || null,
            batchNumber: item.batchNumber || null,
            category: item.category || 'Default',
            price: item.price || 0,
            lastRestock: item.lastRestock || null
          }))).onConflictDoUpdate({
            target: schema.inventory.id,
            set: {
              qty: sql\`excluded.qty\`,
              location: sql\`excluded.location\`,
              brand: sql\`excluded.brand\`,
              expiredDate: sql\`excluded.expired_date\`,
              lowStockThreshold: sql\`excluded.low_stock_threshold\`,
              notes: sql\`excluded.notes\`,
              batchNumber: sql\`excluded.batch_number\`,
              category: sql\`excluded.category\`,
              price: sql\`excluded.price\`,
              lastRestock: sql\`excluded.last_restock\`
            }
          });
        }
      }
    }
    
    // Orders
    if (state.orders) {
      const orderIds = state.orders.map((order: any) => order.id).filter(Boolean);
      if (orderIds.length > 0) {
        await tx.delete(schema.orders).where(notInArray(schema.orders.id, orderIds));
      } else {
        await tx.delete(schema.orders);
      }
      if (state.orders.length > 0) {
        const chunks = chunkArray(state.orders, 100);
        for (const chunk of chunks) {
          await tx.insert(schema.orders).values(chunk.map((order: any) => ({
            id: order.id,
            orderNumber: order.orderNumber || 'N/A',
            customer: order.customer || 'N/A',
            status: order.status || 'PENDING',
            deadline: order.deadline || null,
            createdAt: order.createdAt || new Date().toISOString(),
            items: order.items || []
          }))).onConflictDoUpdate({
            target: schema.orders.id,
            set: {
              status: sql\`excluded.status\`,
              items: sql\`excluded.items\`
            }
          });
        }
      }
    }

    // Inbounds
    if (state.inbounds) {
      const inboundIds = state.inbounds.map((inb: any) => inb.id).filter(Boolean);
      if (inboundIds.length > 0) {
        await tx.delete(schema.inbounds).where(notInArray(schema.inbounds.id, inboundIds));
      } else {
        await tx.delete(schema.inbounds);
      }
      if (state.inbounds.length > 0) {
        const chunks = chunkArray(state.inbounds, 100);
        for (const chunk of chunks) {
          await tx.insert(schema.inbounds).values(chunk.map((inb: any) => ({
            id: inb.id,
            supplier: inb.supplier || 'N/A',
            reference: inb.reference || 'N/A',
            status: inb.status || 'PENDING',
            createdAt: inb.createdAt || new Date().toISOString(),
            items: inb.items || []
          }))).onConflictDoUpdate({
            target: schema.inbounds.id,
            set: {
              status: sql\`excluded.status\`,
              items: sql\`excluded.items\`
            }
          });
        }
      }
    }

    // Returns
    if (state.returns) {
      const returnIds = state.returns.map((ret: any) => ret.id).filter(Boolean);
      if (returnIds.length > 0) {
        await tx.delete(schema.returns).where(notInArray(schema.returns.id, returnIds));
      } else {
        await tx.delete(schema.returns);
      }
      if (state.returns.length > 0) {
        const chunks = chunkArray(state.returns, 100);
        for (const chunk of chunks) {
          await tx.insert(schema.returns).values(chunk.map((ret: any) => ({
            id: ret.id,
            customer: ret.customer || ret.returnFrom || 'N/A',
            orderNumber: ret.orderNumber || 'N/A',
            reason: ret.reason || 'N/A',
            status: ret.status || 'PENDING',
            createdAt: ret.createdAt || new Date().toISOString(),
            items: ret.items || []
          }))).onConflictDoUpdate({
            target: schema.returns.id,
            set: {
              status: sql\`excluded.status\`,
              items: sql\`excluded.items\`
            }
          });
        }
      }
    }

    // Tasks
    if (state.tasks) {
      const taskIds = state.tasks.map((task: any) => task.id).filter(Boolean);
      if (taskIds.length > 0) {
        await tx.delete(schema.tasks).where(notInArray(schema.tasks.id, taskIds));
      } else {
        await tx.delete(schema.tasks);
      }
      if (state.tasks.length > 0) {
        const chunks = chunkArray(state.tasks, 100);
        for (const chunk of chunks) {
          await tx.insert(schema.tasks).values(chunk.map((task: any) => ({
            id: task.id,
            type: task.type || 'UNKNOWN',
            skuId: task.skuId || 'N/A',
            skuName: task.skuName || 'N/A',
            barcode: task.barcode || 'N/A',
            qty: task.qty || 0,
            qtyHandled: task.qtyHandled || 0,
            location: task.location || 'N/A',
            warehouse: task.warehouse || 'N/A',
            status: task.status || 'PENDING',
            createdAt: task.createdAt || new Date().toISOString(),
            orderNumber: task.orderNumber || null,
            operatorLogs: task.operatorLogs || []
          }))).onConflictDoUpdate({
            target: schema.tasks.id,
            set: {
              qtyHandled: sql\`excluded.qty_handled\`,
              status: sql\`excluded.status\`,
              operatorLogs: sql\`excluded.operator_logs\`
            }
          });
        }
      }
    }
  });
}
`;

fs.writeFileSync('src/db/sync.ts', content);
