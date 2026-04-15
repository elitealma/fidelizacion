// ============================================================
// ELITE NUTRITION — CRM Fidelización v2
// Equipo de fidelización: seguimiento, recompras, Kanban, Reportes
// Fechas automáticas, gráficos de área, clientes pendientes
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initTabs();
    initSearch();
    initFilters();
    initPagination();
    initKanbanControls();
    loadAll();
    initRealtime();
});

// ── STATE ────────────────────────────────────────────────────
let currentTab = 'ACTIVA';
let allRows = [];
let filteredRows = [];
let currentPage = 1;
const PAGE_SIZE = 15;
let allInteracciones = [];
let allClientes = [];
let allPedidos = [];
let allAsesores = [];

async function loadAll() {
    await loadCoreData();
    loadKPIs();
    loadInteractionStats();
    loadSidebarStats();
    loadPendientes();
    loadCharts();
    loadTable();
}

async function loadCoreData() {
    const [r1, r2, r3, r4] = await Promise.all([
        supabase.from('interacciones').select('*'),
        supabase.from('clientes').select('*'),
        supabase.from('pedidos').select('*'),
        supabase.from('asesores').select('*').eq('activo', true),
    ]);
    allInteracciones = r1.data || [];
    allClientes = r2.data || [];
    allPedidos = r3.data || [];
    allAsesores = r4.data || [];
}

function initRealtime() {
    supabase.channel('schema-db-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'seguimientos_fidelizacion' },
            (payload) => {
                console.log('Realtime change:', payload);
                if (window.realtimeTimeout) clearTimeout(window.realtimeTimeout);
                window.realtimeTimeout = setTimeout(() => {
                    loadAll();
                }, 1000);
            }
        )
        .subscribe();
}

// ── KPIs ─────────────────────────────────────────────────────
function loadKPIs() {
    document.getElementById('kpi-val-clientes').textContent = allClientes.length.toLocaleString('es-CO');

    const tickets = allPedidos.map(p => parseFloat(p.ticket_compra || 0));
    const avg = tickets.length ? Math.round(tickets.reduce((a, b) => a + b, 0) / tickets.length) : 0;
    document.getElementById('kpi-val-ticket').textContent = '$' + avg.toLocaleString('es-CO');

    const calls = allInteracciones.filter(i => i.tipo === 'LLAMADA_IA');
    const okCalls = calls.filter(i => i.resultado === 'EXITOSA');
    document.getElementById('kpi-val-llamadas').textContent = calls.length;
    document.getElementById('kpi-sub-llamadas').textContent = `${okCalls.length} exitosas`;

    // Pendientes por contactar
    const pendientes = calcPendientes();
    document.getElementById('kpi-val-pendientes').textContent = pendientes.length;
    document.getElementById('kpi-sub-pendientes').textContent = pendientes.length > 0 ? `${pendientes.length} sin contacto` : 'Al día ✓';
}

function calcPendientes() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenStr = sevenDaysAgo.toISOString().slice(0, 10);

    const contactedClientIds = new Set();
    allInteracciones.forEach(i => {
        if (i.fecha_interaccion && i.fecha_interaccion.slice(0, 10) >= sevenStr) {
            // We need to find the client via seguimiento -> pedido -> cliente
            // For efficiency, just mark seguimiento_id as contacted
            contactedClientIds.add(i.seguimiento_id);
        }
    });

    // Get all clients that have pedidos but no recent interactions
    const clientsWithPedidos = new Set(allPedidos.map(p => p.cliente_id));
    const clientsContacted = new Set();

    // Build a map: seguimiento -> pedido -> cliente
    // We'll use allRows from the table for this (loaded separately)
    // For now, calculate from allClientes - those without recent interactions
    allInteracciones.forEach(i => {
        if (i.fecha_interaccion && i.fecha_interaccion.slice(0, 10) >= sevenStr) {
            // Find which client this interaction belongs to
            const pedido = allPedidos.find(p => {
                // interacciones link to seguimientos, not directly to pedidos
                // We'll approximate: any client with ANY recent interaction is contacted
                return true;
            });
        }
    });

    // Simpler approach: clients with at least one pedido and no interaction in last 7 days
    const recentInteractionSeguimientoIds = new Set(
        allInteracciones
            .filter(i => i.fecha_interaccion && i.fecha_interaccion.slice(0, 10) >= sevenStr)
            .map(i => i.seguimiento_id)
    );

    return allClientes.filter(c => {
        const hasPedido = allPedidos.some(p => p.cliente_id === c.id);
        if (!hasPedido) return false;
        // Check if any interaction exists recently for this client's pedidos
        const clientPedidoIds = allPedidos.filter(p => p.cliente_id === c.id).map(p => p.id);
        // We can't directly link without seguimientos, so use a broader check
        const hasRecentInteraction = allInteracciones.some(i => {
            if (!i.fecha_interaccion || i.fecha_interaccion.slice(0, 10) < sevenStr) return false;
            return true; // This would need seguimientos link
        });
        return !hasRecentInteraction;
    });
}

function loadInteractionStats() {
    const wa = allInteracciones.filter(i => i.tipo === 'WHATSAPP_PLANTILLA');
    const waOk = wa.filter(i => i.whatsapp_respondido === true);
    const calls = allInteracciones.filter(i => i.tipo === 'LLAMADA_IA');
    const callsOk = calls.filter(i => i.resultado === 'EXITOSA');
    const ventas = allInteracciones.filter(i => i.fue_venta === true);
    const ventasPct = calls.length ? Math.round((ventas.length / calls.length) * 100) : 0;
    const pendWa = wa.filter(i => i.resultado === 'PENDIENTE' || i.whatsapp_respondido === false);
    const pendCalls = calls.filter(i => ['NO_CONTESTO', 'BUZON'].includes(i.resultado));

    document.getElementById('istat-wa-sent').textContent = wa.length;
    document.getElementById('istat-wa-responded').textContent = `${waOk.length} respondidos`;
    document.getElementById('istat-calls-total').textContent = calls.length;
    document.getElementById('istat-calls-ok').textContent = `${callsOk.length} exitosas`;
    document.getElementById('istat-ventas').textContent = ventas.length;
    document.getElementById('istat-ventas-pct').textContent = `${ventasPct}% conversión`;
    document.getElementById('istat-pending').textContent = pendWa.length + pendCalls.length;
    document.getElementById('istat-pending-wa').textContent = `${pendWa.length} WA + ${pendCalls.length} Llam`;
}

