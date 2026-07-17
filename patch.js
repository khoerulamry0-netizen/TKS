const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(
  'console.error("Failed to save db state", error);',
  'console.error("Failed to save db state", error); require("fs").writeFileSync("db-error.log", error.stack || error.message || String(error));'
);
fs.writeFileSync('server.ts', code);
