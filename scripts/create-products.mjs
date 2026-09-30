/**
 * FJ Solar Products — GHL Store Product Creator
 * Downloads images, uploads to GHL media, creates products with full details.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value && !key.startsWith('#')) env[key] = value;
  }
});

const PIT_TOKEN = env.PIT_TOKEN;
const LOCATION_ID = env.LOCATION_ID;
const API_BASE = env.GHL_API_BASE || 'https://services.leadconnectorhq.com';

const headers = {
  'Authorization': `Bearer ${PIT_TOKEN}`,
  'Content-Type': 'application/json',
  'Version': '2021-07-28',
  'Accept': 'application/json',
};

// ---------- Products ----------
const products = [
  {
    name: 'Auto Generator Start – Onboard Generators',
    description: `This interface box connects Victron devices to onboard generators. It interprets start/stop signals from Victron systems and converts them using four adjustable relays into signals the generator recognizes. By default, it sends negative signals; positive signal versions are available.\n\nKey Features:\n• No power cycling needed after unexpected shutdown\n• User-friendly operation\n• Weather-resistant IP65 enclosure\n• Compatible with 12v, 24v, and 48v systems\n• Works with Onan, NPS, RVMP, and marine generators\n\nRequirements: Victron Cerbo GX with SmartShunt or BMV-712; generator with two signal wires and negative wire.\n\nCompatibility Notes: Negative signal works across all voltages. Positive signal typically 12vdc only. Onan QD3200 incompatible. RVMP and marine require modifications.`,
    images: [
      'https://faithfuljourneysolar.com/wp-content/uploads/2023/12/FJR07937-Edit-scaled.jpg',
      'https://faithfuljourneysolar.com/wp-content/uploads/2023/12/FJR07942-Edit-scaled.jpg',
    ],
    price: 32900, // lowest variant in cents
    priceName: 'Negative Signal',
  },
  {
    name: 'Victron MultiPlus-II External Fan Kit',
    description: `This cooling enhancement kit improves airflow through Victron MultiPlus-II inverter/charger units. When horizontal placement becomes necessary in tight spaces, it can disrupt the intended airflow and reduce cooling efficiency. This kit compensates by improving circulation.\n\nThe system integrates with one of the inverter's internal relays, allowing external fans to operate automatically synchronized with internal fan activity.\n\nIncluded Components:\n• Two 80mm fans\n• Two fan guards\n• Two ABS fan mounting adapters\n• Mounting hardware\n• Programming assistance\n\nCompatible Models:\n• Victron MultiPlus-II 12/3000-120\n• Victron MultiPlus-II 24/3000-70\n• Victron MultiPlus-II 12/3000-120 2x120v\n• Victron MultiPlus-II 24/3000-70 2x120v`,
    images: [
      'https://faithfuljourneysolar.com/wp-content/uploads/2025/09/FJR03723-scaled.png',
      'https://faithfuljourneysolar.com/wp-content/uploads/2025/09/FJR03726-scaled.png',
      'https://faithfuljourneysolar.com/wp-content/uploads/2025/09/FJR03731-scaled.png',
      'https://faithfuljourneysolar.com/wp-content/uploads/2025/09/FJR03732-scaled.png',
      'https://faithfuljourneysolar.com/wp-content/uploads/2025/09/FJR03742-scaled.png',
      'https://faithfuljourneysolar.com/wp-content/uploads/2025/09/FJR03755-scaled.jpg',
      'https://faithfuljourneysolar.com/wp-content/uploads/2025/09/FJR03652-scaled.jpg',
    ],
    price: 6999,
    priceName: 'Default',
  },
  {
    name: 'Auto Generator Start – Portable Generators',
    description: `This device serves as an interface between Victron battery monitoring systems and compatible portable generators. The unit tracks battery state of charge or system load, automatically signaling the generator to start when batteries reach critically low levels and stopping when sufficiently charged.\n\nKey Features:\n• Quick-connect plugs for simplified setup\n• Standard 15-foot interconnect cable (custom lengths available)\n• Works with Victron Cerbo GX paired with SmartShunt or BMV-712\n\nCompatibility:\n• Westinghouse portable generators with Smart Switch connector\n• Duromax portable generators with ATS connector\n• Genmax portable generators with ATS connector`,
    images: [
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/01/FJR03768-scaled.png',
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/01/FJR03770-scaled.png',
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/01/FJR03772-scaled.png',
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/01/FJR03778-scaled.png',
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/01/IMG_5130-scaled.jpeg',
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/01/IMG_5135-scaled.jpeg',
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/01/IMG_5137-scaled.jpeg',
    ],
    price: 32900,
    priceName: 'Default',
  },
  {
    name: 'VE.Direct Cable',
    description: `The VE.Direct cable is used to connect one Victron component to the Cerbo GX using the VE.Direct port on the device. Cable length: 1.8 meters.`,
    images: [
      'https://faithfuljourneysolar.com/wp-content/uploads/2025/06/VE.Direct-Cable-1.8m.png',
    ],
    price: 1899,
    priceName: 'Default',
  },
  {
    name: 'Victron Cerbo GX MK2',
    description: `The Cerbo GX MK2 functions as a communication center enabling system control from anywhere. Users can access it via Victron Remote Management (VRM) portal, GX Touch display, Multi-Functional Display (MFD), or VictronConnect app with Bluetooth capability.\n\nKey Features:\n• 3 VE.Direct ports, 3 USB ports, 4 digital inputs, and 2 relays\n• Battery state of charge monitoring, power consumption tracking, and power harvesting oversight\n• Generator auto start/stop functionality\n• Remote configuration via internet or local network\n• Waterproof touchscreen display options (GX Touch 50 and 70, sold separately)\n• Simple DIN-Rail mounting compatibility\n• Single-cable connection to optional displays`,
    images: [
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/06/Cerbo-S-GX.png',
    ],
    price: 27285,
    priceName: 'Default',
  },
  {
    name: 'Victron SmartShunt 500A',
    description: `The SmartShunt is an all-in-one battery monitor, only without a display. Your phone acts as the display. It connects via Bluetooth to the VictronConnect app and displays battery parameters including state of charge, time remaining, and historical data.\n\nKey Features:\n• Bluetooth connectivity to VictronConnect app\n• VE.Direct port for GX device integration\n• Secondary connection for: monitoring a second battery, midpoint monitoring, or a temperature sensor\n• Battery voltage, current, power, amp-hours, and state of charge tracking\n• Remaining discharge time calculation`,
    images: [
      'https://faithfuljourneysolar.com/wp-content/uploads/2025/06/unailq3rjlx0gmtf4a0x.webp',
    ],
    price: 10030,
    priceName: 'Default',
  },
  {
    name: 'Victron GX Touch',
    description: `The GX Touch is the display accessory for the Cerbo GX. The touch screen display gives an instant overview of your system and allows you to adjust settings in the blink of an eye.\n\nKey Features:\n• Waterproof design\n• Bolted dashboard mounting (eliminates complex cut-outs)\n• Slim waterproof design\n• Single-cable connectivity to Cerbo GX\n• Bluetooth capability for VictronConnect app access and VRM portal connectivity`,
    images: [
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/06/GX-Touch-50-front-with-screennw.png',
    ],
    price: 22015,
    priceName: 'Touch 50',
  },
  {
    name: 'Victron BMV-712',
    description: `Smart Battery Monitor with built-in Bluetooth. The BMV-712 connects to the VictronConnect smartphone app for customization, data monitoring, historical review, and software updates.\n\nKey Features:\n• Bluetooth built-in\n• Easy to install — all electrical connections via quick connect PCB on the current shunt\n• Midpoint voltage monitoring for series-connected batteries\n• Minimal current draw (0.7Ah/month @ 12V; 0.6Ah/month @ 24V)\n• Bi-stable alarm relay\n• Battery voltage, current, power, amp-hours, and state of charge tracking\n• 500 Amp quick connect shunt and connection kit\n• VE.Direct communication port\n• Input voltage range: 6.5–70V\n\nIncluded: RJ12 cable (10m), battery cable with fuse (2m), front bezels, securing ring, mounting screws.`,
    images: [
      'https://faithfuljourneysolar.com/wp-content/uploads/2024/06/BMV-712-Smart.png',
    ],
    price: 15895,
    priceName: 'Default',
  },
];

// ---------- Helpers ----------

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToGHL(imageBuffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  const mimeType = mimeMap[ext] || 'image/jpeg';

  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const parts = [];

  // locationId field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="locationId"\r\n\r\n${LOCATION_ID}`);
  // name field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${filename}`);
  // file field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`);

  const preFile = Buffer.from(parts.join('\r\n') + '\r\n', 'utf-8');
  const postFile = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const body = Buffer.concat([preFile, imageBuffer, postFile]);

  const res = await fetch(`${API_BASE}/medias/upload-file`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PIT_TOKEN}`,
      'Version': '2021-07-28',
      'Accept': 'application/json',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Media upload failed: ${JSON.stringify(data)}`);
  return { id: data.fileId, url: data.url };
}

async function createProduct(product, medias) {
  const body = {
    locationId: LOCATION_ID,
    name: product.name,
    description: product.description,
    productType: 'PHYSICAL',
    image: medias.length > 0 ? medias[0].url : '',
    medias: medias.map(m => ({ id: m.id, type: 'image', url: m.url })),
  };

  const res = await fetch(`${API_BASE}/products/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Product create failed: ${JSON.stringify(data)}`);
  return data;
}

async function createPrice(productId, amount, name) {
  const body = {
    locationId: LOCATION_ID,
    name: name,
    type: 'one_time',
    amount: amount,
    currency: 'USD',
  };

  const res = await fetch(`${API_BASE}/products/${productId}/price`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    console.warn(`  ⚠ Price creation note: ${JSON.stringify(data)}`);
    return null;
  }
  return data;
}

// ---------- Main ----------

async function main() {
  console.log('=== FJ Solar Products — GHL Store Creator ===\n');
  const results = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`[${i + 1}/${products.length}] ${product.name}`);

    // Upload images
    const medias = [];
    for (let j = 0; j < product.images.length; j++) {
      const imgUrl = product.images[j];
      const filename = path.basename(new URL(imgUrl).pathname);
      try {
        console.log(`  Uploading image ${j + 1}/${product.images.length}: ${filename}`);
        const buf = await downloadImage(imgUrl);
        const media = await uploadToGHL(buf, filename);
        medias.push(media);
        console.log(`  ✓ Uploaded → ${media.id}`);
      } catch (err) {
        console.error(`  ✗ Image failed: ${err.message}`);
      }
      await sleep(300); // rate limit courtesy
    }

    // Create product
    try {
      const created = await createProduct(product, medias);
      console.log(`  ✓ Product created → ${created._id}`);

      // Create price
      const price = await createPrice(created._id, product.price, product.priceName);
      if (price) console.log(`  ✓ Price set → $${(product.price / 100).toFixed(2)}`);

      results.push({ name: product.name, id: created._id, status: 'created' });
    } catch (err) {
      console.error(`  ✗ Product failed: ${err.message}`);
      results.push({ name: product.name, id: null, status: 'failed' });
    }

    await sleep(500); // rate limit between products
    console.log('');
  }

  // Summary
  console.log('\n=== Summary ===');
  results.forEach(r => {
    const icon = r.status === 'created' ? '✓' : '✗';
    console.log(`${icon} ${r.name} → ${r.id || 'FAILED'}`);
  });

  // Save results for future reference
  const outputPath = path.join(__dirname, '..', 'product-ids.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nProduct IDs saved to: ${outputPath}`);
}

main().catch(console.error);
