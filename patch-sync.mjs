import fs from 'fs';

let content = fs.readFileSync('src/db/sync.ts', 'utf-8');

const chunkHelper = `
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
`;

if (!content.includes('function chunkArray')) {
  content = content.replace('export async function getDbState()', chunkHelper + '\nexport async function getDbState()');
}

// Now replace all inserts.
// Example:
// await tx.insert(schema.inventory).values(state.inventory.map((item: any) => ({
// ...
// }))).onConflictDoUpdate({ ... });

// We can do this by regex or AST, but regex is tricky. 
// It's safer to just rewrite saveDbState entirely or use a script to replace each block.
