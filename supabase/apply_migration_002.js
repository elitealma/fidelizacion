const https = require('https');

const TOKEN = 'sbp_7c7769fb86137c8340d0428f7452eb3b6f0b330a';
const PROJECT_ID = 'rqucbsuafirnohhogdry';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

const queries = [
  // ─── NUEVOS ENUMS ───
  { label: 'ENUM tipo_interaccion', sql: `CREATE TYPE public.enum_tipo_interaccion AS ENUM ('WHATSAPP_PLANTILLA','LLAMADA_IA','WHATSAPP_MANUAL');` },
  { label: 'ENUM motivo_interaccion', sql: `CREATE TYPE public.enum_motivo_interaccion AS ENUM ('CONFIRMACION_PEDIDO','SEGUIMIENTO_5D','SEGUIMIENTO_15D','SEGUIMIENTO_25D','SEGUIMIENTO_35D','NOVEDAD','RETRASO','FIDELIZACION');` },
  { label: 'ENUM resultado_interaccion', sql: `CREATE TYPE public.enum_resultado_interaccion AS ENUM ('EXITOSA','NO_CONTESTO','BUZON','RECHAZADA','PENDIENTE');` },
  { label: 'ENUM prioridad', sql: `CREATE TYPE public.enum_prioridad AS ENUM ('ALTA','MEDIA','BAJA');` },

  // ─── AGREGAR PRIORIDAD A seguimientos_fidelizacion ───
  { label: 'Add prioridad column', sql: `ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS prioridad public.enum_prioridad NOT NULL DEFAULT 'MEDIA';` },

  // ─── TABLA: interacciones ───
  { label: 'Tabla interacciones', sql: `CREATE TABLE IF NOT EXISTS public.interacciones (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), seguimiento_id UUID NOT NULL REFERENCES public.seguimientos_fidelizacion(id) ON DELETE CASCADE, tipo public.enum_tipo_interaccion NOT NULL, motivo public.enum_motivo_interaccion NOT NULL, resultado public.enum_resultado_interaccion NOT NULL DEFAULT 'PENDIENTE', fue_venta BOOLEAN NOT NULL DEFAULT FALSE, whatsapp_respondido BOOLEAN DEFAULT NULL, fecha_interaccion TIMESTAMPTZ NOT NULL DEFAULT now(), duracion_segundos INTEGER DEFAULT 0, notas TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());` },

  // ─── INDICES interacciones ───
  { label: 'Idx inter seguimiento', sql: `CREATE INDEX IF NOT EXISTS idx_interacciones_seguimiento ON public.interacciones (seguimiento_id);` },
  { label: 'Idx inter tipo', sql: `CREATE INDEX IF NOT EXISTS idx_interacciones_tipo ON public.interacciones (tipo);` },
  { label: 'Idx inter fecha', sql: `CREATE INDEX IF NOT EXISTS idx_interacciones_fecha ON public.interacciones (fecha_interaccion DESC);` },
  { label: 'Idx inter resultado', sql: `CREATE INDEX IF NOT EXISTS idx_interacciones_resultado ON public.interacciones (resultado);` },
  { label: 'Idx seg prioridad', sql: `CREATE INDEX IF NOT EXISTS idx_seguimientos_prioridad ON public.seguimientos_fidelizacion (prioridad);` },

  // ─── TRIGGER updated_at para interacciones ───
  { label: 'Trigger interacciones', sql: `CREATE TRIGGER trg_interacciones_updated_at BEFORE UPDATE ON public.interacciones FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();` },

  // ─── RLS interacciones ───
  { label: 'RLS enable interacciones', sql: `ALTER TABLE public.interacciones ENABLE ROW LEVEL SECURITY;` },
  { label: 'Policy SEL interacciones', sql: `CREATE POLICY "sel_interacciones" ON public.interacciones FOR SELECT USING (true);` },
  { label: 'Policy AUTH interacciones', sql: `CREATE POLICY "all_auth_interacciones" ON public.interacciones FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');` },
  { label: 'Policy SVC interacciones', sql: `CREATE POLICY "all_svc_interacciones" ON public.interacciones FOR ALL USING (auth.role() = 'service_role');` },

  // ─── GRANTS interacciones ───
  { label: 'Grant SELECT anon interacciones', sql: `GRANT SELECT ON public.interacciones TO anon;` },
  { label: 'Grant ALL auth interacciones', sql: `GRANT ALL ON public.interacciones TO authenticated;` },
  { label: 'Grant ALL svc interacciones', sql: `GRANT ALL ON public.interacciones TO service_role;` },

  // ─── VISTA: resumen diario de interacciones ───
  { label: 'Vista resumen_interacciones_dia', sql: `CREATE OR REPLACE VIEW public.v_resumen_interacciones AS SELECT date_trunc('day', fecha_interaccion)::date AS dia, tipo, motivo, resultado, COUNT(*) AS total, COUNT(*) FILTER (WHERE resultado = 'EXITOSA') AS exitosas, COUNT(*) FILTER (WHERE fue_venta = true) AS ventas, COUNT(*) FILTER (WHERE tipo = 'WHATSAPP_PLANTILLA' AND whatsapp_respondido = true) AS whatsapp_respondidos FROM public.interacciones GROUP BY dia, tipo, motivo, resultado ORDER BY dia DESC;` },
  { label: 'Grant vista anon', sql: `GRANT SELECT ON public.v_resumen_interacciones TO anon, authenticated, service_role;` },
];

