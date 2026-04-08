// ============================================================
// ELITE NUTRITION — CRM Fidelización
// Equipo de fidelización: seguimiento, recompras, Kanban, Reportes
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initTabs();
    initSearch();
    initFilters();
    initPagination();
    initKanbanControls();
    loadAll();
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
    document.getElementById('kpi-val-exito').textContent = calls.length ? Math.round((okCalls.length / calls.length) * 100) + '%' : '0%';
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

// ── CHARTS ───────────────────────────────────────────────────
function loadCharts() { drawSegmentacionChart(); drawInteraccionesChart(); }

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

function drawInteraccionesChart() {
    const canvas = document.getElementById('canvas-interacciones');
    if (!canvas) return;
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
    const wa = {}, ca = {}; days.forEach(d => { wa[d] = 0; ca[d] = 0; });
    allInteracciones.forEach(r => {
        const day = r.fecha_interaccion?.slice(0, 10);
        if (day && days.includes(day)) { if (r.tipo === 'WHATSAPP_PLANTILLA') wa[day]++; else if (r.tipo === 'LLAMADA_IA') ca[day]++; }
    });
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 520, 260);
    const mx = Math.max(...days.map(d => Math.max(wa[d], ca[d])), 1);
    days.forEach((day, i) => {
        const x = 30 + i * 68;
        const h1 = (wa[day] / mx) * 180, h2 = (ca[day] / mx) * 180;
        roundBar(ctx, x, 25 + 180 - h1, 24, h1, '#22c55e');
        roundBar(ctx, x + 32, 25 + 180 - h2, 24, h2, '#f5c542');
        ctx.fillStyle = '#e8eaf0'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center';
        if (wa[day]) ctx.fillText(wa[day], x + 12, 25 + 180 - h1 - 6);
        if (ca[day]) ctx.fillText(ca[day], x + 44, 25 + 180 - h2 - 6);
        ctx.fillStyle = '#5c6073'; ctx.font = '9px Inter'; ctx.fillText(day.slice(5), x + 28, 222);
    });
    ctx.fillStyle = '#22c55e'; ctx.fillRect(30, 240, 10, 10); ctx.fillStyle = '#8b8fa3'; ctx.font = '10px Inter'; ctx.textAlign = 'left'; ctx.fillText('WhatsApp', 44, 249);
    ctx.fillStyle = '#f5c542'; ctx.fillRect(120, 240, 10, 10); ctx.fillStyle = '#8b8fa3'; ctx.fillText('Llamada IA', 134, 249);
}
function roundBar(ctx, x, y, w, h, c) {
    if (h < 1) return; const r = Math.min(4, h / 2);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y + r); ctx.arcTo(x, y, x + w, y, r); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
}

// ── TABLE ────────────────────────────────────────────────────
async function loadTable() {
    const { data, error } = await supabase
        .from('seguimientos_fidelizacion')
        .select(`*, pedidos ( id, producto, ticket_compra, area_ventas, estado_logistico, clientes ( id, nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion ) ), asesores ( id, nombre_completo ), interacciones ( id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, duracion_segundos, fecha_interaccion )`)
        .eq('estado_tarea', currentTab)
        .order('created_at', { ascending: false });
    if (error) { console.error(error); allRows = []; }
    else { const po = { ALTA: 0, MEDIA: 1, BAJA: 2 }; allRows = (data || []).sort((a, b) => (po[a.prioridad] || 1) - (po[b.prioridad] || 1)); }
    applyFilters();
}

function initFilters() {
    document.getElementById('btn-filter-apply').addEventListener('click', applyFilters);
    document.getElementById('btn-filter-clear').addEventListener('click', () => {
        document.getElementById('filter-prioridad').value = '';
        document.getElementById('filter-segmento').value = '';
        document.getElementById('filter-logistico').value = '';
        document.getElementById('filter-canal').value = '';
        applyFilters();
    });
}

