#!/usr/bin/env node
/**
 * Backfill ShipStation shipments with cost summary data.
 *
 * Usage:
 *   node scripts/backfill-shipstation-costs.js --shipment-id se-XXXXXXX --product 69.99 --shipping 0.00 --tax 0.00
 *
 * Or update the most recent shipment:
 *   node scripts/backfill-shipstation-costs.js --latest --product 69.99 --shipping 0.00 --tax 0.00
 */

import dotenv from 'dotenv';
import process from 'process';

dotenv.config();

const apiKey = process.env.SHIPSTATION_API_KEY;
if (!apiKey) {
  console.error('❌ SHIPSTATION_API_KEY not set in .env');
  process.exit(1);
}

async function getShipmentById(shipmentId) {
  const res = await fetch(`https://api.shipstation.com/v2/shipments/${shipmentId}`, {
    headers: { 'API-Key': apiKey }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch shipment: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function getLatestShipment() {
  const res = await fetch('https://api.shipstation.com/v2/shipments?limit=1&sort_by=created_at&sort_direction=desc', {
    headers: { 'API-Key': apiKey }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch shipments: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.shipments?.[0];
}

async function updateShipment(shipmentId, costSummary) {
  const shipment = await getShipmentById(shipmentId);

  const total = costSummary.product + costSummary.shipping + costSummary.tax;
  const money = (n) => ({ currency: 'usd', amount: Number(n.toFixed(2)) });
  const updated = {
    ...shipment,
    amount_paid: money(total),
    shipping_paid: money(costSummary.shipping),
    tax_paid: money(costSummary.tax),
  };

  const res = await fetch(`https://api.shipstation.com/v2/shipments/${shipmentId}`, {
    method: 'PUT',
    headers: { 'API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(updated)
  });

  if (!res.ok) {
    throw new Error(`Failed to update shipment: ${res.status} ${await res.text()}`);
  }

  return await res.json();
}

async function main() {
  const args = process.argv.slice(2);
  let shipmentId = null;
  let product = 0, shipping = 0, tax = 0;
  let getLatest = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--shipment-id') shipmentId = args[++i];
    if (args[i] === '--product') product = parseFloat(args[++i]);
    if (args[i] === '--shipping') shipping = parseFloat(args[++i]);
    if (args[i] === '--tax') tax = parseFloat(args[++i]);
    if (args[i] === '--latest') getLatest = true;
  }

  try {
    if (getLatest) {
      const latest = await getLatestShipment();
      if (!latest) {
        console.error('❌ No shipments found');
        process.exit(1);
      }
      shipmentId = latest.shipment_id;
      console.log(`📦 Found latest shipment: ${shipmentId}`);
      console.log(`   External ID: ${latest.external_shipment_id}`);
      console.log(`   Ship To: ${latest.ship_to.name}`);
      console.log(`   Created: ${latest.created_at}`);
    }

    if (!shipmentId) {
      console.error('❌ No shipment ID provided. Use --shipment-id or --latest');
      process.exit(1);
    }

    const total = product + shipping + tax;
    console.log(`\n💰 Updating cost summary:`);
    console.log(`   Product: $${product.toFixed(2)}`);
    console.log(`   Shipping: $${shipping.toFixed(2)}`);
    console.log(`   Tax: $${tax.toFixed(2)}`);
    console.log(`   Total: $${total.toFixed(2)}`);

    const result = await updateShipment(shipmentId, { product, shipping, tax });

    console.log(`\n✅ Shipment ${shipmentId} updated successfully`);
    console.log(`   Amount Paid: ${result.amount_paid?.currency} ${result.amount_paid?.amount}`);
    console.log(`   Shipping Paid: ${result.shipping_paid?.currency} ${result.shipping_paid?.amount}`);
    console.log(`   Tax Paid: ${result.tax_paid?.currency} ${result.tax_paid?.amount}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