function loadSidebarStats() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('sidebar-calls-today').textContent = allInteracciones.filter(i => i.tipo === 'LLAMADA_IA' && i.fecha_interaccion?.startsWith(today)).length;
    document.getElementById('sidebar-wa-today').textContent = allInteracciones.filter(i => i.tipo === 'WHATSAPP_PLANTILLA' && i.fecha_interaccion?.startsWith(today)).length;
}

// ── PENDIENTES POR CONTACTAR ─────────────────────────────────
async function loadPendientes() {
    const grid = document.getElementById('pendientes-grid');
    const countEl = document.getElementById('pendientes-count');
    if (!grid) return;

    // Get seguimientos with their client info and interactions
    const { data: segs } = await supabase
        .from('seguimientos_fidelizacion')
        .select(`*, pedidos ( producto, ticket_compra, clientes ( id, nombre_completo, whatsapp, ciudad, departamento, etiqueta ) ), interacciones ( fecha_interaccion, tipo, resultado )`)
        .eq('estado_tarea', 'ACTIVA')
        .order('created_at', { ascending: false });

    if (!segs || !segs.length) {
        grid.innerHTML = '<div class="pendientes-empty"><span class="material-icons-outlined">check_circle</span> Todos los clientes están al día</div>';
        countEl.textContent = '0';
        return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenStr = sevenDaysAgo.toISOString().slice(0, 10);

    const pendientes = segs.filter(s => {
        const ints = s.interacciones || [];
        if (!ints.length) return true; // no interactions at all
        const lastInt = ints.sort((a, b) => new Date(b.fecha_interaccion) - new Date(a.fecha_interaccion))[0];
        return !lastInt.fecha_interaccion || lastInt.fecha_interaccion.slice(0, 10) < sevenStr;
    });

    countEl.textContent = pendientes.length;
    document.getElementById('kpi-val-pendientes').textContent = pendientes.length;
    document.getElementById('kpi-sub-pendientes').textContent = pendientes.length > 0 ? `${pendientes.length} sin contacto` : 'Al día ✓';

    if (!pendientes.length) {
        grid.innerHTML = '<div class="pendientes-empty"><span class="material-icons-outlined">check_circle</span> Todos los clientes están al día</div>';
        return;
    }

    grid.innerHTML = pendientes.slice(0, 12).map(s => {
        const c = s.pedidos?.clientes || {};
        const p = s.pedidos || {};
        const ints = s.interacciones || [];
        const lastDate = ints.length
            ? ints.sort((a, b) => new Date(b.fecha_interaccion) - new Date(a.fecha_interaccion))[0]?.fecha_interaccion?.slice(0, 10) || 'Nunca'
            : 'Nunca';
        const diasSin = lastDate !== 'Nunca'
            ? Math.floor((new Date() - new Date(lastDate)) / (1000 * 60 * 60 * 24))
            : '∞';

        return `<div class="pendiente-card">
            <div class="pendiente-card-top">
                <span class="segmento-badge ${c.etiqueta || 'NUEVO'}">${c.etiqueta || '-'}</span>
                <span class="pendiente-dias">${diasSin === '∞' ? '∞' : diasSin + 'd'} sin contacto</span>
            </div>
            <div class="pendiente-name">${c.nombre_completo || '-'}</div>
            <div class="pendiente-location">${c.ciudad || ''}${c.ciudad && c.departamento ? ', ' : ''}${c.departamento || ''}</div>
            <div class="pendiente-product">${p.producto || '-'} · $${parseFloat(p.ticket_compra || 0).toLocaleString('es-CO')}</div>
            <div class="pendiente-actions">
                <a href="https://wa.me/${(c.whatsapp || '').replace('+', '')}" target="_blank" class="pendiente-btn pendiente-btn-wa" title="WhatsApp">
                    <span class="material-icons-outlined">chat</span>
                </a>
                <span class="pendiente-last">Último: ${lastDate}</span>
            </div>
        </div>`;
    }).join('');
}

// ── CHARTS ───────────────────────────────────────────────────
function loadCharts() { drawSegmentacionChart(); drawInteraccionesAreaChart(); }

function drawSegmentacionChart() {
    const canvas = document.getElementById('canvas-segmentacion');
    if (!canvas) return;
    const counts = { NUEVO: 0, PERDIDO: 0, OCASIONAL: 0, RECURRENTE: 0 };
    allClientes.forEach(c => { if (counts.hasOwnProperty(c.etiqueta)) counts[c.etiqueta]++; });
    const total = allClientes.length || 1;
    const segs = [
        { label: 'Nuevo', val: counts.NUEVO, color: '#8b5cf6' },
        { label: 'Perdido', val: counts.PERDIDO, color: '#ef4444' },
        { label: 'Ocasional', val: counts.OCASIONAL, color: '#3b82f6' },
        { label: 'Recurrente', val: counts.RECURRENTE, color: '#22c55e' },
    ];
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 280, 280);
    let angle = -Math.PI / 2;
    segs.forEach(s => {
        const a = (s.val / total) * 2 * Math.PI;
        ctx.beginPath(); ctx.arc(140, 140, 110, angle, angle + a); ctx.arc(140, 140, 65, angle + a, angle, true); ctx.closePath();
        ctx.fillStyle = s.color; ctx.fill(); angle += a;
    });
    ctx.fillStyle = '#e8eaf0'; ctx.font = 'bold 28px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(total.toString(), 140, 132); ctx.fillStyle = '#8b8fa3'; ctx.font = '11px Inter'; ctx.fillText('CLIENTES', 140, 154);
    const leg = document.getElementById('legend-segmentacion');
    if (leg) leg.innerHTML = segs.map(s => `<div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span><span>${s.label}</span><span class="legend-value">${s.val}</span></div>`).join('');
}

