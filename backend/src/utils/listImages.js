const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await mongoose.connection.collection("products").find({}).sort({ sku: 1 }).toArray();
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    console.log((i + 1) + ". [" + p.sku + "] " + p.name + " (" + p.category + ", " + p.color + "): " + p.imageUrl);
  }
  await mongoose.disconnect();
}
run();
