const req = fetch('http://localhost:3000/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-token-USR-001-123' },
  body: JSON.stringify({
    users: [], inventory: [], orders: [], inbounds: [], returns: [], tasks: []
  })
}).then(res => res.text()).then(text => console.log(text)).catch(console.error);
