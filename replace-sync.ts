import fs from 'fs';

let content = fs.readFileSync('src/db/sync.ts', 'utf-8');

// We need to import sql if not already imported
if (!content.includes('sql } from \'drizzle-orm\'')) {
  content = content.replace('eq, inArray, notInArray', 'eq, inArray, notInArray, sql');
}

// Write it out
fs.writeFileSync('src/db/sync.ts', content);