// ─── SEED DATA ───
const seedQueries = [
  // Asesor
  { label: 'Seed: Asesor Daniela', sql: `INSERT INTO public.asesores (nombre_completo, rol, activo) VALUES ('Daniela Vega', 'Asesora Senior', true) ON CONFLICT DO NOTHING RETURNING id;` },
  { label: 'Seed: Asesor Carlos', sql: `INSERT INTO public.asesores (nombre_completo, rol, activo) VALUES ('Carlos Méndez', 'Asesor', true) ON CONFLICT DO NOTHING RETURNING id;` },

  // Clientes
  { label: 'Seed: Cliente 1', sql: `INSERT INTO public.clientes (nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion, ultima_compra) VALUES ('María Camila Torres', '+573001234567', 'Cundinamarca', 'Bogotá', 'RECURRENTE', 'ORGANICO', now() - interval '3 days') ON CONFLICT ON CONSTRAINT chk_whatsapp_colombia DO NOTHING;` },
  { label: 'Seed: Cliente 2', sql: `INSERT INTO public.clientes (nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion, ultima_compra) VALUES ('Andrés Felipe Rojas', '+573109876543', 'Antioquia', 'Medellín', 'NUEVO', 'ANUNCIO', now() - interval '1 day') ON CONFLICT ON CONSTRAINT chk_whatsapp_colombia DO NOTHING;` },
  { label: 'Seed: Cliente 3', sql: `INSERT INTO public.clientes (nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion, ultima_compra) VALUES ('Laura Valentina Gómez', '+573205551234', 'Valle del Cauca', 'Cali', 'OCASIONAL', 'EVENTO', now() - interval '10 days') ON CONFLICT ON CONSTRAINT chk_whatsapp_colombia DO NOTHING;` },
  { label: 'Seed: Cliente 4', sql: `INSERT INTO public.clientes (nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion, ultima_compra) VALUES ('Santiago Herrera López', '+573158884321', 'Santander', 'Bucaramanga', 'PERDIDO', 'ORGANICO', now() - interval '45 days') ON CONFLICT ON CONSTRAINT chk_whatsapp_colombia DO NOTHING;` },
  { label: 'Seed: Cliente 5', sql: `INSERT INTO public.clientes (nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion, ultima_compra) VALUES ('Valentina Restrepo M.', '+573176667890', 'Atlántico', 'Barranquilla', 'RECURRENTE', 'ANUNCIO', now() - interval '2 days') ON CONFLICT ON CONSTRAINT chk_whatsapp_colombia DO NOTHING;` },
  { label: 'Seed: Cliente 6', sql: `INSERT INTO public.clientes (nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion, ultima_compra) VALUES ('Juan Pablo Castillo', '+573124445566', 'Risaralda', 'Pereira', 'NUEVO', 'ORGANICO', now()) ON CONFLICT ON CONSTRAINT chk_whatsapp_colombia DO NOTHING;` },
];

