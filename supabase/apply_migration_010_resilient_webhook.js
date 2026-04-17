const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function execSQL(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = { hostname: HOST, path: '/rest/v1/rpc/exec_sql', method: 'POST', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }};
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.write(body); req.end();
  });
}

async function main() {
  console.log('--- APLICANDO MIGRACIÓN 010: WEBHOOK RESILIENTE ---');
  
  await execSQL('Drop Not Null', `ALTER TABLE public.interacciones ALTER COLUMN seguimiento_id DROP NOT NULL;`);
  
  await execSQL('Update Webhook', `
CREATE OR REPLACE FUNCTION public.webhook_llamada_ia(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    v_whatsapp text;
    v_timestamp timestamptz;
    v_resultado text;
    v_seguimiento_id uuid;
    v_cliente_nombre text;
BEGIN
    IF jsonb_typeof(payload) = 'array' THEN item := payload->0; ELSE item := payload; END IF;

    v_whatsapp := item->>'numero_cliente';
    IF v_whatsapp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'No phone number'); END IF;

    v_cliente_nombre := COALESCE(item->>'cliente', 'Cliente IA');
    
    BEGIN
        v_timestamp := (substring(item->>'fecha_hora' from 7 for 4) || '-' ||
                        substring(item->>'fecha_hora' from 4 for 2) || '-' ||
                        substring(item->>'fecha_hora' from 1 for 2) || ' ' ||
                        substring(item->>'fecha_hora' from 12 for 5) || ':00')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
        v_timestamp := NOW();
    END;

    IF (item->>'clasificacion_principal') ILIKE '%buzón%' OR (item->>'motivo_desconexion') = 'voicemail_reached' THEN
        v_resultado := 'BUZON';
    ELSIF (item->>'clasificacion_principal') ILIKE '%éxito%' OR (item->>'clasificacion_principal') ILIKE '%exito%' OR (item->>'clasificacion_principal') ILIKE '%complet%' THEN
        v_resultado := 'EXITOSA';
    ELSIF (item->>'clasificacion_principal') ILIKE '%no contest%' OR (item->>'motivo_desconexion') = 'busy' THEN
        v_resultado := 'NO_CONTESTO';
    ELSE
        v_resultado := 'PENDIENTE';
    END IF;

    BEGIN
        INSERT INTO public.clientes (whatsapp, nombre_completo, etiqueta)
        VALUES (v_whatsapp, v_cliente_nombre, 'NUEVO')
        ON CONFLICT (whatsapp) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN END;

    SELECT id INTO v_seguimiento_id FROM public.seguimientos_fidelizacion WHERE whatsapp = v_whatsapp ORDER BY created_at DESC LIMIT 1;

    INSERT INTO public.interacciones (
        whatsapp, seguimiento_id, tipo, motivo, resultado, fue_venta, duracion_segundos, fecha_interaccion, notas
    ) VALUES (
        v_whatsapp, v_seguimiento_id, 'LLAMADA_IA', 'FIDELIZACION', v_resultado, false, 
        COALESCE((item->>'duracion_segundos')::integer, 0), v_timestamp, item->>'resumen_ia'
    );

    IF v_seguimiento_id IS NOT NULL THEN
        UPDATE public.seguimientos_fidelizacion SET resumen_llamada = item->>'resumen_ia', updated_at = NOW() WHERE id = v_seguimiento_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'whatsapp', v_whatsapp, 'resultado', v_resultado, 'linked', v_seguimiento_id IS NOT NULL);
END;
$$;
  `);

  console.log('Migración 010 completada.');
}
main().catch(console.error);
