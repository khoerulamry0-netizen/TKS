import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

export const createPool = () => {
  return new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionTimeoutMillis: 30000, // 30s connection timeout for cold starts
    max: 10, // stable connection limit
    idleTimeoutMillis: 30000, // keep active idle connections open for 30s to allow reuse
    allowExitOnIdle: false, // keep server process active
    keepAlive: true,
  });
};

let pool = createPool();

const isTransientConnectionError = (err: any) => {
  const msg = (err?.message || '').toLowerCase();
  const code = String(err?.code || '').toUpperCase();
  return (
    msg.includes('terminated') ||
    msg.includes('closed') ||
    msg.includes('socket') ||
    msg.includes('epipe') ||
    msg.includes('econnreset') ||
    msg.includes('refused') ||
    msg.includes('timeout') ||
    msg.includes('reset') ||
    msg.includes('abort') ||
    msg.includes('ssl') ||
    msg.includes('decrypt') ||
    msg.includes('eof') ||
    code === '57P01' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT'
  );
};

function setupPoolHandlers(p: Pool) {
  p.on('error', (err) => {
    if (isTransientConnectionError(err)) {
      console.log('SQL pool client closed or terminated idle connection.');
    } else {
      console.error('Unexpected error on idle SQL pool client:', err);
    }
  });

  p.on("connect", (client) => {
    client.on("error", (err) => {
      if (isTransientConnectionError(err)) {
        console.log('SQL client closed or terminated idle connection.');
      } else {
        console.error("DB client err:", err);
      }
    });
  });
}

setupPoolHandlers(pool);

export let db = drizzle(pool, { schema });

export function getDb() {
  return db;
}

export function recreatePool() {
  console.log('[DB] Recreating connection pool due to stale or terminated connection...');
  const oldPool = pool;
  try {
    pool = createPool();
    setupPoolHandlers(pool);
    db = drizzle(pool, { schema });
    console.log('[DB] New connection pool created successfully.');
  } catch (err) {
    console.error('[DB] Failed to create new pool:', err);
  }
  
  // Clean up old pool asynchronously
  oldPool.end().then(() => {
    console.log('[DB] Old connection pool ended successfully.');
  }).catch((err) => {
    console.error('[DB] Error ending old connection pool:', err);
  });
}