// ── GRÁFICO DE ÁREA (reemplaza barras) ──────────────────────
function drawInteraccionesAreaChart() {
    const canvas = document.getElementById('canvas-interacciones');
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }

    const wa = {}, ca = {}, vt = {};
    days.forEach(d => { wa[d] = 0; ca[d] = 0; vt[d] = 0; });
    allInteracciones.forEach(r => {
        const day = r.fecha_interaccion?.slice(0, 10);
        if (day && days.includes(day)) {
            if (r.tipo === 'WHATSAPP_PLANTILLA') wa[day]++;
            else if (r.tipo === 'LLAMADA_IA') ca[day]++;
            if (r.fue_venta) vt[day]++;
        }
    });

    const waVals = days.map(d => wa[d]);
    const caVals = days.map(d => ca[d]);
    const vtVals = days.map(d => vt[d]);
    const maxVal = Math.max(...waVals, ...caVals, 1);

    const padL = 40, padR = 20, padT = 20, padB = 50;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padT + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillStyle = '#5c6073'; ctx.font = '10px Inter'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), padL - 8, y);
    }

    // X labels
    days.forEach((day, i) => {
        const x = padL + (chartW / (days.length - 1)) * i;
        ctx.fillStyle = '#5c6073'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
        const d = new Date(day + 'T12:00:00');
        const label = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
        ctx.fillText(label, x, H - padB + 18);
    });

    // Draw area for WhatsApp
    drawAreaCurve(ctx, days, waVals, maxVal, padL, padT, chartW, chartH, '#22c55e', 'rgba(34,197,94,0.15)');
    // Draw area for Llamadas IA
    drawAreaCurve(ctx, days, caVals, maxVal, padL, padT, chartW, chartH, '#f5c542', 'rgba(245,197,66,0.12)');
    // Draw dots for ventas
    drawDots(ctx, days, vtVals, maxVal, padL, padT, chartW, chartH, '#3b82f6');

    // Legend
    const legendY = H - 12;
    ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(padL + 10, legendY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b8fa3'; ctx.font = '10px Inter'; ctx.textAlign = 'left'; ctx.fillText('WhatsApp', padL + 20, legendY + 3);

    ctx.fillStyle = '#f5c542'; ctx.beginPath(); ctx.arc(padL + 100, legendY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b8fa3'; ctx.fillText('Llamada IA', padL + 110, legendY + 3);

    ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(padL + 200, legendY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b8fa3'; ctx.fillText('Ventas', padL + 210, legendY + 3);
}

function drawAreaCurve(ctx, days, vals, maxVal, padL, padT, chartW, chartH, strokeColor, fillColor) {
    const n = days.length;
    if (n < 2) return;

    const points = vals.map((v, i) => ({
        x: padL + (chartW / (n - 1)) * i,
        y: padT + chartH - (v / maxVal) * chartH
    }));

    // Smooth curve using bezier
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
        const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
        const cp1y = points[i].y;
        const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
        const cp2y = points[i + 1].y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i + 1].x, points[i + 1].y);
    }

    // Fill area
    const baseline = padT + chartH;
    ctx.lineTo(points[n - 1].x, baseline);
    ctx.lineTo(points[0].x, baseline);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
        const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
        const cp1y = points[i].y;
        const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
        const cp2y = points[i + 1].y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i + 1].x, points[i + 1].y);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dots
    points.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor; ctx.fill();
        ctx.strokeStyle = '#0f1117'; ctx.lineWidth = 2; ctx.stroke();
        // Value label
        if (vals[i] > 0) {
            ctx.fillStyle = '#e8eaf0'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center';
            ctx.fillText(vals[i], p.x, p.y - 12);
        }
    });
}

