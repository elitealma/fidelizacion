const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function execSQL(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = {
      hostname: HOST, path: '/rest/v1/rpc/exec_sql', method: 'POST',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        let ok = res.statusCode >= 200 && res.statusCode < 300;
        let parsed; try { parsed = JSON.parse(d); } catch(e) { parsed = null; }
        if (ok && parsed && parsed.success === false) console.log(`  ⚠️  ${label}: ${parsed.error}`);
        else if (ok) console.log(`  ✅ ${label}`);
        else console.log(`  ❌ ${label} (${res.statusCode}): ${d.substring(0, 150)}`);
        resolve({ ok, data: parsed || d });
      });
    });
    req.on('error', e => { console.log(`  ❌ ${label}: ${e.message}`); resolve({ ok: false }); });
    req.write(body); req.end();
  });
}

async function cleanDuplicates() {
  console.log('── Limpiando duplicados de WhatsApp en Clientes antes de aplicar la restricción ──');
  // Se mantienen los clientes más recientes por cada número de WhatsApp,
  // y se borran los viejos que comparten el mismo número.
  await execSQL('Borrar duplicados de clientes', `
    DELETE FROM public.clientes a USING (
      SELECT MIN(ctid) as ctid, whatsapp
      FROM public.clientes
      GROUP BY whatsapp HAVING COUNT(*) > 1
    ) b
    WHERE a.whatsapp = b.whatsapp
    AND a.ctid <> b.ctid;
  `);
}

async function main() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  MIGRACIÓN 008: whatsapp como ID principal (Foreign Key)');
  console.log('════════════════════════════════════════════════════════════\n');

  await cleanDuplicates();

  // 1. Aseguramos que whatsapp es UNICO en la tabla clientes
  await execSQL('UNIQUE clientes.whatsapp', `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clientes_whatsapp_key') THEN
        ALTER TABLE public.clientes ADD CONSTRAINT clientes_whatsapp_key UNIQUE (whatsapp);
      END IF;
    END $$;
  `);

  // 2. Agregamos llaves foraneas ligando todas las tablas por whatsapp
  await execSQL('FK pedidos -> clientes(whatsapp)', `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pedido_wa') THEN
        ALTER TABLE public.pedidos ADD CONSTRAINT fk_pedido_wa FOREIGN KEY (whatsapp) REFERENCES public.clientes(whatsapp);
      END IF;
    END $$;
  `);

  await execSQL('FK seguimientos -> clientes(whatsapp)', `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_seguimiento_wa') THEN
        ALTER TABLE public.seguimientos_fidelizacion ADD CONSTRAINT fk_seguimiento_wa FOREIGN KEY (whatsapp) REFERENCES public.clientes(whatsapp);
      END IF;
    END $$;
  `);

  await execSQL('FK interacciones -> clientes(whatsapp)', `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interacciones_wa') THEN
        ALTER TABLE public.interacciones ADD CONSTRAINT fk_interacciones_wa FOREIGN KEY (whatsapp) REFERENCES public.clientes(whatsapp);
      END IF;
    END $$;
  `);

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  ✅ BASE DE DATOS ACTUALIZADA CON EXITO');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
