const https = require('https');

// Using Supabase REST API with the anon key (which has public access)
// The columns will be added via SQL using the Management API
// Since the management token expired, we use an alternative approach:
// We'll use the Supabase SQL endpoint with the project's connection string

const SUPABASE_URL = 'rqucbsuafirnohhogdry.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzE4MjQsImV4cCI6MjA5MDY0NzgyNH0.DlR_FtgQcIZkT5PtpHbKWXdjtCBaGMt-ph5pC2EmZJ8';

function rpc(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) console.log(`  ✅ ${label}`);
        else console.log(`  ⚠️ ${label} (${res.statusCode}): ${d.substring(0, 150)}`);
        resolve(d);
      });
    });
    req.on('error', e => { console.log(`  ❌ ${label}: ${e.message}`); resolve(null); });
    req.write(body); req.end();
  });
}

async function main() {
  console.log('=== MIGRACIÓN 004: Testing Supabase connection ===\n');
  console.log('⚠️  NOTE: The Supabase Management API token has expired.');
  console.log('   The new columns (fecha_5d, fecha_15d, fecha_25d, fecha_35d, resumen_llamada)');
  console.log('   need to be added via the Supabase Dashboard SQL Editor:');
  console.log('');
  console.log('   Go to: https://supabase.com/dashboard/project/rqucbsuafirnohhogdry/sql/new');
  console.log('   Run this SQL:\n');
  console.log(`   ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_5d TEXT;`);
  console.log(`   ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_15d TEXT;`);
  console.log(`   ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_25d TEXT;`);
  console.log(`   ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_35d TEXT;`);
  console.log(`   ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS resumen_llamada TEXT;`);
  console.log('');
  console.log('   OR generate a new Management API token at:');
  console.log('   https://supabase.com/dashboard/account/tokens');
  console.log('');

  // Test read access
  const testOpts = {
    hostname: SUPABASE_URL,
    path: '/rest/v1/seguimientos_fidelizacion?select=id&limit=1',
    method: 'GET',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    }
  };

  await new Promise((resolve) => {
    const req = https.request(testOpts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('  ✅ Conexión a Supabase REST API funciona correctamente');
          console.log(`     Respuesta: ${d.substring(0, 100)}`);
        } else {
          console.log(`  ❌ Conexión fallida (${res.statusCode}): ${d.substring(0, 150)}`);
        }
        resolve();
      });
    });
    req.on('error', e => { console.log(`  ❌ Error: ${e.message}`); resolve(); });
    req.end();
  });
}

main().catch(console.error);