function applyFilters() {
    const pr = document.getElementById('filter-prioridad').value;
    const seg = document.getElementById('filter-segmento').value;
    const log = document.getElementById('filter-logistico').value;
    const can = document.getElementById('filter-canal').value.toLowerCase().trim();
    filteredRows = allRows.filter(r => {
        const c = r.pedidos?.clientes || {}, p = r.pedidos || {};
        if (pr && r.prioridad !== pr) return false;
        if (seg && c.etiqueta !== seg) return false;
        if (log && p.estado_logistico !== log) return false;
        if (can && !(c.canal_adquisicion || '').toLowerCase().includes(can) && !(p.area_ventas || '').toLowerCase().includes(can)) return false;
        return true;
    });
    currentPage = 1; renderTable();
}

function renderTable() {
    const tbody = document.getElementById('table-body'); tbody.innerHTML = '';
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filteredRows.slice(start, start + PAGE_SIZE);
    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="14" style="text-align:center;padding:40px;color:var(--color-text-muted);"><span class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:8px">inbox</span>No hay registros</td></tr>`;
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
        const hv = ints.some(i => i.fue_venta);
        tr.innerHTML = `
            <td><span class="prio-badge ${prC}">${prI} ${seg.prioridad || 'MEDIA'}</span></td>
            <td class="cell-cliente"><span class="client-name">${c.nombre_completo || '-'}</span><span class="client-location">${c.ciudad || ''}${c.ciudad && c.departamento ? ', ' : ''}${c.departamento || ''}</span></td>
            <td class="cell-whatsapp"><a href="https://wa.me/${(c.whatsapp || '').replace('+', '')}" target="_blank">${c.whatsapp || '-'}</a></td>
            <td><span class="segmento-badge ${c.etiqueta || 'NUEVO'}">${c.etiqueta || '-'}</span></td>
            <td><span class="product-badge">${(p.producto || '-').toUpperCase()}</span><br><span class="cell-ticket">$${parseFloat(p.ticket_compra || 0).toLocaleString('es-CO')}</span>${hv ? '<br><span class="venta-badge">💰 VENTA</span>' : ''}</td>
            <td><span class="estado-badge ${p.estado_logistico || 'TODAS'}">${(p.estado_logistico || '-').replace(/_/g, ' ')}</span></td>
            <td>${waH}</td><td>${caH}</td>
            <td class="cell-check">${chk(seg, 'llamada_5d')}</td><td class="cell-check">${chk(seg, 'llamada_15d')}</td><td class="cell-check">${chk(seg, 'llamada_25d')}</td><td class="cell-check">${chk(seg, 'llamada_35d')}</td>
            <td class="cell-obs"><em>${seg.observaciones || '-'}</em></td>
            <td><span class="calidad-badge ${seg.calidad || 'BUENO'}"><span class="calidad-dot"></span> ${seg.calidad || '-'}</span></td>
        `;
        tbody.appendChild(tr);
    });
    initCheckboxes(); updFooter(filteredRows.length);
}

