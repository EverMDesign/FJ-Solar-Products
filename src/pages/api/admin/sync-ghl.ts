import type { APIRoute } from 'astro';
import { execFile } from 'child_process';
import { promisify } from 'util';

export const prerender = false;

const execFileAsync = promisify(execFile);

export const POST: APIRoute = async ({ request }) => {
  const LOCATION_ID = import.meta.env.LOCATION_ID;
  const body = await request.json();

  // Same gate as the admin page: only a request carrying the real GHL location ID
  if (!LOCATION_ID || body.locationId !== LOCATION_ID) {
    return new Response(
      JSON.stringify({ error: 'Not authorized.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Run fetch-products using npm script (more reliable than direct node spawn)
    const { stdout, stderr } = await execFileAsync('npm', ['run', 'fetch-products'], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const output = stdout + stderr;

    // Parse output for summary
    const productsMatch = output.match(/✓ Saved (\d+) products/);
    const productCount = productsMatch ? parseInt(productsMatch[1], 10) : 0;

    const placeholderMatch = output.match(/⚠ (\d+) product\(s\) still have a placeholder weight/);
    const placeholderCount = placeholderMatch ? parseInt(placeholderMatch[1], 10) : 0;

    return new Response(
      JSON.stringify({
        success: true,
        productCount,
        placeholderWeights: placeholderCount,
        output,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Sync error:', errMsg);
    return new Response(
      JSON.stringify({
        success: false,
        error: errMsg,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