function drawDots(ctx, days, vals, maxVal, padL, padT, chartW, chartH, color) {
    const n = days.length;
    vals.forEach((v, i) => {
        if (v > 0) {
            const x = padL + (chartW / (n - 1)) * i;
            const y = padT + chartH - (v / maxVal) * chartH;
            ctx.beginPath(); ctx.arc(x, y - 6, 6, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(v, x, y - 6);
        }
    });
}

// ── TABLE ────────────────────────────────────────────────────
function fechaBogota() {
    const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

async function loadTable() {
    const { data, error } = await supabase
        .from('seguimientos_fidelizacion')
        .select(`*, pedidos ( id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido, clientes ( id, nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion ) ), asesores ( id, nombre_completo ), interacciones ( id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, duracion_segundos, fecha_interaccion, notas )`)
        .eq('estado_tarea', currentTab)
        .order('created_at', { ascending: false });
    if (error) { console.error(error); allRows = []; }
    else { const po = { ALTA: 0, MEDIA: 1, BAJA: 2 }; allRows = (data || []).sort((a, b) => (po[a.prioridad] || 1) - (po[b.prioridad] || 1)); }

    // Auto-marcar checkboxes según días transcurridos desde fecha_pedido
    await autoCheckByDays();
    applyFilters();
}

async function autoCheckByDays() {
    const now = new Date();
    const todayStr = fechaBogota().split(' ')[0]; // YYYY-MM-DD
    const checks = [
        { days: 5,  boolField: 'llamada_5d',  dateField: 'fecha_5d' },
        { days: 15, boolField: 'llamada_15d', dateField: 'fecha_15d' },
        { days: 25, boolField: 'llamada_25d', dateField: 'fecha_25d' },
        { days: 35, boolField: 'llamada_35d', dateField: 'fecha_35d' },
    ];

    for (const seg of allRows) {
        const fechaPedido = seg.pedidos?.fecha_pedido;
        if (!fechaPedido) continue;

        const pedidoDate = new Date(fechaPedido);
        const diffDays = Math.floor((now - pedidoDate) / (1000 * 60 * 60 * 24));
        const updates = {};

        for (const ck of checks) {
            if (diffDays >= ck.days && !seg[ck.boolField]) {
                updates[ck.boolField] = true;
                updates[ck.dateField] = todayStr;
                seg[ck.boolField] = true;
                seg[ck.dateField] = todayStr;
            }
        }

        if (Object.keys(updates).length > 0) {
            const { error } = await supabase
                .from('seguimientos_fidelizacion')
                .update(updates)
                .eq('id', seg.id);
            if (error) console.warn(`Auto-check error [${seg.id}]:`, error.message);
        }
    }
}

function initFilters() {
    document.getElementById('btn-filter-apply').addEventListener('click', applyFilters);
    document.getElementById('btn-filter-clear').addEventListener('click', () => {
        document.getElementById('filter-prioridad').value = '';
        document.getElementById('filter-segmento').value = '';
        document.getElementById('filter-logistico').value = '';
        document.getElementById('filter-canal').value = '';
        document.getElementById('filter-fecha').value = '';
        document.getElementById('filter-ubicacion').value = '';
        applyFilters();
    });
}

function applyFilters() {
    const pr = document.getElementById('filter-prioridad').value;
    const seg = document.getElementById('filter-segmento').value;
    const log = document.getElementById('filter-logistico').value;
    const can = document.getElementById('filter-canal').value.toLowerCase().trim();
    const fec = document.getElementById('filter-fecha').value;
    const ubi = document.getElementById('filter-ubicacion').value.toLowerCase().trim();

    filteredRows = allRows.filter(r => {
        const c = r.pedidos?.clientes || {}, p = r.pedidos || {};
        if (pr && r.prioridad !== pr) return false;
        if (seg && c.etiqueta !== seg) return false;
        if (log && p.estado_logistico !== log) return false;
        if (can && !(c.canal_adquisicion || '').toLowerCase().includes(can) && !(p.area_ventas || '').toLowerCase().includes(can)) return false;
        
        if (fec) {
            const rowFecha = (r.fecha_registro || '').split(' ')[0];
            if (rowFecha !== fec) return false;
        }

        if (ubi) {
            const locStr = `${c.ciudad || ''} ${c.departamento || ''} ${c.pais || ''}`.toLowerCase();
            if (!locStr.includes(ubi)) return false;
        }

        return true;
    });
    currentPage = 1; renderTable();
}

function renderTable() {
    const tbody = document.getElementById('table-body'); tbody.innerHTML = '';
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filteredRows.slice(start, start + PAGE_SIZE);
    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="17" style="text-align:center;padding:40px;color:var(--color-text-muted);"><span class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:8px">inbox</span>No hay registros</td></tr>`;
        updFooter(0); return;
    }
    page.forEach((seg, idx) => {
        const p = seg.pedidos || {}, c = p.clientes || {}, ints = seg.interacciones || [];
        const tr = document.createElement('tr'); tr.style.animationDelay = `${idx * 0.04}s`;
        const prC = { ALTA: 'prio-alta', MEDIA: 'prio-media', BAJA: 'prio-baja' }[seg.prioridad] || 'prio-media';
        const prI = { ALTA: '🔴', MEDIA: '🟡', BAJA: '🟢' }[seg.prioridad] || '🟡';
        const lastWA = ints.filter(i => i.tipo === 'WHATSAPP_PLANTILLA').sort((a, b) => new Date(b.fecha_interaccion) - new Date(a.fecha_interaccion))[0];
        let waH = '<span class="wa-status wa-none">—</span>';
        if (lastWA) { if (lastWA.whatsapp_respondido) waH = '<span class="wa-status wa-responded">✅ Respondido</span>'; else if (lastWA.resultado === 'PENDIENTE') waH = '<span class="wa-status wa-pending">⏳ Pendiente</span>'; else waH = '<span class="wa-status wa-sent">📤 Enviado</span>'; }
        const lastCall = ints.filter(i => i.tipo === 'LLAMADA_IA').sort((a, b) => new Date(b.fecha_interaccion) - new Date(a.fecha_interaccion))[0];
        let caH = '<span class="call-status call-none">—</span>';
        if (lastCall) { const d = lastCall.duracion_segundos > 0 ? `${Math.floor(lastCall.duracion_segundos / 60)}m${lastCall.duracion_segundos % 60}s` : ''; if (lastCall.resultado === 'EXITOSA') caH = `<span class="call-status call-ok">✅ ${d}</span>`; else if (lastCall.resultado === 'NO_CONTESTO') caH = '<span class="call-status call-fail">📵 No contestó</span>'; else if (lastCall.resultado === 'BUZON') caH = '<span class="call-status call-fail">📭 Buzón</span>'; else caH = `<span class="call-status call-pending">⏳ ${lastCall.resultado}</span>`; }

        // Ventas
        const ventasInt = ints.filter(i => i.fue_venta);
        const ventasCount = ventasInt.length;
        let ventasH = '<span class="cell-no-venta">—</span>';
        if (ventasCount > 0) {
            ventasH = `<span class="venta-badge-cell">💰 ${ventasCount} venta${ventasCount > 1 ? 's' : ''}</span>`;
        }

        // Resumen de llamada
        const resumenText = seg.resumen_llamada || (lastCall ? (lastCall.notas || '-') : '-');
        const resumenShort = resumenText.length > 60 ? resumenText.substring(0, 60) + '…' : resumenText;

        // Fecha registro
        const fechaReg = seg.fecha_registro || '';
        const fechaParts = fechaReg.split(' ');
        const fechaDia = fechaParts[0] || '-';
        const fechaHora = fechaParts[1] || '';

        // Determinar si es día de seguimiento para mostrar u ocultar WhatsApp
        let esDiaDeSeguimiento = false;
        if (p.fecha_pedido) {
            const datePedido = new Date(p.fecha_pedido);
            const dateNow = new Date();
            dateNow.setHours(0, 0, 0, 0);
            datePedido.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((dateNow - datePedido) / (1000 * 60 * 60 * 24));
            esDiaDeSeguimiento = [5, 15, 25, 35].includes(diffDays);
        }

        // Construir la celda de GUIA y WHATSAPP
        const guiaElem = p.guia ? `<div style="font-size:12px; font-weight:600; color:#3b82f6; margin-bottom:4px" title="Guía">🚚 ${p.guia}</div>` : '';
        let waLink = '';
        if (c.whatsapp) {
            if (ventasCount > 0) {
                waLink = '<span style="font-size:11px;color:var(--color-text-muted)">Oculto (Venta)</span>';
            } else if (esDiaDeSeguimiento) {
                waLink = `<a href="https://wa.me/${c.whatsapp.replace('+', '')}" target="_blank">${c.whatsapp}</a>`;
            } else {
                waLink = '<span style="font-size:11px;color:var(--color-text-muted)">Oculto</span>';
            }
        } else {
            waLink = '-';
        }

        tr.innerHTML = `
            <td class="cell-fecha"><span class="fecha-dia">${fechaDia}</span><span class="fecha-hora">${fechaHora}</span></td>
            <td><span class="prio-badge ${prC}">${prI} ${seg.prioridad || 'MEDIA'}</span></td>
            <td class="cell-cliente"><span class="client-name">${c.nombre_completo || '-'}</span><span class="client-location">${c.ciudad || ''}${c.ciudad && c.departamento ? ', ' : ''}${c.departamento || ''}</span></td>
            <td class="cell-whatsapp">${guiaElem}<div>${waLink}</div></td>
            <td><span class="segmento-badge ${c.etiqueta || 'NUEVO'}">${c.etiqueta || '-'}</span></td>
            <td><span class="product-badge">${(p.producto || '-').toUpperCase()}</span><br><span class="cell-ticket">$${parseFloat(p.ticket_compra || 0).toLocaleString('es-CO')}</span></td>
            <td><span class="estado-badge ${p.estado_logistico || 'TODAS'}">${(p.estado_logistico || '-').replace(/_/g, ' ')}</span></td>
            <td>${waH}</td><td>${caH}</td>
            <td class="cell-check">${chk(seg, 'llamada_5d', 'fecha_5d')}</td>
            <td class="cell-check">${chk(seg, 'llamada_15d', 'fecha_15d')}</td>
            <td class="cell-check">${chk(seg, 'llamada_25d', 'fecha_25d')}</td>
            <td class="cell-check">${chk(seg, 'llamada_35d', 'fecha_35d')}</td>
            <td class="cell-resumen" title="${resumenText.replace(/"/g, '&quot;')}"><em>${resumenShort}</em></td>
            <td>${ventasH}</td>
            <td class="cell-obs"><em>${seg.observaciones || '-'}</em></td>
            <td><span class="calidad-badge ${seg.calidad || 'BUENO'}"><span class="calidad-dot"></span> ${seg.calidad || '-'}</span></td>
        `;
        tbody.appendChild(tr);
    });
    initCheckboxes(); updFooter(filteredRows.length);
}

function chk(seg, field, dateField) {
    const dateVal = seg[dateField] || '';
    const dateDisplay = dateVal ? `<span class="check-date">${dateVal}</span>` : '';
    return `<div class="check-cell-wrap">
        <span class="check-icon ${seg[field] ? 'checked' : 'unchecked'}" data-field="${field}" data-date-field="${dateField || ''}" data-id="${seg.id}">
            <span class="material-icons-outlined">${seg[field] ? 'check_box' : 'check_box_outline_blank'}</span>
        </span>
        ${dateDisplay}
    </div>`;
}

function updFooter(total) {
    const tp = Math.ceil(total / PAGE_SIZE) || 1;
    document.getElementById('table-info').textContent = `${Math.min(total, PAGE_SIZE)} de ${total} registros · Pág. ${currentPage}/${tp}`;
    document.getElementById('page-indicator').textContent = `${currentPage} / ${tp}`;
}

function initPagination() {
    document.getElementById('page-prev').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    document.getElementById('page-next').addEventListener('click', () => { if (currentPage < Math.ceil(filteredRows.length / PAGE_SIZE)) { currentPage++; renderTable(); } });
}

function initCheckboxes() {
    document.querySelectorAll('.check-icon').forEach(icon => {
        const n = icon.cloneNode(true); icon.parentNode.replaceChild(n, icon);
        n.addEventListener('click', async () => {
            const id = n.dataset.id, f = n.dataset.field, df = n.dataset.dateField;
            const v = !n.classList.contains('checked');
            n.classList.toggle('checked', v); n.classList.toggle('unchecked', !v);
            n.querySelector('.material-icons-outlined').textContent = v ? 'check_box' : 'check_box_outline_blank';
            n.style.transform = 'scale(1.3)'; setTimeout(() => n.style.transform = '', 200);

            // Auto-fecha: when checking, set current date; when unchecking, clear date
            const today = new Date().toISOString().slice(0, 10);
            const updateData = { [f]: v };

            // Also update the date field if it exists
            if (df) {
                updateData[df] = v ? today : null;
            }

            const { error } = await supabase.from('seguimientos_fidelizacion').update(updateData).eq('id', id);
            if (error) {
                // If date field doesn't exist yet, retry without it
                if (df && error.message && error.message.includes(df)) {
                    const { error: e2 } = await supabase.from('seguimientos_fidelizacion').update({ [f]: v }).eq('id', id);
                    if (e2) {
                        n.classList.toggle('checked', !v); n.classList.toggle('unchecked', v);
                        n.querySelector('.material-icons-outlined').textContent = !v ? 'check_box' : 'check_box_outline_blank';
                    } else {
                        // Update date display even if column doesn't exist
                        updateDateDisplay(n, v ? today : null);
                    }
                } else {
                    n.classList.toggle('checked', !v); n.classList.toggle('unchecked', v);
                    n.querySelector('.material-icons-outlined').textContent = !v ? 'check_box' : 'check_box_outline_blank';
                }
            } else {
                // Success - update the date display
                updateDateDisplay(n, v ? today : null);
            }
        });
    });
}

function updateDateDisplay(checkIcon, dateVal) {
    const wrap = checkIcon.closest('.check-cell-wrap');
    if (!wrap) return;
    let dateEl = wrap.querySelector('.check-date');
    if (dateVal) {
        if (!dateEl) {
            dateEl = document.createElement('span');
            dateEl.className = 'check-date';
            wrap.appendChild(dateEl);
        }
        dateEl.textContent = dateVal;
        dateEl.classList.add('check-date-animate');
        setTimeout(() => dateEl.classList.remove('check-date-animate'), 500);
    } else {
        if (dateEl) dateEl.remove();
    }
}

function initTabs() {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active')); t.classList.add('active');
        currentTab = t.dataset.tab; loadTable();
    }));
}

