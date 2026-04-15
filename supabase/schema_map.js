const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function rpc(sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = {
      hostname: HOST, path: '/rest/v1/rpc/exec_sql', method: 'POST',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', e => resolve(e.message));
    req.write(body); req.end();
  });
}

// Need a query-returning function
function execQuery(sql) {
  return new Promise((resolve) => {
    // Create a temporary function that returns query results
    const wrappedSQL = `SELECT json_agg(t) FROM (${sql}) t`;
    const body = JSON.stringify({ query: wrappedSQL });
    // exec_sql doesn't return results, so let's use a different approach
    // Use the REST API to query information_schema directly via a view
    resolve(null);
  });
}

function restGet(path) {
  return new Promise((resolve) => {
    const opts = {
      hostname: HOST, path, method: 'GET',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', e => resolve(e.message));
    req.end();
  });
}

async function main() {
  const tables = ['asesores', 'clientes', 'pedidos', 'seguimientos_fidelizacion', 'interacciones'];
  
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  MAPEO COMPLETO DE CAMPOS — Supabase CRM Fidelización');
  console.log('════════════════════════════════════════════════════════════════\n');

  for (const t of tables) {
    // Get one row to see all columns and their current values
    const row = await restGet(`/rest/v1/${t}?select=*&limit=1`);
    const cols = Array.isArray(row) && row.length > 0 ? Object.keys(row[0]) : [];
    const sample = Array.isArray(row) && row.length > 0 ? row[0] : {};
    
    console.log(`\n┌─────────────────────────────────────────────────────────────`);
    console.log(`│  📋 TABLA: ${t}`);
    console.log(`├─────────────────────────────────────────────────────────────`);
    
    if (cols.length === 0) {
      console.log(`│  (tabla vacía o sin columnas detectables)`);
    } else {
      cols.forEach(col => {
        const val = sample[col];
        const tipo = val === null ? 'null' : typeof val === 'boolean' ? 'BOOLEAN' : typeof val === 'number' ? 'NUMBER' : typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val) ? 'TIMESTAMPTZ' : typeof val === 'string' && /^[0-9a-f]{8}-/.test(val) ? 'UUID' : 'TEXT';
        const ejemplo = val === null ? 'null' : typeof val === 'string' && val.length > 50 ? val.substring(0, 50) + '…' : String(val);
        console.log(`│  ${col.padEnd(25)} │ ${tipo.padEnd(12)} │ ${ejemplo}`);
      });
    }
    console.log(`└─────────────────────────────────────────────────────────────`);
  }

  // Also show foreign key relationships
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('  RELACIONES (Foreign Keys)');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  pedidos.cliente_id          → clientes.id');
  console.log('  seguimientos.pedido_id      → pedidos.id');
  console.log('  seguimientos.asesor_id      → asesores.id');
  console.log('  interacciones.seguimiento_id → seguimientos_fidelizacion.id');
  
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('  VALORES PERMITIDOS (campos TEXT con valores esperados)');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  clientes.etiqueta:          NUEVO | PERDIDO | OCASIONAL | RECURRENTE');
  console.log('  clientes.canal_adquisicion: ORGANICO | ANUNCIO | EVENTO | (libre)');
  console.log('  pedidos.area_ventas:        WHATSAPP | RED_SOCIAL | SHOPIFY | (libre)');
  console.log('  pedidos.estado_logistico:   TODAS | GUIA_GENERADA | EN_REPARTO | EN_OFICINA | ENTREGADO_AL_CLIENTE | HABLAR_CON_ASESOR | RETRASO_O_MOLESTIA | NOVEDADES | GARANTIAS | DEVOLUCIONES');
  console.log('  seguimientos.prioridad:     ALTA | MEDIA | BAJA');
  console.log('  seguimientos.calidad:       BUENO | REGULAR | CRITICO');
  console.log('  seguimientos.estado_tarea:  ACTIVA | COMPLETADA | ARCHIVADA');
  console.log('  interacciones.tipo:         WHATSAPP_PLANTILLA | LLAMADA_IA | WHATSAPP_MANUAL');
  console.log('  interacciones.motivo:       CONFIRMACION_PEDIDO | SEGUIMIENTO_5D | SEGUIMIENTO_15D | SEGUIMIENTO_25D | SEGUIMIENTO_35D | NOVEDAD | RETRASO | FIDELIZACION');
  console.log('  interacciones.resultado:    EXITOSA | NO_CONTESTO | BUZON | RECHAZADA | PENDIENTE');

  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('  FORMATO fecha_registro');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  Tipo:    TEXT');
  console.log('  Formato: YYYY-MM-DD HH:MM:SS');
  console.log('  Ejemplo: 2026-04-15 11:23:19');
  console.log('  TZ:      America/Bogota (UTC-5)');
  console.log('  Default: Se llena automáticamente si no se envía');
  console.log('  n8n:     Se puede enviar desde n8n con el expression:');
  console.log('           {{ (() => { const d = new Date(); const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).formatToParts(d).reduce((o,x)=>(o[x.type]=x.value,o),{}); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`; })() }}');
}

main().catch(console.error);
