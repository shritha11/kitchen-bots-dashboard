#!/usr/bin/env node
/**
 * Kitchen Bots Firestore Product Seeding Script
 *
 * Synchronizes canonical product definitions from kitchen-bots-ecommerce / SYNCED_PRODUCTS
 * directly into Cloudflare Worker / Firestore products collection.
 *
 * Usage:
 *   node scripts/seed-firestore-products.mjs          # Perform seed
 *   node scripts/seed-firestore-products.mjs --dry-run # Dry run inspection
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DASHBOARD_DIR, '..');
const ECOMMERCE_DIR = path.resolve(REPO_ROOT, 'kitchen-bots-ecommerce');
const ECOMMERCE_PRODUCTS_FILE = path.join(ECOMMERCE_DIR, 'src', 'data', 'products.ts');

const isDryRun = process.argv.includes('--dry-run');

console.log('🔄 Kitchen Bots Firestore Product Seeder');
console.log(`- Source: ${ECOMMERCE_PRODUCTS_FILE}`);
console.log(`- Mode: ${isDryRun ? 'DRY RUN' : 'PRODUCTION SEED'}\n`);

if (!fs.existsSync(ECOMMERCE_PRODUCTS_FILE)) {
  console.error(`❌ Ecommerce products file not found at: ${ECOMMERCE_PRODUCTS_FILE}`);
  process.exit(1);
}

function extractProducts() {
  const content = fs.readFileSync(ECOMMERCE_PRODUCTS_FILE, 'utf8');
  const match = content.match(/const RAW_PRODUCTS:\s*Product\[\]\s*=\s*(\[[\s\S]*?\]);\s*export const PRODUCTS/);
  if (!match) {
    throw new Error('Failed to parse RAW_PRODUCTS array from ecommerce products.ts');
  }
  return new Function('return ' + match[1])();
}

const rawProducts = extractProducts();

function generateSku(product) {
  const prefixMap = {
    'Santa Maria Series': 'KB-SM',
    'Rocket Stoves': 'KB-RS',
    'Accessories': 'KB-ACC',
    'Collapsible BBQ': 'KB-CBBQ',
    'Automatic BBQ': 'KB-ABBQ',
    'Suitcase BBQ': 'KB-SBBQ',
  };
  const prefix = prefixMap[product.category] || 'KB-EQ';
  const num = product.id.replace('prod-', '').padStart(3, '0');
  return `${prefix}-${num}`;
}

function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const preparedSeedProducts = rawProducts.map((p) => {
  const price = Number(p.price || 0);
  const pricePaise = Math.round(price * 100);
  const sku = generateSku(p);
  const slug = generateSlug(p.name);
  const image = p.image || (Array.isArray(p.images) && p.images[0]) || '';
  const images = Array.isArray(p.images) && p.images.length > 0 ? p.images : (image ? [image] : []);

  const specifications = Object.entries(p.specifications || {}).map(([name, val], idx) => ({
    id: `spec-${p.id}-${idx + 1}`,
    name,
    value: String(val)
  }));

  const variantPrice = price;
  const variants = [
    {
      id: `var-${p.id}-std`,
      productId: p.id,
      sku: `${sku}-STD`,
      name: `${p.name} - Standard`,
      price: variantPrice,
      status: 'Active',
      weightUnit: 'kg',
      attributes: {}
    }
  ];

  return {
    id: p.id,
    sku,
    slug,
    name: p.name,
    category: p.category,
    description: p.description,
    price,
    pricePaise,
    currency: 'INR',
    image,
    images,
    features: Array.isArray(p.features) ? p.features : [],
    specifications,
    variants,
    status: 'Active',
    publicationStatus: 'published',
    visibility: 'Public',
    isFeatured: Boolean(p.featured),
    salesMode: 'both',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
});

console.log(`📦 Prepared ${preparedSeedProducts.length} canonical product documents:\n`);
preparedSeedProducts.forEach((p, idx) => {
  console.log(`${String(idx + 1).padStart(2, ' ')}. [${p.id}] ${p.name}`);
  console.log(`    Category: ${p.category}`);
  console.log(`    Price: ₹${p.price.toLocaleString('en-IN')} (${p.pricePaise} paise)`);
  console.log(`    Featured: ${p.isFeatured} | Visibility: ${p.visibility}`);
  console.log(`    Image: ${p.image.slice(0, 45)}...`);
  console.log('');
});

if (isDryRun) {
  console.log('✅ Dry run complete. No database changes executed.');
  process.exit(0);
}

// Write JSON payload output for deployment reference
const outputPath = path.join(__dirname, 'seed-products.json');
fs.writeFileSync(outputPath, JSON.stringify(preparedSeedProducts, null, 2));
console.log(`✅ Written seed payload to: ${outputPath}`);