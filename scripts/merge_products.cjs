#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(process.cwd(), 'data');
const outFile = path.resolve(process.cwd(), 'carton_Qte.json');

function log(...args) {
  console.log(...args);
}

function main() {
  if (!fs.existsSync(dataDir)) {
    console.error('Data directory not found:', dataDir);
    process.exit(1);
  }
  const files = fs.readdirSync(dataDir).filter(f => /^products_.+\.json$/i.test(f));
  if (files.length === 0) {
    console.error('No products_*.json files found in', dataDir);
    fs.writeFileSync(outFile, '[]', 'utf8');
    log('Wrote empty array to', outFile);
    return;
  }
  const merged = [];
  let total = 0;
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) {
        console.warn('Skipping non-array file:', file);
        continue;
      }
      const m = file.match(/^products_(.+)\.json$/i);
      const brand = m ? m[1] : '';
      for (const item of arr) {
        if (item && typeof item === 'object') {
          item.brand = brand;
          item.carton_Qte = 0;
          merged.push(item);
          total++;
        }
      }
    } catch (err) {
      console.error('Failed to process', file, err.message);
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(merged, null, 2), 'utf8');
  log(`Processed ${files.length} file(s), merged ${total} product(s) -> ${outFile}`);
}

main();
