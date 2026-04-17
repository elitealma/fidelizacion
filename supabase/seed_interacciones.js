const url = 'https://rqucbsuafirnohhogdry.supabase.co/rest/v1/rpc/exec_sql';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

const query = `
DO $$
DECLARE
    v_seg RECORD;
    v_int_id UUID;
    v_tipo TEXT;
    v_resultado TEXT;
    v_venta BOOLEAN;
    v_days INT;
    v_dura INT;
    v_motivos TEXT[] := ARRAY['SEGUIMIENTO_5D', 'SEGUIMIENTO_15D', 'NOVEDAD', 'CONFIRMACION_PEDIDO'];
BEGIN
    FOR v_seg IN SELECT id, fecha_registro FROM seguimientos_fidelizacion ORDER BY RANDOM() LIMIT 200 LOOP
        v_int_id := gen_random_uuid();
        
        -- Distribuir en los últimos 7 días aleatoriamente
        v_days := trunc(random() * 7);
        
        -- Aleatorizar tipo de interaccion
        IF random() < 0.6 THEN v_tipo := 'LLAMADA_IA'; ELSE v_tipo := 'WHATSAPP_PLANTILLA'; END IF;
        
        IF v_tipo = 'LLAMADA_IA' THEN
            v_resultado := CASE trunc(random()*3) WHEN 0 THEN 'EXITOSA' WHEN 1 THEN 'NO_CONTESTO' ELSE 'BUZON' END;
            v_venta := (v_resultado = 'EXITOSA' AND random() < 0.2);
            v_dura := CASE WHEN v_resultado = 'EXITOSA' THEN trunc(random()*200 + 30) ELSE 0 END;
        ELSE
            v_resultado := CASE WHEN random() < 0.5 THEN 'EXITOSA' ELSE 'PENDIENTE' END;
            v_venta := (random() < 0.1);
            v_dura := 0;
        END IF;

        INSERT INTO interacciones (id, seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos)
        VALUES (
            v_int_id, 
            v_seg.id, 
            v_tipo, 
            v_motivos[trunc(random() * 4) + 1], 
            v_resultado, 
            v_venta, 
            (v_tipo = 'WHATSAPP_PLANTILLA' AND v_resultado = 'EXITOSA'),
            now() - (v_days || ' days')::interval,
            v_dura
        );
    END LOOP;
END $$;
`;

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': 'Bearer ' + key,
  },
  body: JSON.stringify({ query })
})
.then(async res => {
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Resultado:', text);
})
.catch(err => console.error('Fetch error:', err));