function chk(seg, field) {
    return `<span class="check-icon ${seg[field] ? 'checked' : 'unchecked'}" data-field="${field}" data-id="${seg.id}"><span class="material-icons-outlined">${seg[field] ? 'check_box' : 'check_box_outline_blank'}</span></span>`;
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
            const id = n.dataset.id, f = n.dataset.field, v = !n.classList.contains('checked');
            n.classList.toggle('checked', v); n.classList.toggle('unchecked', !v);
            n.querySelector('.material-icons-outlined').textContent = v ? 'check_box' : 'check_box_outline_blank';
            n.style.transform = 'scale(1.3)'; setTimeout(() => n.style.transform = '', 200);
            const { error } = await supabase.from('seguimientos_fidelizacion').update({ [f]: v }).eq('id', id);
            if (error) { n.classList.toggle('checked', !v); n.classList.toggle('unchecked', v); n.querySelector('.material-icons-outlined').textContent = !v ? 'check_box' : 'check_box_outline_blank'; }
        });
    });
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
        filteredRows = q ? allRows.filter(r => { const c = r.pedidos?.clientes || {}, p = r.pedidos || {}; return [c.nombre_completo, c.whatsapp, c.ciudad, c.departamento, p.producto, r.observaciones, r.prioridad, p.area_ventas, c.canal_adquisicion].filter(Boolean).join(' ').toLowerCase().includes(q); }) : [...allRows];
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
        .select(`*, pedidos ( producto, ticket_compra, estado_logistico, clientes ( nombre_completo, etiqueta, whatsapp ) ), asesores ( nombre_completo ), interacciones ( tipo, resultado, fue_venta, duracion_segundos )`)
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
        ${seg.observaciones ? `<div class="kcard-obs">${seg.observaciones}</div>` : ''}
    </div>`;
}

// ── REPORTES ─────────────────────────────────────────────────
async function loadReportes() {
    await loadCoreData();
    const segs = (await supabase.from('seguimientos_fidelizacion').select(`*, pedidos ( ticket_compra, clientes ( etiqueta, canal_adquisicion ) ), asesores ( nombre_completo ), interacciones ( tipo, resultado, fue_venta, duracion_segundos )`)).data || [];

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

    // Segmentos
    const segCounts = {}; allClientes.forEach(c => { segCounts[c.etiqueta] = (segCounts[c.etiqueta] || 0) + 1; });
    document.getElementById('report-segmentos').innerHTML = `<div class="report-bars">${Object.entries(segCounts).map(([k, v]) => { const pct = Math.round(v / allClientes.length * 100); return `<div class="report-bar-row"><span class="rb-label"><span class="segmento-badge ${k}">${k}</span></span><div class="rb-track"><div class="rb-fill" style="width:${pct}%;background:${{'NUEVO':'#8b5cf6','PERDIDO':'#ef4444','OCASIONAL':'#3b82f6','RECURRENTE':'#22c55e'}[k] || '#666'}"></div></div><span class="rb-val">${v} (${pct}%)</span></div>`; }).join('')}</div>`;

    // Canales
    const canCounts = {}; allClientes.forEach(c => { const ch = c.canal_adquisicion || 'Sin definir'; canCounts[ch] = (canCounts[ch] || 0) + 1; });
    const areaCounts = {}; allPedidos.forEach(p => { const a = p.area_ventas || 'Sin definir'; areaCounts[a] = (areaCounts[a] || 0) + 1; });
    document.getElementById('report-canales').innerHTML = `<div class="report-dual"><div><h4>Canal de Adquisición</h4><div class="report-bars">${Object.entries(canCounts).map(([k, v]) => `<div class="report-bar-row"><span class="rb-label">${k}</span><div class="rb-track"><div class="rb-fill" style="width:${Math.round(v / allClientes.length * 100)}%;background:#3b82f6"></div></div><span class="rb-val">${v}</span></div>`).join('')}</div></div><div><h4>Área de Ventas</h4><div class="report-bars">${Object.entries(areaCounts).map(([k, v]) => `<div class="report-bar-row"><span class="rb-label">${k}</span><div class="rb-track"><div class="rb-fill" style="width:${Math.round(v / allPedidos.length * 100)}%;background:#f5c542"></div></div><span class="rb-val">${v}</span></div>`).join('')}</div></div></div>`;
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
    const h = ['Prioridad','Cliente','WhatsApp','Ciudad','Depto','Segmento','Canal','Producto','Ticket','Estado','WA','Llamada','5D','15D','25D','35D','Obs','Calidad'];
    const rows = filteredRows.map(s => { const p = s.pedidos || {}, c = p.clientes || {}, ints = s.interacciones || []; const lw = ints.find(i => i.tipo === 'WHATSAPP_PLANTILLA'), lc = ints.find(i => i.tipo === 'LLAMADA_IA'); return [s.prioridad, c.nombre_completo, c.whatsapp, c.ciudad, c.departamento, c.etiqueta, c.canal_adquisicion, p.producto, p.ticket_compra, p.estado_logistico, lw?.whatsapp_respondido ? 'SÍ' : 'NO', lc?.resultado || '-', s.llamada_5d ? 'SÍ' : 'NO', s.llamada_15d ? 'SÍ' : 'NO', s.llamada_25d ? 'SÍ' : 'NO', s.llamada_35d ? 'SÍ' : 'NO', s.observaciones, s.calidad].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','); });
    const blob = new Blob(['\uFEFF' + [h.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `elite_crm_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}
