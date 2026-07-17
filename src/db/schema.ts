import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Define the 'users' table.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name').notNull(),
  username: text('username').notNull(),
  role: text('role').notNull(),
  avatar: text('avatar'),
  joinDate: text('join_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inventory = pgTable('inventory', {
  id: text('id').primaryKey(),
  skuId: text('sku_id').notNull(),
  skuName: text('sku_name').notNull(),
  barcode: text('barcode').notNull(),
  category: text('category'),
  price: integer('price').default(0),
  lastRestock: text('last_restock'),
  brand: text('brand').notNull(),
  qty: integer('qty').notNull().default(0),
  location: text('location').notNull(),
  warehouse: text('warehouse').notNull(),
  expiredDate: text('expired_date').notNull(),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
  notes: text('notes'),
  batchNumber: text('batch_number'),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  customer: text('customer').notNull(),
  status: text('status').notNull(),
  deadline: text('deadline'),
  createdAt: text('created_at').notNull(),
  items: jsonb('items').notNull(), // array of OrderItem
});

export const inbounds = pgTable('inbounds', {
  id: text('id').primaryKey(),
  supplier: text('supplier').notNull(),
  reference: text('reference').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  items: jsonb('items').notNull(), // array of InboundItem
});

export const returns = pgTable('returns', {
  id: text('id').primaryKey(),
  customer: text('customer').notNull(),
  orderNumber: text('order_number').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  items: jsonb('items').notNull(), // array of ReturnItem
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  skuId: text('sku_id').notNull(),
  skuName: text('sku_name').notNull(),
  barcode: text('barcode').notNull(),
  qty: integer('qty').notNull(),
  qtyHandled: integer('qty_handled').notNull(),
  location: text('location').notNull(),
  warehouse: text('warehouse').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  orderNumber: text('order_number'),
  operatorLogs: jsonb('operator_logs').notNull(), // array of OperatorLog
});
