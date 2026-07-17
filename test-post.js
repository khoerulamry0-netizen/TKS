fetch('http://localhost:3000/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ users: [{ id: 'TEST', uid: 'TEST', name: 'Test User' }] })
}).then(res => res.text()).then(text => console.log(text));
