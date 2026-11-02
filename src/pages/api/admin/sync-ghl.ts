import type { APIRoute } from 'astro';
import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const prerender = false;

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

  // Run fetch-products script
  const scriptPath = path.join(__dirname, '..', '..', '..', 'scripts', 'fetch-products.mjs');
  const projectRoot = path.join(__dirname, '..', '..', '..', '..');

  try {
    const result = await runFetchProducts(scriptPath, projectRoot);

    if (result.error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          output: result.stdout + result.stderr,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse output for summary
    const output = result.stdout + (result.stderr || '');
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
    console.error('Sync error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

function runFetchProducts(
  scriptPath: string,
  cwd: string
): Promise<{ stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const child = spawn('node', [scriptPath], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
    });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve({
          stdout,
          stderr,
          error: `Script exited with code ${code}`,
        });
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.on('error', (err) => {
      resolve({
        stdout,
        stderr,
        error: err.message,
      });
    });
  });
}
