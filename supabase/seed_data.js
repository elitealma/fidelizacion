const https = require('https');
const TOKEN = 'sbp_7c7769fb86137c8340d0428f7452eb3b6f0b330a';
const PROJECT_ID = 'rqucbsuafirnohhogdry';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

function executeQuery(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const options = { method: 'POST', headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(API_URL, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) console.log(`  ✅ ${label}`);
        else console.log(`  ❌ ${label} (${res.statusCode}): ${data.substring(0, 250)}`);
        resolve(data);
      });
    });
    req.on('error', (err) => { console.log(`  ❌ ${label}: ${err.message}`); resolve(null); });
    req.write(body); req.end();
  });
}

async function main() {
  console.log('=== SEED DATA: Elite Nutrition Colombia ===\n');

  // Asesor 2
  await executeQuery('Asesor Carlos', "INSERT INTO public.asesores (nombre_completo, rol, activo) VALUES ('Carlos Méndez', 'Asesor', true);");
  await new Promise(r => setTimeout(r, 500));

  // Clientes (use INSERT simple, no ON CONFLICT)
  const clientes = [
    "('María Camila Torres', '+573001234567', 'Cundinamarca', 'Bogotá', 'RECURRENTE', 'ORGANICO', now() - interval '3 days')",
    "('Andrés Felipe Rojas', '+573109876543', 'Antioquia', 'Medellín', 'NUEVO', 'ANUNCIO', now() - interval '1 day')",
    "('Laura Valentina Gómez', '+573205551234', 'Valle del Cauca', 'Cali', 'OCASIONAL', 'EVENTO', now() - interval '10 days')",
    "('Santiago Herrera López', '+573158884321', 'Santander', 'Bucaramanga', 'PERDIDO', 'ORGANICO', now() - interval '45 days')",
    "('Valentina Restrepo M.', '+573176667890', 'Atlántico', 'Barranquilla', 'RECURRENTE', 'ANUNCIO', now() - interval '2 days')",
    "('Juan Pablo Castillo', '+573124445566', 'Risaralda', 'Pereira', 'NUEVO', 'ORGANICO', now())",
  ];

  for (let i = 0; i < clientes.length; i++) {
    await executeQuery(`Cliente ${i+1}`, `INSERT INTO public.clientes (nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion, ultima_compra) VALUES ${clientes[i]};`);
    await new Promise(r => setTimeout(r, 500));
  }

  // DO block for pedidos + seguimientos + interacciones
  await executeQuery('Pedidos+Seguimientos+Interacciones', `
DO $$
DECLARE
  v_a1 UUID; v_a2 UUID;
  v_c1 UUID; v_c2 UUID; v_c3 UUID; v_c4 UUID; v_c5 UUID; v_c6 UUID;
  v_p1 UUID; v_p2 UUID; v_p3 UUID; v_p4 UUID; v_p5 UUID; v_p6 UUID; v_p7 UUID;
  v_s1 UUID; v_s2 UUID; v_s3 UUID; v_s4 UUID; v_s5 UUID; v_s6 UUID; v_s7 UUID;
BEGIN
  SELECT id INTO v_a1 FROM asesores WHERE nombre_completo = 'Daniela Vega' LIMIT 1;
  SELECT id INTO v_a2 FROM asesores WHERE nombre_completo = 'Carlos Méndez' LIMIT 1;
  SELECT id INTO v_c1 FROM clientes WHERE whatsapp = '+573001234567';
  SELECT id INTO v_c2 FROM clientes WHERE whatsapp = '+573109876543';
  SELECT id INTO v_c3 FROM clientes WHERE whatsapp = '+573205551234';
  SELECT id INTO v_c4 FROM clientes WHERE whatsapp = '+573158884321';
  SELECT id INTO v_c5 FROM clientes WHERE whatsapp = '+573176667890';
  SELECT id INTO v_c6 FROM clientes WHERE whatsapp = '+573124445566';

  INSERT INTO pedidos (cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES (v_c1, 'Proteína Whey 2lb', 89900, 'WHATSAPP', 'ENTREGADO_AL_CLIENTE', now()-interval '5 days') RETURNING id INTO v_p1;
  INSERT INTO pedidos (cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES (v_c2, 'Creatina Monohidrato 300g', 65000, 'RED_SOCIAL', 'GUIA_GENERADA', now()-interval '1 day') RETURNING id INTO v_p2;
  INSERT INTO pedidos (cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES (v_c3, 'Pre-Entreno Savage 30sv', 120000, 'SHOPIFY', 'EN_REPARTO', now()-interval '3 days') RETURNING id INTO v_p3;
  INSERT INTO pedidos (cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES (v_c4, 'BCAA + Glutamina 500g', 75000, 'WHATSAPP', 'RETRASO_O_MOLESTIA', now()-interval '15 days') RETURNING id INTO v_p4;
  INSERT INTO pedidos (cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES (v_c5, 'Pack Definicion (Whey+Quemador)', 185000, 'RED_SOCIAL', 'ENTREGADO_AL_CLIENTE', now()-interval '8 days') RETURNING id INTO v_p5;
  INSERT INTO pedidos (cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES (v_c6, 'Multivitaminico Elite 60 caps', 42000, 'WHATSAPP', 'EN_OFICINA', now()-interval '2 days') RETURNING id INTO v_p6;
  INSERT INTO pedidos (cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES (v_c1, 'Colageno Hidrolizado 500g', 95000, 'SHOPIFY', 'GUIA_GENERADA', now()) RETURNING id INTO v_p7;

  INSERT INTO seguimientos_fidelizacion (pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES (v_p1, v_a1, true, true, false, false, 'Cliente satisfecha, interesada en pack mensual', 'BUENO', 'ACTIVA', 'MEDIA') RETURNING id INTO v_s1;
  INSERT INTO seguimientos_fidelizacion (pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES (v_p2, v_a1, false, false, false, false, 'Pedido nuevo, pendiente confirmacion', 'BUENO', 'ACTIVA', 'ALTA') RETURNING id INTO v_s2;
  INSERT INTO seguimientos_fidelizacion (pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES (v_p3, v_a2, true, false, false, false, 'Esperando entrega, cliente pregunto por tracking', 'REGULAR', 'ACTIVA', 'MEDIA') RETURNING id INTO v_s3;
  INSERT INTO seguimientos_fidelizacion (pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES (v_p4, v_a2, true, true, true, false, 'URGENTE: Cliente molesto por demora 15 dias', 'CRITICO', 'ACTIVA', 'ALTA') RETURNING id INTO v_s4;
  INSERT INTO seguimientos_fidelizacion (pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES (v_p5, v_a1, true, true, true, true, 'Seguimiento completo, cliente recompro', 'BUENO', 'COMPLETADA', 'BAJA') RETURNING id INTO v_s5;
  INSERT INTO seguimientos_fidelizacion (pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES (v_p6, v_a1, false, false, false, false, 'Pedido en oficina, esperando recogida', 'REGULAR', 'ACTIVA', 'ALTA') RETURNING id INTO v_s6;
  INSERT INTO seguimientos_fidelizacion (pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES (v_p7, v_a1, false, false, false, false, 'Pedido recien creado', 'BUENO', 'ACTIVA', 'MEDIA') RETURNING id INTO v_s7;

  -- Interacciones
  INSERT INTO interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s1, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, true, now()-interval '5 days', 0, 'Confirmacion enviada, respondio OK'),
    (v_s1, 'LLAMADA_IA', 'SEGUIMIENTO_5D', 'EXITOSA', false, null, now()-interval '3 days', 145, 'Llamada IA dia 5: satisfecha'),
    (v_s1, 'WHATSAPP_PLANTILLA', 'SEGUIMIENTO_15D', 'EXITOSA', false, true, now()-interval '1 day', 0, 'WA seguimiento 15d respondido'),
    (v_s2, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'PENDIENTE', false, false, now()-interval '1 day', 0, 'Plantilla enviada sin respuesta'),
    (v_s3, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, true, now()-interval '3 days', 0, 'Confirmacion OK'),
    (v_s3, 'WHATSAPP_PLANTILLA', 'SEGUIMIENTO_5D', 'EXITOSA', false, false, now()-interval '1 day', 0, 'WA enviado, no respondio'),
    (v_s3, 'LLAMADA_IA', 'SEGUIMIENTO_5D', 'EXITOSA', false, null, now()-interval '22 hours', 98, 'Llamada IA: no respondio WA, confirmo tracking'),
    (v_s4, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, true, now()-interval '15 days', 0, 'Confirmacion OK'),
    (v_s4, 'LLAMADA_IA', 'SEGUIMIENTO_5D', 'EXITOSA', false, null, now()-interval '10 days', 180, 'Pregunto estado, no ha llegado'),
    (v_s4, 'WHATSAPP_PLANTILLA', 'NOVEDAD', 'EXITOSA', false, true, now()-interval '5 days', 0, 'WA novedad: reporta que no llega'),
    (v_s4, 'LLAMADA_IA', 'RETRASO', 'EXITOSA', false, null, now()-interval '3 days', 240, 'Llamada retraso: cliente molesto, pide devolucion'),
    (v_s4, 'LLAMADA_IA', 'SEGUIMIENTO_25D', 'NO_CONTESTO', false, null, now()-interval '1 day', 0, 'Dia 25, no contesto'),
    (v_s5, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, true, now()-interval '8 days', 0, 'Confirmacion OK'),
    (v_s5, 'LLAMADA_IA', 'SEGUIMIENTO_5D', 'EXITOSA', true, null, now()-interval '5 days', 210, 'Dia 5: pidio otro producto. VENTA'),
    (v_s5, 'LLAMADA_IA', 'FIDELIZACION', 'EXITOSA', true, null, now()-interval '2 days', 155, 'Compro pack mensual. VENTA'),
    (v_s6, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, false, now()-interval '2 days', 0, 'WA enviado, no respondio'),
    (v_s6, 'LLAMADA_IA', 'CONFIRMACION_PEDIDO', 'BUZON', false, null, now()-interval '44 hours', 0, 'Llamada IA: buzon de voz'),
    (v_s6, 'LLAMADA_IA', 'CONFIRMACION_PEDIDO', 'NO_CONTESTO', false, null, now()-interval '1 day', 0, 'Segundo intento: no contesto'),
    (v_s7, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'PENDIENTE', false, false, now(), 0, 'Plantilla recien enviada');
END $$;
  `);

  console.log('\n── Verificacion Final ──');
  await executeQuery('Clientes', "SELECT COUNT(*) as total FROM clientes;");
  await new Promise(r => setTimeout(r, 300));
  await executeQuery('Pedidos', "SELECT COUNT(*) as total FROM pedidos;");
  await new Promise(r => setTimeout(r, 300));
  await executeQuery('Seguimientos', "SELECT COUNT(*) as total FROM seguimientos_fidelizacion;");
  await new Promise(r => setTimeout(r, 300));
  await executeQuery('Interacciones', "SELECT COUNT(*) as total FROM interacciones;");

  console.log('\n=== SEED DATA COMPLETA ===');
}

main().catch(console.error);
