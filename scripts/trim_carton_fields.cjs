#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.cwd(), 'data', 'carton_Qte.json');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

try {
  const raw = fs.readFileSync(filePath, 'utf8');
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) {
    console.error('Expected an array in', filePath);
    process.exit(1);
  }
  const out = arr.map(item => {
    const reference = item && Object.prototype.hasOwnProperty.call(item, 'reference') ? item.reference : null;
    const carton_Qte = item && Object.prototype.hasOwnProperty.call(item, 'carton_Qte') ? item.carton_Qte : 0;
    const brand = item && Object.prototype.hasOwnProperty.call(item, 'brand') ? item.brand : null;
    return { reference, carton_Qte, brand };
  });
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', out.length, 'items to', filePath);
} catch (err) {
  console.error('Error processing file:', err.message);
  process.exit(1);
}
