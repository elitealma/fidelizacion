const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function execSQL(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = { hostname: HOST, path: '/rest/v1/rpc/exec_sql', method: 'POST', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }};
    const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.write(body); req.end();
  });
}

async function main() {
  console.log('Installing Power Webhook...');
  const res = await execSQL('Install Webhook', `
    CREATE TABLE IF NOT EXISTS public.webhook_raw_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payload jsonb,
      error text,
      created_at timestamptz DEFAULT now()
    );

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
        v_raw_resumen text;
    BEGIN
        -- 1. Log Raw Payload for debugging
        INSERT INTO public.webhook_raw_logs (payload) VALUES (payload);

        -- 2. Extract item (handle array or object)
        IF jsonb_typeof(payload) = 'array' THEN item := payload->0; ELSE item := payload; END IF;

        -- 3. Robust Phone Extraction
        v_whatsapp := COALESCE(
            item->>'numero_cliente', 
            item->>'customer_number', 
            item->>'phone_number',
            item->>'phone',
            item->'call'->>'customer_number',
            item->'customer'->>'number'
        );
        
        IF v_whatsapp IS NULL THEN 
            UPDATE public.webhook_raw_logs SET error = 'Missing phone number' WHERE id = (SELECT id FROM public.webhook_raw_logs ORDER BY created_at DESC LIMIT 1);
            RETURN jsonb_build_object('success', false, 'error', 'No phone number'); 
        END IF;

        -- 4. Robust Name Extraction
        v_cliente_nombre := COALESCE(
            item->>'cliente', 
            item->'customer'->>'name',
            item->>'name',
            'Cliente IA'
        );

        -- 5. Robust Date Parsing
        BEGIN
            IF (item->>'fecha_hora') ~ '^\\d{2}/\\d{2}/\\d{4}' THEN
                v_timestamp := (substring(item->>'fecha_hora' from 7 for 4) || '-' ||
                                substring(item->>'fecha_hora' from 4 for 2) || '-' ||
                                substring(item->>'fecha_hora' from 1 for 2) || ' ' ||
                                substring(item->>'fecha_hora' from 12 for 5) || ':00')::timestamptz;
            ELSIF (item->>'created_at') IS NOT NULL THEN
                v_timestamp := (item->>'created_at')::timestamptz;
            ELSE
                v_timestamp := NOW();
            END IF;
        EXCEPTION WHEN OTHERS THEN v_timestamp := NOW();
        END;

        -- 6. Classification
        v_raw_resumen := COALESCE(item->>'resumen_ia', item->>'summary', item->'call'->>'summary', 'Sin resumen');
        
        IF (item->>'clasificacion_principal') ILIKE '%buzón%' 
           OR (item->>'motivo_desconexion') = 'voicemail_reached' 
           OR v_raw_resumen ILIKE '%buzón%' THEN
            v_resultado := 'BUZON';
        ELSIF (item->>'clasificacion_principal') ILIKE '%éxito%' 
           OR (item->>'clasificacion_principal') ILIKE '%exito%' 
           OR (item->>'clasificacion_principal') ILIKE '%complet%' 
           OR v_raw_resumen ILIKE '%confirmó%' THEN
            v_resultado := 'EXITOSA';
        ELSIF (item->>'clasificacion_principal') ILIKE '%no contest%' 
           OR (item->>'motivo_desconexion') = 'busy' THEN
            v_resultado := 'NO_CONTESTO';
        ELSE
            v_resultado := 'PENDIENTE';
        END IF;

        -- 7. Ensure Client
        INSERT INTO public.clientes (whatsapp, nombre_completo, etiqueta)
        VALUES (v_whatsapp, v_cliente_nombre, 'NUEVO')
        ON CONFLICT (whatsapp) DO NOTHING;

        -- 8. Ensure Seguimiento
        SELECT id INTO v_seguimiento_id FROM public.seguimientos_fidelizacion WHERE whatsapp = v_whatsapp ORDER BY created_at DESC LIMIT 1;
        
        IF v_seguimiento_id IS NULL THEN
            INSERT INTO public.seguimientos_fidelizacion (whatsapp, estado_tarea, prioridad, created_at)
            VALUES (v_whatsapp, 'ACTIVA', 'ALTA', NOW())
            RETURNING id INTO v_seguimiento_id;
        END IF;

        -- 9. Insert Interaction
        INSERT INTO public.interacciones (
            whatsapp, seguimiento_id, tipo, motivo, resultado, fue_venta, duracion_segundos, fecha_interaccion, notas
        ) VALUES (
            v_whatsapp, v_seguimiento_id, 'LLAMADA_IA', 'FIDELIZACION', v_resultado, 
            COALESCE((item->>'fue_venta')::boolean, false), 
            COALESCE((item->>'duracion_segundos')::integer, 0), 
            v_timestamp, 
            v_raw_resumen
        );

        -- 10. Update Seguimiento
        UPDATE public.seguimientos_fidelizacion 
        SET resumen_llamada = v_raw_resumen, updated_at = NOW() 
        WHERE id = v_seguimiento_id;

        RETURN jsonb_build_object('success', true, 'whatsapp', v_whatsapp, 'resultado', v_resultado);
    END;
    $$;
  `);
  console.log('Result:', res);
}
main().catch(console.error);
