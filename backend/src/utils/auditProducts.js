const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });
const Product = require('../models/Product').default || require('../models/Product');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const products = await Product.find({}).sort({ sku: 1 });
  const data = products.map((p, i) => ({
    id: i + 1,
    sku: p.sku,
    name: p.name,
    category: p.category,
    color: p.color,
    imageUrl: p.imageUrl
  }));
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'product_audit.json'), JSON.stringify(data, null, 2));
  console.log(`Saved ${data.length} products to product_audit.json`);
  await mongoose.disconnect();
}
run().catch(console.error);
