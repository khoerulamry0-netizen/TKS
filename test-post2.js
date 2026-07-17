fetch('http://localhost:3000/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-token-USR-001-123' },
  body: JSON.stringify({
    users: [],
    inventory: [{
        id: 'STK-123456789-1-123',
        skuId: 'TEST',
        skuName: 'TEST NAME',
        barcode: '12345',
        brand: 'TEST',
        qty: 10,
        location: 'A1',
        warehouse: 'W1',
        expiredDate: '31/12/2028',
        lowStockThreshold: 10,
        notes: null,
        batchNumber: null,
        category: null,
        price: 0,
        lastRestock: null
    }],
    orders: [],
    inbounds: [],
    returns: [],
    tasks: []
  })
}).then(res => res.text()).then(text => console.log(text));
