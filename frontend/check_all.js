const fs = require('fs');
const path = require('path');
const parser = require('./node_modules/@babel/parser');

const files = [
  'src/App.jsx',
  'src/components/Navbar.jsx',
  'src/components/ReceiptModal.jsx',
  'src/pages/Dashboard.jsx',
  'src/pages/Inventory.jsx',
  'src/pages/POS.jsx',
  'src/pages/Sales.jsx',
  'src/pages/Customers.jsx',
];

let errors = 0;
for (const file of files) {
  const filePath = path.join(__dirname, file);
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    console.log(`[PASS] ${file}`);
  } catch (err) {
    console.error(`[FAIL] ${file}: ${err.message}`);
    errors++;
  }
}

if (errors === 0) {
  console.log('\nALL 8 JSX FILES PARSED SUCCESSFULLY! ZERO SYNTAX ERRORS.');
} else {
  process.exit(1);
}