// Queries that need IDs from previous inserts - we'll build them dynamically after
const seedWithRefs = [
  { label: 'Seed: Pedidos + Seguimientos + Interacciones', sql: `
DO $$
DECLARE
  v_asesor1 UUID;
  v_asesor2 UUID;
  v_c1 UUID; v_c2 UUID; v_c3 UUID; v_c4 UUID; v_c5 UUID; v_c6 UUID;
  v_p1 UUID; v_p2 UUID; v_p3 UUID; v_p4 UUID; v_p5 UUID; v_p6 UUID; v_p7 UUID;
  v_s1 UUID; v_s2 UUID; v_s3 UUID; v_s4 UUID; v_s5 UUID; v_s6 UUID; v_s7 UUID;
BEGIN
  SELECT id INTO v_asesor1 FROM public.asesores WHERE nombre_completo = 'Daniela Vega' LIMIT 1;
  SELECT id INTO v_asesor2 FROM public.asesores WHERE nombre_completo = 'Carlos Méndez' LIMIT 1;
  SELECT id INTO v_c1 FROM public.clientes WHERE whatsapp = '+573001234567';
  SELECT id INTO v_c2 FROM public.clientes WHERE whatsapp = '+573109876543';
  SELECT id INTO v_c3 FROM public.clientes WHERE whatsapp = '+573205551234';
  SELECT id INTO v_c4 FROM public.clientes WHERE whatsapp = '+573158884321';
  SELECT id INTO v_c5 FROM public.clientes WHERE whatsapp = '+573176667890';
  SELECT id INTO v_c6 FROM public.clientes WHERE whatsapp = '+573124445566';

  -- Pedidos
  INSERT INTO public.pedidos (id, cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES
    (gen_random_uuid(), v_c1, 'Proteína Whey 2lb', 89900, 'WHATSAPP', 'ENTREGADO_AL_CLIENTE', now() - interval '5 days')
    RETURNING id INTO v_p1;
  INSERT INTO public.pedidos (id, cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES
    (gen_random_uuid(), v_c2, 'Creatina Monohidrato 300g', 65000, 'RED_SOCIAL', 'GUIA_GENERADA', now() - interval '1 day')
    RETURNING id INTO v_p2;
  INSERT INTO public.pedidos (id, cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES
    (gen_random_uuid(), v_c3, 'Pre-Entreno Savage 30sv', 120000, 'SHOPIFY', 'EN_REPARTO', now() - interval '3 days')
    RETURNING id INTO v_p3;
  INSERT INTO public.pedidos (id, cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES
    (gen_random_uuid(), v_c4, 'BCAA + Glutamina 500g', 75000, 'WHATSAPP', 'RETRASO_O_MOLESTIA', now() - interval '15 days')
    RETURNING id INTO v_p4;
  INSERT INTO public.pedidos (id, cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES
    (gen_random_uuid(), v_c5, 'Pack Definición (Whey+Quemador)', 185000, 'RED_SOCIAL', 'ENTREGADO_AL_CLIENTE', now() - interval '8 days')
    RETURNING id INTO v_p5;
  INSERT INTO public.pedidos (id, cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES
    (gen_random_uuid(), v_c6, 'Multivitamínico Elite 60 caps', 42000, 'WHATSAPP', 'EN_OFICINA', now() - interval '2 days')
    RETURNING id INTO v_p6;
  INSERT INTO public.pedidos (id, cliente_id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido) VALUES
    (gen_random_uuid(), v_c1, 'Colágeno Hidrolizado 500g', 95000, 'SHOPIFY', 'GUIA_GENERADA', now())
    RETURNING id INTO v_p7;

  -- Seguimientos
  INSERT INTO public.seguimientos_fidelizacion (id, pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES
    (gen_random_uuid(), v_p1, v_asesor1, true, true, false, false, 'Cliente muy satisfecha, interesada en pack mensual', 'BUENO', 'ACTIVA', 'MEDIA')
    RETURNING id INTO v_s1;
  INSERT INTO public.seguimientos_fidelizacion (id, pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES
    (gen_random_uuid(), v_p2, v_asesor1, false, false, false, false, 'Pedido nuevo, pendiente confirmación', 'BUENO', 'ACTIVA', 'ALTA')
    RETURNING id INTO v_s2;
  INSERT INTO public.seguimientos_fidelizacion (id, pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES
    (gen_random_uuid(), v_p3, v_asesor2, true, false, false, false, 'Esperando entrega, cliente preguntó por tracking', 'REGULAR', 'ACTIVA', 'MEDIA')
    RETURNING id INTO v_s3;
  INSERT INTO public.seguimientos_fidelizacion (id, pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES
    (gen_random_uuid(), v_p4, v_asesor2, true, true, true, false, 'URGENTE: Cliente molesto por demora de 15 días, pide devolución', 'CRITICO', 'ACTIVA', 'ALTA')
    RETURNING id INTO v_s4;
  INSERT INTO public.seguimientos_fidelizacion (id, pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES
    (gen_random_uuid(), v_p5, v_asesor1, true, true, true, true, 'Seguimiento completo, cliente recompró', 'BUENO', 'COMPLETADA', 'BAJA')
    RETURNING id INTO v_s5;
  INSERT INTO public.seguimientos_fidelizacion (id, pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES
    (gen_random_uuid(), v_p6, v_asesor1, false, false, false, false, 'Pedido en oficina, esperando recogida', 'REGULAR', 'ACTIVA', 'ALTA')
    RETURNING id INTO v_s6;
  INSERT INTO public.seguimientos_fidelizacion (id, pedido_id, asesor_id, llamada_5d, llamada_15d, llamada_25d, llamada_35d, observaciones, calidad, estado_tarea, prioridad) VALUES
    (gen_random_uuid(), v_p7, v_asesor1, false, false, false, false, 'Pedido recién creado', 'BUENO', 'ACTIVA', 'MEDIA')
    RETURNING id INTO v_s7;

  -- Interacciones (flujo: WA plantilla -> si no responde -> Llamada IA)
  -- Seguimiento 1: WA respondido + Llamada exitosa
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s1, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, true, now() - interval '5 days', 0, 'Plantilla de confirmación enviada, cliente respondió OK');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s1, 'LLAMADA_IA', 'SEGUIMIENTO_5D', 'EXITOSA', false, null, now() - interval '3 days', 145, 'Llamada IA día 5: cliente contenta con el producto');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s1, 'WHATSAPP_PLANTILLA', 'SEGUIMIENTO_15D', 'EXITOSA', false, true, now() - interval '1 day', 0, 'WA seguimiento 15d respondido');

  -- Seguimiento 2: WA pendiente confirmación
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s2, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'PENDIENTE', false, false, now() - interval '1 day', 0, 'Plantilla enviada, sin respuesta aún');

  -- Seguimiento 3: WA no respondido + Llamada IA exitosa
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s3, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, true, now() - interval '3 days', 0, 'Confirmación OK');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s3, 'WHATSAPP_PLANTILLA', 'SEGUIMIENTO_5D', 'EXITOSA', false, false, now() - interval '1 day', 0, 'WA enviado pero no respondió');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s3, 'LLAMADA_IA', 'SEGUIMIENTO_5D', 'EXITOSA', false, null, now() - interval '1 day' + interval '2 hours', 98, 'Llamada IA porque no respondió WA. Cliente confirmó tracking');

  -- Seguimiento 4: Caso CRÍTICO - múltiples intentos
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s4, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, true, now() - interval '15 days', 0, 'Confirmación OK');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s4, 'LLAMADA_IA', 'SEGUIMIENTO_5D', 'EXITOSA', false, null, now() - interval '10 days', 180, 'Cliente preguntó por estado. No ha llegado');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s4, 'WHATSAPP_PLANTILLA', 'NOVEDAD', 'EXITOSA', false, true, now() - interval '5 days', 0, 'WA novedad: cliente reporta que no llega');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s4, 'LLAMADA_IA', 'RETRASO', 'EXITOSA', false, null, now() - interval '3 days', 240, 'Llamada IA por retraso. Cliente muy molesto, pide devolución');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s4, 'LLAMADA_IA', 'SEGUIMIENTO_25D', 'NO_CONTESTO', false, null, now() - interval '1 day', 0, 'Llamada IA día 25: no contestó');

  -- Seguimiento 5: COMPLETADO con venta
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s5, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, true, now() - interval '8 days', 0, 'Confirmación OK');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s5, 'LLAMADA_IA', 'SEGUIMIENTO_5D', 'EXITOSA', true, null, now() - interval '5 days', 210, 'Llamada 5D: cliente encantada, pidió otro producto. VENTA!');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s5, 'LLAMADA_IA', 'FIDELIZACION', 'EXITOSA', true, null, now() - interval '2 days', 155, 'Llamada fidelización: compró pack mensual. VENTA!');

  -- Seguimiento 6: WA sin respuesta + llamada buzón
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s6, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'EXITOSA', false, false, now() - interval '2 days', 0, 'WA enviado, no respondió');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s6, 'LLAMADA_IA', 'CONFIRMACION_PEDIDO', 'BUZON', false, null, now() - interval '2 days' + interval '3 hours', 0, 'Llamada IA: fue a buzón de voz');
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s6, 'LLAMADA_IA', 'CONFIRMACION_PEDIDO', 'NO_CONTESTO', false, null, now() - interval '1 day', 0, 'Segundo intento: no contestó');

  -- Seguimiento 7: Recién creado, solo WA
  INSERT INTO public.interacciones (seguimiento_id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos, notas) VALUES
    (v_s7, 'WHATSAPP_PLANTILLA', 'CONFIRMACION_PEDIDO', 'PENDIENTE', false, false, now(), 0, 'Plantilla de confirmación recién enviada');

END $$;
  `}
];

