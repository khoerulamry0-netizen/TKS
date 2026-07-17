const fetch = require('node-fetch');

async function run() {
  // 1. Initial load
  let res = await fetch('http://localhost:3000/api/db', {
    headers: { 'Authorization': 'Bearer local-token-USR-001-123' }
  });
  let db = await res.json();
  console.log("Initial inventory count:", db.inventory.length);
  
  // 2. Import 2 new items
  const newInventory = [...db.inventory, {
    id: 'STK-NEW-1', skuId: 'NEW1', skuName: 'New 1', barcode: '1', brand: '1', qty: 1, location: '1', warehouse: '1', expiredDate: '31/12/2028', lowStockThreshold: 0
  }];
  
  const currentDb = {
    ...db,
    inventory: newInventory,
    lastUpdated: Date.now()
  };
  
  // 3. POST to save
  res = await fetch('http://localhost:3000/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-token-USR-001-123' },
    body: JSON.stringify(currentDb)
  });
  const saveRes = await res.json();
  console.log("Save success:", saveRes.success, "New inventory count returned:", saveRes.db.inventory.length);
  
  // 4. Refresh (GET again)
  res = await fetch('http://localhost:3000/api/db', {
    headers: { 'Authorization': 'Bearer local-token-USR-001-123' }
  });
  db = await res.json();
  console.log("After refresh inventory count:", db.inventory.length);
}
run().catch(console.error);