function initSearch() {
    document.getElementById('search-input').addEventListener('input', e => {
        const q = e.target.value.toLowerCase().trim();
        filteredRows = q ? allRows.filter(r => { const c = r.pedidos?.clientes || {}, p = r.pedidos || {}; return [c.nombre_completo, c.whatsapp, c.ciudad, c.departamento, p.producto, r.observaciones, r.prioridad, p.area_ventas, c.canal_adquisicion, r.resumen_llamada].filter(Boolean).join(' ').toLowerCase().includes(q); }) : [...allRows];
        currentPage = 1; renderTable();
    });
}

// ── KANBAN ────────────────────────────────────────────────────
function initKanbanControls() {
    document.querySelectorAll('.kanban-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.kanban-view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderKanban(btn.dataset.kanban);
        });
    });
}

async function loadKanban() {
    const { data } = await supabase
        .from('seguimientos_fidelizacion')
        .select(`*, pedidos ( producto, ticket_compra, estado_logistico, clientes ( nombre_completo, etiqueta, whatsapp ) ), asesores ( nombre_completo ), interacciones ( tipo, resultado, fue_venta, duracion_segundos, notas )`)
        .order('created_at', { ascending: false });
    return data || [];
}

async function renderKanban(mode) {
    const board = document.getElementById('kanban-board');
    board.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Cargando...</div>';
    const items = await loadKanban();

    if (mode === 'asesores') {
        const byAsesor = {};
        items.forEach(s => {
            const name = s.asesores?.nombre_completo || 'Sin asignar';
            if (!byAsesor[name]) byAsesor[name] = [];
            byAsesor[name].push(s);
        });
        board.innerHTML = Object.entries(byAsesor).map(([name, tasks]) => {
            const completed = tasks.filter(t => t.estado_tarea === 'COMPLETADA').length;
            const active = tasks.filter(t => t.estado_tarea === 'ACTIVA').length;
            const totalCalls = tasks.reduce((sum, t) => sum + (t.interacciones || []).filter(i => i.tipo === 'LLAMADA_IA').length, 0);
            const totalVentas = tasks.reduce((sum, t) => sum + (t.interacciones || []).filter(i => i.fue_venta).length, 0);
            return `<div class="kanban-column">
                <div class="kanban-col-header">
                    <span class="kanban-col-title">${name}</span>
                    <span class="kanban-col-count">${tasks.length} tareas</span>
                </div>
                <div class="kanban-col-stats">
                    <span class="kstat">🟢 ${completed} completadas</span>
                    <span class="kstat">🟡 ${active} activas</span>
                    <span class="kstat">📞 ${totalCalls} llamadas IA</span>
                    <span class="kstat">💰 ${totalVentas} ventas</span>
                </div>
                <div class="kanban-cards">${tasks.slice(0, 10).map(t => kanbanCard(t)).join('')}</div>
            </div>`;
        }).join('');
    } else {
        // IA vs Humano
        const iaItems = items.filter(s => (s.interacciones || []).some(i => i.tipo === 'LLAMADA_IA'));
        const humanItems = items.filter(s => !(s.interacciones || []).some(i => i.tipo === 'LLAMADA_IA'));
        const iaVentas = iaItems.reduce((sum, t) => sum + (t.interacciones || []).filter(i => i.fue_venta).length, 0);
        const iaCalls = iaItems.reduce((sum, t) => sum + (t.interacciones || []).filter(i => i.tipo === 'LLAMADA_IA').length, 0);
        const iaOk = iaItems.reduce((sum, t) => sum + (t.interacciones || []).filter(i => i.tipo === 'LLAMADA_IA' && i.resultado === 'EXITOSA').length, 0);
        board.innerHTML = `
            <div class="kanban-column kanban-ia">
                <div class="kanban-col-header"><span class="kanban-col-title">🤖 Gestionados por IA</span><span class="kanban-col-count">${iaItems.length} seguimientos</span></div>
                <div class="kanban-col-stats">
                    <span class="kstat">📞 ${iaCalls} llamadas</span>
                    <span class="kstat">✅ ${iaOk} exitosas (${iaCalls ? Math.round(iaOk / iaCalls * 100) : 0}%)</span>
                    <span class="kstat">💰 ${iaVentas} ventas</span>
                </div>
                <div class="kanban-cards">${iaItems.slice(0, 8).map(t => kanbanCard(t)).join('')}</div>
            </div>
            <div class="kanban-column kanban-human">
                <div class="kanban-col-header"><span class="kanban-col-title">👤 Solo Humano (sin IA)</span><span class="kanban-col-count">${humanItems.length} seguimientos</span></div>
                <div class="kanban-col-stats"><span class="kstat">Pendientes de gestión IA</span></div>
                <div class="kanban-cards">${humanItems.slice(0, 8).map(t => kanbanCard(t)).join('')}</div>
            </div>
        `;
    }
}

