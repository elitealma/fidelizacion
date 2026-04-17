const url = 'https://rqucbsuafirnohhogdry.supabase.co/rest/v1/rpc/exec_sql';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

const query = `
DO $$
DECLARE
    v_asesor_id UUID;
    v_c_id UUID;
    v_p_id UUID;
    i INT;
    v_dias INT;
    v_fecha TIMESTAMP;
    v_ciudades TEXT[] := ARRAY['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga'];
    v_deps TEXT[] := ARRAY['Cundinamarca', 'Antioquia', 'Valle del Cauca', 'Atlántico', 'Santander'];
    v_prods TEXT[] := ARRAY['Proteína Whey 2lb', 'Colágeno 500g', 'Creatina 300g', 'Pre-entreno 400g'];
    v_etas TEXT[] := ARRAY['NUEVO', 'RECURRENTE', 'OCASIONAL', 'PERDIDO'];
    v_logs TEXT[] := ARRAY['GUIA_GENERADA', 'EN_REPARTO', 'ENTREGADO_AL_CLIENTE', 'TODAS'];
    v_prios TEXT[] := ARRAY['ALTA', 'MEDIA', 'BAJA'];
BEGIN
    SELECT id INTO v_asesor_id FROM asesores LIMIT 1;
    IF v_asesor_id IS NULL THEN
        INSERT INTO asesores (id, nombre_completo, rol, activo) VALUES (gen_random_uuid(), 'Asesor Prueba', 'asesor', true) RETURNING id INTO v_asesor_id;
    END IF;

    FOR i IN 1..100 LOOP
        v_c_id := gen_random_uuid();
        
        -- Insert client
        INSERT INTO clientes (id, nombre_completo, whatsapp, pais, departamento, ciudad, etiqueta)
        VALUES (
            v_c_id, 
            'Cliente Prueba ' || i, 
            '+57300000' || lpad(i::text, 4, '0'), 
            'Colombia', 
            v_deps[ (i % 5) + 1 ], 
            v_ciudades[ (i % 5) + 1 ], 
            v_etas[ (i % 4) + 1 ]::public.enum_etiqueta_cliente
        );

        v_p_id := gen_random_uuid();
        
        -- Randomize follow-up dates to ensure they trigger the 5d, 15d, 25d logic
        IF i % 5 = 0 THEN v_dias := 5;
        ELSIF i % 5 = 1 THEN v_dias := 15;
        ELSIF i % 5 = 2 THEN v_dias := 25;
        ELSIF i % 5 = 3 THEN v_dias := 35;
        ELSE v_dias := trunc(random() * 40);
        END IF;

        v_fecha := now() - (v_dias || ' days')::interval;

        -- Insert order
        INSERT INTO pedidos (id, cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido, guia)
        VALUES (
            v_p_id, 
            v_c_id, 
            v_prods[ (i % 4) + 1 ], 
            50000 + (random() * 100000)::INT, 
            'WHATSAPP', 
            v_logs[ (i % 4) + 1 ]::public.enum_estado_logistico, 
            v_fecha,
            'GUI' || lpad((random() * 1000000)::INT::TEXT, 6, '0')
        );

        -- Insert seguimiento
        INSERT INTO seguimientos_fidelizacion (pedido_id, asesor_id, prioridad, fecha_registro, estado_tarea)
        VALUES (
            v_p_id, 
            v_asesor_id, 
            v_prios[ (i % 3) + 1 ],
            to_char(v_fecha, 'YYYY-MM-DD HH24:MI:SS'),
            'ACTIVA'
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
