const payload = {
  users: [{ id: 'USR-001', uid: 'USR-001', name: 'Admin', username: 'admin', role: 'ADMIN', email: 'admin@b.id' }],
  inventory: [{ id: 'STK-001', skuId: 'A', skuName: 'A', barcode: 'A', brand: 'A', qty: 10, location: 'A', warehouse: 'W', expiredDate: '31/12/2028', lowStockThreshold: 10 }],
  orders: [],
  inbounds: [],
  returns: [],
  tasks: [],
  lastUpdated: Date.now()
};

fetch('http://localhost:3000/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-token-USR-001-123' },
  body: JSON.stringify(payload)
}).then(res => res.text()).then(text => console.log(text)).catch(console.error);