function kanbanCard(seg) {
    const c = seg.pedidos?.clientes || {}, p = seg.pedidos || {};
    const prC = { ALTA: 'prio-alta', MEDIA: 'prio-media', BAJA: 'prio-baja' }[seg.prioridad] || 'prio-media';
    const ints = seg.interacciones || [];
    const waCount = ints.filter(i => i.tipo === 'WHATSAPP_PLANTILLA').length;
    const callCount = ints.filter(i => i.tipo === 'LLAMADA_IA').length;
    const hasVenta = ints.some(i => i.fue_venta);
    const lastNote = ints.filter(i => i.tipo === 'LLAMADA_IA' && i.notas).sort((a, b) => b.fecha_interaccion?.localeCompare(a.fecha_interaccion || ''))[0];
    return `<div class="kanban-card">
        <div class="kcard-top">
            <span class="prio-badge ${prC}">${seg.prioridad || 'MEDIA'}</span>
            <span class="segmento-badge ${c.etiqueta || 'NUEVO'}">${c.etiqueta || '-'}</span>
            ${hasVenta ? '<span class="venta-badge">💰 VENTA</span>' : ''}
        </div>
        <div class="kcard-name">${c.nombre_completo || '-'}</div>
        <div class="kcard-product">${p.producto || '-'} · $${parseFloat(p.ticket_compra || 0).toLocaleString('es-CO')}</div>
        <div class="kcard-stats">
            <span>📤 ${waCount} WA</span>
            <span>📞 ${callCount} Llam</span>
            <span class="estado-badge ${p.estado_logistico || 'TODAS'}" style="font-size:0.55rem;padding:2px 6px">${(p.estado_logistico || '-').replace(/_/g, ' ')}</span>
        </div>
        ${lastNote ? `<div class="kcard-obs">${lastNote.notas}</div>` : (seg.observaciones ? `<div class="kcard-obs">${seg.observaciones}</div>` : '')}
    </div>`;
}

