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

async function main() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  MIGRACIÓN 009: Crear RPC (Webhook) para recibir llamadas IA');
  console.log('════════════════════════════════════════════════════════════\n');

  await execSQL('Crear Función webhook_llamada_ia', `
CREATE OR REPLACE FUNCTION public.webhook_llamada_ia(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    v_whatsapp text;
    v_fecha text;
    v_resultado text;
    v_seguimiento_id uuid;
BEGIN
    -- Si es un array [ { ... } ], tomamos el primer elemento
    IF jsonb_typeof(payload) = 'array' THEN
        item := payload->0;
    ELSE
        item := payload;
    END IF;

    -- Sincronizar mediante el WhatsApp (Ej: +573183542883)
    v_whatsapp := item->>'numero_cliente';
    
    -- Transformar fecha "16-04-2026 21:42" a "2026-04-16 21:42:00"
    -- Esto garantiza compatibilidad perfecta con app.js
    -- substring(...) en postgres
    v_fecha := substring(item->>'fecha_hora' from 7 for 4) || '-' ||
               substring(item->>'fecha_hora' from 4 for 2) || '-' ||
               substring(item->>'fecha_hora' from 1 for 2) || ' ' ||
               substring(item->>'fecha_hora' from 12 for 5) || ':00';

    -- Mapeo estructurado para campo Resultado
    IF (item->>'clasificacion_principal') ILIKE '%buzón%' OR (item->>'motivo_desconexion') = 'voicemail_reached' THEN
        v_resultado := 'BUZON';
    ELSIF (item->>'clasificacion_principal') ILIKE '%éxito%' OR (item->>'clasificacion_principal') ILIKE '%exito%' THEN
        v_resultado := 'EXITOSA';
    ELSIF (item->>'clasificacion_principal') ILIKE '%no contest%' OR (item->>'motivo_desconexion') = 'busy' THEN
        v_resultado := 'NO_CONTESTO';
    ELSE
        v_resultado := 'PENDIENTE';
    END IF;

    -- Para que se conecte directamente al Kanban / Seguimientos (Vista WEB)
    -- Insertamos el resumen (notas) de la IA directamente en el seguimiento del cliente
    UPDATE public.seguimientos_fidelizacion
    SET resumen_llamada = item->>'resumen_ia'
    WHERE whatsapp = v_whatsapp
    RETURNING id INTO v_seguimiento_id;

    -- Insertar log ofical en interacciones
    INSERT INTO public.interacciones (
        whatsapp,
        seguimiento_id,
        tipo,
        motivo,
        resultado,
        fue_venta,
        whatsapp_respondido,
        duracion_segundos,
        fecha_interaccion,
        notas
    ) VALUES (
        v_whatsapp,
        v_seguimiento_id,
        'LLAMADA_IA',
        'FIDELIZACION',
        v_resultado,
        false, 
        false, 
        COALESCE((item->>'duracion_segundos')::integer, 0),
        v_fecha,
        item->>'resumen_ia'
    );

    RETURN jsonb_build_object('success', true, 'whatsapp', v_whatsapp, 'resultado', v_resultado, 'fecha_formateada', v_fecha);
END;
$$;
  `);

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  ✅ WEBHOOK RPC CONFIGURADO CON ÉXITO');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
