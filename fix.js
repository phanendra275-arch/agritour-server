const fs = require('fs');

const files = [
  'middleware/auth.js',
  'routes/auth.js',
  'routes/farms.js',
  'routes/bookings.js',
  'routes/admin.js'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/require\('\/models\//g, "require('../models/");
  content = content.replace(/require\('\/middleware\//g, "require('../middleware/");
  content = content.replace(/require\('\/database\//g, "require('../database/");
  fs.writeFileSync(file, content);
  console.log('Fixed: ' + file);
});

console.log('All done!');