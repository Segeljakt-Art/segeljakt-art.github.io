const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {}, Intl, Number, String };
vm.runInNewContext(fs.readFileSync('artwork-sort.js', 'utf8'), context);
const sorting = context.window.artworkSort;
assert.equal(sorting.price('7 500 kr'), 7500);
assert.equal(sorting.area('50 × 70 cm'), 3500);
assert.equal(sorting.area('500 × 700 mm'), 3500);
assert.equal(sorting.area('1448 × 1086 px'), null);
const artworks = [
  { title: 'A', price: 'Ej angivet', dimensions: 'Ej angivet', year: 'Ej angivet' },
  { title: 'B', price: '10 000 kr', dimensions: '50 × 70 cm', year: '2026' },
  { title: 'C', price: '7 500 kr', dimensions: '20 × 30 cm', year: '2024' }
];
for (const mode of ['price-asc', 'area-asc', 'year-asc']) {
  assert.equal(sorting.sort(artworks, item => item, mode).map(item => item.title).join(','), 'C,B,A');
}
for (const mode of ['price-desc', 'area-desc', 'year-desc']) {
  assert.equal(sorting.sort(artworks, item => item, mode).map(item => item.title).join(','), 'B,C,A');
}
assert.equal(sorting.sort(artworks, item => item, 'order').map(item => item.title).join(','), 'A,B,C');
console.log('Artwork sorting checks passed');