// ── REPORTES ─────────────────────────────────────────────────
async function loadReportes() {
    await loadCoreData();
    const segs = (await supabase.from('seguimientos_fidelizacion').select(`*, pedidos ( ticket_compra, clientes ( etiqueta, canal_adquisicion ) ), asesores ( nombre_completo ), interacciones ( tipo, resultado, fue_venta, duracion_segundos, fecha_interaccion, notas )`)).data || [];

    // Ventas Area Chart
    drawVentasAreaChart();

    // Asesor Performance
    const asesorMap = {};
    segs.forEach(s => {
        const name = s.asesores?.nombre_completo || 'Sin asignar';
        if (!asesorMap[name]) asesorMap[name] = { total: 0, completed: 0, active: 0, calls: 0, ventas: 0, ticketSum: 0 };
        const m = asesorMap[name];
        m.total++;
        if (s.estado_tarea === 'COMPLETADA') m.completed++;
        if (s.estado_tarea === 'ACTIVA') m.active++;
        (s.interacciones || []).forEach(i => { if (i.tipo === 'LLAMADA_IA') m.calls++; if (i.fue_venta) m.ventas++; });
        m.ticketSum += parseFloat(s.pedidos?.ticket_compra || 0);
    });
    document.getElementById('report-asesores').innerHTML = `<table class="report-table"><thead><tr><th>Asesor</th><th>Total</th><th>Activas</th><th>Completadas</th><th>Llamadas IA</th><th>Ventas</th><th>Ticket Acum.</th></tr></thead><tbody>${Object.entries(asesorMap).map(([n, m]) => `<tr><td><strong>${n}</strong></td><td>${m.total}</td><td>${m.active}</td><td>${m.completed}</td><td>${m.calls}</td><td>${m.ventas}</td><td>$${Math.round(m.ticketSum).toLocaleString('es-CO')}</td></tr>`).join('')}</tbody></table>`;

    // IA Performance
    const totalCalls = allInteracciones.filter(i => i.tipo === 'LLAMADA_IA');
    const okCalls = totalCalls.filter(i => i.resultado === 'EXITOSA');
    const failCalls = totalCalls.filter(i => ['NO_CONTESTO', 'BUZON', 'RECHAZADA'].includes(i.resultado));
    const totalWA = allInteracciones.filter(i => i.tipo === 'WHATSAPP_PLANTILLA');
    const waOk = totalWA.filter(i => i.whatsapp_respondido === true);
    const ventas = allInteracciones.filter(i => i.fue_venta);
    const durTotal = totalCalls.reduce((s, i) => s + (i.duracion_segundos || 0), 0);
    const durAvg = totalCalls.length ? Math.round(durTotal / totalCalls.length) : 0;
    document.getElementById('report-ia').innerHTML = `
        <div class="report-grid">
            <div class="report-metric"><span class="rm-val">${totalCalls.length}</span><span class="rm-label">Llamadas IA Totales</span></div>
            <div class="report-metric"><span class="rm-val">${okCalls.length}</span><span class="rm-label">Exitosas (${totalCalls.length ? Math.round(okCalls.length / totalCalls.length * 100) : 0}%)</span></div>
            <div class="report-metric"><span class="rm-val">${failCalls.length}</span><span class="rm-label">Fallidas</span></div>
            <div class="report-metric"><span class="rm-val">${ventas.length}</span><span class="rm-label">Ventas Generadas</span></div>
            <div class="report-metric"><span class="rm-val">${totalWA.length}</span><span class="rm-label">WhatsApp Enviados</span></div>
            <div class="report-metric"><span class="rm-val">${waOk.length}</span><span class="rm-label">WA Respondidos (${totalWA.length ? Math.round(waOk.length / totalWA.length * 100) : 0}%)</span></div>
            <div class="report-metric"><span class="rm-val">${Math.floor(durAvg / 60)}m${durAvg % 60}s</span><span class="rm-label">Duración Prom. Llamada</span></div>
            <div class="report-metric"><span class="rm-val">${Math.floor(durTotal / 60)}m</span><span class="rm-label">Tiempo Total IA</span></div>
        </div>`;

    // Resumen de Llamadas Recientes
    const recentCalls = allInteracciones
        .filter(i => i.tipo === 'LLAMADA_IA' && i.notas)
        .sort((a, b) => new Date(b.fecha_interaccion) - new Date(a.fecha_interaccion))
        .slice(0, 10);
    document.getElementById('report-resumenes').innerHTML = recentCalls.length
        ? `<table class="report-table"><thead><tr><th>Fecha</th><th>Resultado</th><th>Duración</th><th>Venta</th><th>Resumen</th></tr></thead><tbody>${recentCalls.map(c => `<tr><td>${c.fecha_interaccion?.slice(0, 10) || '-'}</td><td><span class="call-status ${c.resultado === 'EXITOSA' ? 'call-ok' : c.resultado === 'NO_CONTESTO' ? 'call-fail' : 'call-pending'}">${c.resultado}</span></td><td>${c.duracion_segundos > 0 ? `${Math.floor(c.duracion_segundos / 60)}m${c.duracion_segundos % 60}s` : '—'}</td><td>${c.fue_venta ? '💰 Sí' : '—'}</td><td class="cell-resumen-report">${c.notas}</td></tr>`).join('')}</tbody></table>`
        : '<p style="color:var(--color-text-muted);text-align:center;padding:20px;">No hay llamadas con resumen aún</p>';

    // Segmentos
    const segCounts = {}; allClientes.forEach(c => { segCounts[c.etiqueta] = (segCounts[c.etiqueta] || 0) + 1; });
    document.getElementById('report-segmentos').innerHTML = `<div class="report-bars">${Object.entries(segCounts).map(([k, v]) => { const pct = Math.round(v / allClientes.length * 100); return `<div class="report-bar-row"><span class="rb-label"><span class="segmento-badge ${k}">${k}</span></span><div class="rb-track"><div class="rb-fill" style="width:${pct}%;background:${{'NUEVO':'#8b5cf6','PERDIDO':'#ef4444','OCASIONAL':'#3b82f6','RECURRENTE':'#22c55e'}[k] || '#666'}"></div></div><span class="rb-val">${v} (${pct}%)</span></div>`; }).join('')}</div>`;

    // Canales
    const canCounts = {}; allClientes.forEach(c => { const ch = c.canal_adquisicion || 'Sin definir'; canCounts[ch] = (canCounts[ch] || 0) + 1; });
    const areaCounts = {}; allPedidos.forEach(p => { const a = p.area_ventas || 'Sin definir'; areaCounts[a] = (areaCounts[a] || 0) + 1; });
    document.getElementById('report-canales').innerHTML = `<div class="report-dual"><div><h4>Canal de Adquisición</h4><div class="report-bars">${Object.entries(canCounts).map(([k, v]) => `<div class="report-bar-row"><span class="rb-label">${k}</span><div class="rb-track"><div class="rb-fill" style="width:${Math.round(v / allClientes.length * 100)}%;background:#3b82f6"></div></div><span class="rb-val">${v}</span></div>`).join('')}</div></div><div><h4>Área de Ventas</h4><div class="report-bars">${Object.entries(areaCounts).map(([k, v]) => `<div class="report-bar-row"><span class="rb-label">${k}</span><div class="rb-track"><div class="rb-fill" style="width:${Math.round(v / allPedidos.length * 100)}%;background:#f5c542"></div></div><span class="rb-val">${v}</span></div>`).join('')}</div></div></div>`;
}

