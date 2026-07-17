async function run() {
  const largeInventory = [];
  for(let i = 0; i < 5000; i++) {
    largeInventory.push({
      id: 'STK-' + i, skuId: 'SKU' + i, skuName: 'Name ' + i, barcode: 'BC' + i, brand: 'Brand', qty: 10, location: 'Loc', warehouse: 'WH', expiredDate: '31/12/2028', lowStockThreshold: 10
    });
  }
  
  const currentDb = {
    users: [], inventory: largeInventory, orders: [], inbounds: [], returns: [], tasks: [], lastUpdated: Date.now()
  };
  
  console.log("Payload length:", JSON.stringify(currentDb).length);
  
  const res = await fetch('http://localhost:3000/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-token-USR-001-123' },
    body: JSON.stringify(currentDb)
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text.substring(0, 100));
}
run().catch(console.error);