function executeQuery(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(API_URL, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`  ✅ ${label}`);
        } else {
          console.log(`  ❌ ${label} (${res.statusCode}): ${data.substring(0, 200)}`);
        }
        resolve(data);
      });
    });
    req.on('error', (err) => { console.log(`  ❌ ${label}: ${err.message}`); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== MIGRACIÓN 002: Interacciones IA + Seed Data ===\n');

  console.log('── Schema changes ──');
  for (const q of queries) {
    await executeQuery(q.label, q.sql);
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n── Seed: Asesores + Clientes ──');
  for (const q of seedQueries) {
    await executeQuery(q.label, q.sql);
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n── Seed: Pedidos + Seguimientos + Interacciones ──');
  for (const q of seedWithRefs) {
    await executeQuery(q.label, q.sql);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n── Verificación ──');
  await executeQuery('Count clientes', "SELECT COUNT(*) as total FROM public.clientes;");
  await executeQuery('Count pedidos', "SELECT COUNT(*) as total FROM public.pedidos;");
  await executeQuery('Count seguimientos', "SELECT COUNT(*) as total FROM public.seguimientos_fidelizacion;");
  await executeQuery('Count interacciones', "SELECT COUNT(*) as total FROM public.interacciones;");

  console.log('\n=== MIGRACIÓN 002 COMPLETA ===');
}

main().catch(console.error);