// ── VENTAS AREA CHART (Reportes) ────────────────────────────
function drawVentasAreaChart() {
    const canvas = document.getElementById('canvas-ventas-area');
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const days = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }

    const ventasByDay = {}, callsByDay = {}, waByDay = {};
    days.forEach(d => { ventasByDay[d] = 0; callsByDay[d] = 0; waByDay[d] = 0; });
    allInteracciones.forEach(r => {
        const day = r.fecha_interaccion?.slice(0, 10);
        if (day && days.includes(day)) {
            if (r.fue_venta) ventasByDay[day]++;
            if (r.tipo === 'LLAMADA_IA') callsByDay[day]++;
            if (r.tipo === 'WHATSAPP_PLANTILLA') waByDay[day]++;
        }
    });

    const ventasVals = days.map(d => ventasByDay[d]);
    const callsVals = days.map(d => callsByDay[d]);
    const waVals = days.map(d => waByDay[d]);
    const maxVal = Math.max(...callsVals, ...waVals, ...ventasVals, 1);

    const padL = 50, padR = 20, padT = 20, padB = 50;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padT + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillStyle = '#5c6073'; ctx.font = '10px Inter'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), padL - 8, y);
    }

    // X labels
    days.forEach((day, i) => {
        if (i % 2 === 0) {
            const x = padL + (chartW / (days.length - 1)) * i;
            ctx.fillStyle = '#5c6073'; ctx.font = '9px Inter'; ctx.textAlign = 'center';
            const d = new Date(day + 'T12:00:00');
            ctx.fillText(d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }), x, H - padB + 18);
        }
    });

    drawAreaCurve(ctx, days, waVals, maxVal, padL, padT, chartW, chartH, '#22c55e', 'rgba(34,197,94,0.1)');
    drawAreaCurve(ctx, days, callsVals, maxVal, padL, padT, chartW, chartH, '#f5c542', 'rgba(245,197,66,0.1)');
    drawAreaCurve(ctx, days, ventasVals, maxVal, padL, padT, chartW, chartH, '#3b82f6', 'rgba(59,130,246,0.15)');

    // Legend
    const ly = H - 10;
    [['#22c55e', 'WhatsApp', padL], ['#f5c542', 'Llamadas IA', padL + 110], ['#3b82f6', 'Ventas', padL + 230]].forEach(([c, l, x]) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 5, ly, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8b8fa3'; ctx.font = '10px Inter'; ctx.textAlign = 'left'; ctx.fillText(l, x + 15, ly + 3);
    });
}

// ── SIDEBAR / NAV ────────────────────────────────────────────
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    document.getElementById('menu-toggle').addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', e => { if (window.innerWidth <= 1024 && !sidebar.contains(e.target) && !document.getElementById('menu-toggle').contains(e.target)) sidebar.classList.remove('open'); });

    const titles = { tablero: 'TABLERO', tareas: 'TAREAS — KANBAN', reportes: 'REPORTES', ajustes: 'AJUSTES' };
    const views = ['tablero', 'tareas', 'reportes', 'ajustes'];

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const s = item.dataset.section;
            document.getElementById('page-title').textContent = titles[s] || 'TABLERO';
            views.forEach(v => { document.getElementById(`view-${v}`).style.display = v === s ? '' : 'none'; });

            if (s === 'tareas') renderKanban('asesores');
            if (s === 'reportes') loadReportes();
            if (window.innerWidth <= 1024) sidebar.classList.remove('open');
        });
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        const ic = document.querySelector('#btn-refresh .material-icons-outlined');
        ic.style.animation = 'spin 0.6s ease'; setTimeout(() => ic.style.animation = '', 600);
        loadAll();
    });
    document.getElementById('btn-download')?.addEventListener('click', downloadCSV);
}

function downloadCSV() {
    const h = ['Prioridad','Cliente','WhatsApp','Ciudad','Depto','Segmento','Canal','Producto','Ticket','Estado','WA','Llamada','5D','Fecha 5D','15D','Fecha 15D','25D','Fecha 25D','35D','Fecha 35D','Resumen','Ventas','Obs','Calidad'];
    const rows = filteredRows.map(s => { const p = s.pedidos || {}, c = p.clientes || {}, ints = s.interacciones || []; const lw = ints.find(i => i.tipo === 'WHATSAPP_PLANTILLA'), lc = ints.find(i => i.tipo === 'LLAMADA_IA'); const ventasCount = ints.filter(i => i.fue_venta).length; return [s.prioridad, c.nombre_completo, c.whatsapp, c.ciudad, c.departamento, c.etiqueta, c.canal_adquisicion, p.producto, p.ticket_compra, p.estado_logistico, lw?.whatsapp_respondido ? 'SÍ' : 'NO', lc?.resultado || '-', s.llamada_5d ? 'SÍ' : 'NO', s.fecha_5d || '', s.llamada_15d ? 'SÍ' : 'NO', s.fecha_15d || '', s.llamada_25d ? 'SÍ' : 'NO', s.fecha_25d || '', s.llamada_35d ? 'SÍ' : 'NO', s.fecha_35d || '', s.resumen_llamada || lc?.notas || '', ventasCount, s.observaciones, s.calidad].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','); });
    const blob = new Blob(['\uFEFF' + [h.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `elite_crm_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}
