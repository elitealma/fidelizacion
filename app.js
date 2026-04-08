// ============================================================
// ELITE NUTRITION - CRM Fidelización + Interacciones IA
// Supabase: FACTURACION AUTOMATICA (rqucbsuafirnohhogdry)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initTabs();
    initSearch();
    initFilters();
    initPagination();
    loadAll();
});

// ============================================================
// STATE
// ============================================================
let currentTab = 'ACTIVA';
let allRows = [];
let filteredRows = [];
let currentPage = 1;
const PAGE_SIZE = 15;

async function loadAll() {
    await Promise.all([loadKPIs(), loadInteractionStats(), loadCharts(), loadTable()]);
    loadSidebarStats();
}

// ============================================================
// KPIs
// ============================================================
async function loadKPIs() {
    try {
        const { count: totalClientes } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
        const { data: ticketData } = await supabase.from('pedidos').select('ticket_compra');
        let ticketPromedio = 0;
        if (ticketData && ticketData.length > 0) {
            ticketPromedio = Math.round(ticketData.reduce((a, p) => a + parseFloat(p.ticket_compra || 0), 0) / ticketData.length);
        }

        // Llamadas IA totales
        const { count: totalLlamadas } = await supabase.from('interacciones').select('*', { count: 'exact', head: true }).eq('tipo', 'LLAMADA_IA');
        // Llamadas IA exitosas
        const { count: llamadasExitosas } = await supabase.from('interacciones').select('*', { count: 'exact', head: true }).eq('tipo', 'LLAMADA_IA').eq('resultado', 'EXITOSA');
        const tasaExito = totalLlamadas > 0 ? Math.round((llamadasExitosas / totalLlamadas) * 100) : 0;

        document.getElementById('kpi-val-clientes').textContent = (totalClientes || 0).toLocaleString('es-CO');
        document.getElementById('kpi-val-ticket').textContent = '$' + (ticketPromedio || 0).toLocaleString('es-CO');
        document.getElementById('kpi-val-llamadas').textContent = totalLlamadas || 0;
        document.getElementById('kpi-sub-llamadas').textContent = `${llamadasExitosas || 0} exitosas`;
        document.getElementById('kpi-val-retencion').textContent = tasaExito + '%';
    } catch (err) { console.error('Error KPIs:', err); }
}

// ============================================================
// INTERACTION STATS
// ============================================================
async function loadInteractionStats() {
    try {
        const { data: all } = await supabase.from('interacciones').select('tipo, resultado, fue_venta, whatsapp_respondido');
        if (!all) return;

        const waSent = all.filter(i => i.tipo === 'WHATSAPP_PLANTILLA').length;
        const waResponded = all.filter(i => i.tipo === 'WHATSAPP_PLANTILLA' && i.whatsapp_respondido === true).length;
        const calls = all.filter(i => i.tipo === 'LLAMADA_IA').length;
        const callsOk = all.filter(i => i.tipo === 'LLAMADA_IA' && i.resultado === 'EXITOSA').length;
        const ventas = all.filter(i => i.fue_venta === true).length;
        const ventasPct = calls > 0 ? Math.round((ventas / calls) * 100) : 0;
        const pendingWa = all.filter(i => i.tipo === 'WHATSAPP_PLANTILLA' && (i.resultado === 'PENDIENTE' || i.whatsapp_respondido === false)).length;
        const pendingCalls = all.filter(i => i.tipo === 'LLAMADA_IA' && ['NO_CONTESTO', 'BUZON'].includes(i.resultado)).length;

        document.getElementById('istat-wa-sent').textContent = waSent;
        document.getElementById('istat-wa-responded').textContent = `${waResponded} respondidos`;
        document.getElementById('istat-calls-total').textContent = calls;
        document.getElementById('istat-calls-ok').textContent = `${callsOk} exitosas`;
        document.getElementById('istat-ventas').textContent = ventas;
        document.getElementById('istat-ventas-pct').textContent = `${ventasPct}% conversión`;
        document.getElementById('istat-pending').textContent = pendingWa + pendingCalls;
        document.getElementById('istat-pending-wa').textContent = `${pendingWa} WA + ${pendingCalls} Llamadas`;
    } catch (err) { console.error('Error stats:', err); }
}

async function loadSidebarStats() {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const { count: callsToday } = await supabase.from('interacciones').select('*', { count: 'exact', head: true }).eq('tipo', 'LLAMADA_IA').gte('fecha_interaccion', today);
        const { count: waToday } = await supabase.from('interacciones').select('*', { count: 'exact', head: true }).eq('tipo', 'WHATSAPP_PLANTILLA').gte('fecha_interaccion', today);
        document.getElementById('sidebar-calls-today').textContent = callsToday || 0;
        document.getElementById('sidebar-wa-today').textContent = waToday || 0;
    } catch (err) { console.error('Error sidebar:', err); }
}

// ============================================================
// CHARTS
// ============================================================
async function loadCharts() {
    await drawSegmentacionChart();
    await drawInteraccionesChart();
}

async function drawSegmentacionChart() {
    const { data } = await supabase.from('clientes').select('etiqueta');
    const canvas = document.getElementById('canvas-segmentacion');
    if (!canvas || !data) return;
    const counts = { NUEVO: 0, PERDIDO: 0, OCASIONAL: 0, RECURRENTE: 0 };
    data.forEach(c => { if (counts.hasOwnProperty(c.etiqueta)) counts[c.etiqueta]++; });
    const total = data.length || 1;
    const segments = [
        { label: 'Nuevo', value: counts.NUEVO, color: '#8b5cf6' },
        { label: 'Perdido', value: counts.PERDIDO, color: '#ef4444' },
        { label: 'Ocasional', value: counts.OCASIONAL, color: '#3b82f6' },
        { label: 'Recurrente', value: counts.RECURRENTE, color: '#22c55e' },
    ];
    const ctx = canvas.getContext('2d');
    const cx = 140, cy = 140, oR = 110, iR = 65;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let startAngle = -Math.PI / 2;
    segments.forEach(seg => {
        const sliceAngle = (seg.value / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, oR, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, iR, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        startAngle += sliceAngle;
    });
    ctx.fillStyle = '#e8eaf0'; ctx.font = 'bold 28px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(total.toString(), cx, cy - 8);
    ctx.fillStyle = '#8b8fa3'; ctx.font = '11px Inter'; ctx.fillText('CLIENTES', cx, cy + 14);
    const legend = document.getElementById('legend-segmentacion');
    if (legend) legend.innerHTML = segments.map(s => `<div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span><span>${s.label}</span><span class="legend-value">${s.value}</span></div>`).join('');
}

async function drawInteraccionesChart() {
    const { data } = await supabase.from('interacciones').select('tipo, fecha_interaccion, resultado').order('fecha_interaccion', { ascending: false });
    const canvas = document.getElementById('canvas-interacciones');
    if (!canvas || !data) return;

    // Group by last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }

    const waByDay = {}, callByDay = {};
    days.forEach(d => { waByDay[d] = 0; callByDay[d] = 0; });
    data.forEach(row => {
        const day = row.fecha_interaccion?.slice(0, 10);
        if (day && days.includes(day)) {
            if (row.tipo === 'WHATSAPP_PLANTILLA') waByDay[day]++;
            else if (row.tipo === 'LLAMADA_IA') callByDay[day]++;
        }
    });

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const maxVal = Math.max(...days.map(d => Math.max(waByDay[d], callByDay[d])), 1);
    const bw = 24, gap = 8, groupGap = 20;
    const chartH = 190, oY = 25, oX = 30;

    days.forEach((day, i) => {
        const x = oX + i * (bw * 2 + gap + groupGap);
        // WA bar
        const h1 = (waByDay[day] / maxVal) * chartH;
        drawRoundedBar(ctx, x, oY + chartH - h1, bw, h1, '#22c55e');
        // Call bar
        const h2 = (callByDay[day] / maxVal) * chartH;
        drawRoundedBar(ctx, x + bw + gap, oY + chartH - h2, bw, h2, '#f5c542');
        // Values
        ctx.fillStyle = '#e8eaf0'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center';
        if (waByDay[day] > 0) ctx.fillText(waByDay[day], x + bw / 2, oY + chartH - h1 - 6);
        if (callByDay[day] > 0) ctx.fillText(callByDay[day], x + bw + gap + bw / 2, oY + chartH - h2 - 6);
        // Day label
        ctx.fillStyle = '#5c6073'; ctx.font = '9px Inter';
        const dayLabel = day.slice(5); // MM-DD
        ctx.fillText(dayLabel, x + bw + gap / 2, oY + chartH + 16);
    });

    // Legend
    ctx.fillStyle = '#22c55e'; ctx.fillRect(oX, oY + chartH + 30, 10, 10);
    ctx.fillStyle = '#8b8fa3'; ctx.font = '10px Inter'; ctx.textAlign = 'left';
    ctx.fillText('WhatsApp', oX + 14, oY + chartH + 39);
    ctx.fillStyle = '#f5c542'; ctx.fillRect(oX + 90, oY + chartH + 30, 10, 10);
    ctx.fillStyle = '#8b8fa3'; ctx.fillText('Llamada IA', oX + 104, oY + chartH + 39);
}

function drawRoundedBar(ctx, x, y, w, h, color) {
    if (h < 1) return;
    const r = Math.min(4, h / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
}

// ============================================================
// TABLE DATA
// ============================================================
async function loadTable() {
    try {
        const { data, error } = await supabase
            .from('seguimientos_fidelizacion')
            .select(`
                *,
                pedidos (
                    id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido,
                    clientes ( id, nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion )
                ),
                asesores ( id, nombre_completo ),
                interacciones ( id, tipo, motivo, resultado, fue_venta, whatsapp_respondido, fecha_interaccion, duracion_segundos )
            `)
            .eq('estado_tarea', currentTab)
            .order('created_at', { ascending: false });

        if (error) { console.error('Error tabla:', error); allRows = []; }
        else {
            // Sort by priority: ALTA first, then MEDIA, then BAJA
            const prioOrder = { 'ALTA': 0, 'MEDIA': 1, 'BAJA': 2 };
            allRows = (data || []).sort((a, b) => (prioOrder[a.prioridad] || 1) - (prioOrder[b.prioridad] || 1));
        }
        applyFilters();
    } catch (err) { console.error('Error:', err); }
}

// ============================================================
// FILTERS
// ============================================================
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
    const prioridad = document.getElementById('filter-prioridad').value;
    const segmento = document.getElementById('filter-segmento').value;
    const logistico = document.getElementById('filter-logistico').value;
    const canal = document.getElementById('filter-canal').value;

    filteredRows = allRows.filter(row => {
        const c = row.pedidos?.clientes || {};
        const p = row.pedidos || {};
        if (prioridad && row.prioridad !== prioridad) return false;
        if (segmento && c.etiqueta !== segmento) return false;
        if (logistico && p.estado_logistico !== logistico) return false;
        if (canal && c.canal_adquisicion !== canal) return false;
        return true;
    });
    currentPage = 1;
    renderTable();
}

// ============================================================
// RENDER TABLE
// ============================================================
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

    if (pageRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" style="text-align:center; padding:40px; color:var(--color-text-muted);"><span class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:8px;">inbox</span>No hay registros ${currentTab.toLowerCase()}s</td></tr>`;
        updateFooter(0, 0);
        return;
    }

    pageRows.forEach((seg, idx) => {
        const pedido = seg.pedidos || {};
        const cliente = pedido.clientes || {};
        const ints = seg.interacciones || [];
        const row = document.createElement('tr');
        row.dataset.segId = seg.id;
        row.style.animationDelay = `${idx * 0.04}s`;

        // Priority
        const prioClass = { ALTA: 'prio-alta', MEDIA: 'prio-media', BAJA: 'prio-baja' }[seg.prioridad] || 'prio-media';
        const prioIcon = { ALTA: '🔴', MEDIA: '🟡', BAJA: '🟢' }[seg.prioridad] || '🟡';

        // WA status: last WA template
        const lastWA = ints.filter(i => i.tipo === 'WHATSAPP_PLANTILLA').sort((a, b) => new Date(b.fecha_interaccion) - new Date(a.fecha_interaccion))[0];
        let waHTML = '<span class="wa-status wa-none">—</span>';
        if (lastWA) {
            if (lastWA.whatsapp_respondido) waHTML = '<span class="wa-status wa-responded">✅ Respondido</span>';
            else if (lastWA.resultado === 'PENDIENTE') waHTML = '<span class="wa-status wa-pending">⏳ Pendiente</span>';
            else waHTML = '<span class="wa-status wa-sent">📤 Enviado</span>';
        }

        // Call status: last AI call
        const lastCall = ints.filter(i => i.tipo === 'LLAMADA_IA').sort((a, b) => new Date(b.fecha_interaccion) - new Date(a.fecha_interaccion))[0];
        let callHTML = '<span class="call-status call-none">—</span>';
        if (lastCall) {
            const dur = lastCall.duracion_segundos > 0 ? `${Math.round(lastCall.duracion_segundos / 60)}m${lastCall.duracion_segundos % 60}s` : '';
            if (lastCall.resultado === 'EXITOSA') callHTML = `<span class="call-status call-ok">✅ ${dur}</span>`;
            else if (lastCall.resultado === 'NO_CONTESTO') callHTML = '<span class="call-status call-fail">📵 No contestó</span>';
            else if (lastCall.resultado === 'BUZON') callHTML = '<span class="call-status call-fail">📭 Buzón</span>';
            else callHTML = `<span class="call-status call-pending">⏳ ${lastCall.resultado}</span>`;
        }

        // Venta badge
        const hasVenta = ints.some(i => i.fue_venta);
        const estadoLabel = (pedido.estado_logistico || 'TODAS').replace(/_/g, ' ');
        const ticketF = parseFloat(pedido.ticket_compra || 0).toLocaleString('es-CO');

        row.innerHTML = `
            <td class="cell-prio"><span class="prio-badge ${prioClass}">${prioIcon} ${seg.prioridad || 'MEDIA'}</span></td>
            <td class="cell-cliente">
                <span class="client-name">${cliente.nombre_completo || 'Sin nombre'}</span>
                <span class="client-location">${cliente.ciudad || ''}${cliente.ciudad && cliente.departamento ? ', ' : ''}${cliente.departamento || ''}</span>
            </td>
            <td class="cell-whatsapp"><a href="https://wa.me/${(cliente.whatsapp || '').replace('+', '')}" target="_blank">${cliente.whatsapp || '-'}</a></td>
            <td>
                <span class="segmento-badge ${cliente.etiqueta || 'NUEVO'}">${cliente.etiqueta || 'NUEVO'}</span><br>
                <span class="canal-badge">${cliente.canal_adquisicion || '-'}</span>
            </td>
            <td>
                <span class="product-badge">${(pedido.producto || '-').toUpperCase()}</span><br>
                <span class="cell-ticket">$${ticketF}</span>
                ${hasVenta ? '<br><span class="venta-badge">💰 VENTA</span>' : ''}
            </td>
            <td><span class="estado-badge ${pedido.estado_logistico || 'TODAS'}">${estadoLabel}</span></td>
            <td class="cell-wa">${waHTML}</td>
            <td class="cell-call">${callHTML}</td>
            <td class="cell-check"><span class="check-icon ${seg.llamada_5d ? 'checked' : 'unchecked'}" data-field="llamada_5d" data-id="${seg.id}"><span class="material-icons-outlined">${seg.llamada_5d ? 'check_box' : 'check_box_outline_blank'}</span></span></td>
            <td class="cell-check"><span class="check-icon ${seg.llamada_15d ? 'checked' : 'unchecked'}" data-field="llamada_15d" data-id="${seg.id}"><span class="material-icons-outlined">${seg.llamada_15d ? 'check_box' : 'check_box_outline_blank'}</span></span></td>
            <td class="cell-check"><span class="check-icon ${seg.llamada_25d ? 'checked' : 'unchecked'}" data-field="llamada_25d" data-id="${seg.id}"><span class="material-icons-outlined">${seg.llamada_25d ? 'check_box' : 'check_box_outline_blank'}</span></span></td>
            <td class="cell-check"><span class="check-icon ${seg.llamada_35d ? 'checked' : 'unchecked'}" data-field="llamada_35d" data-id="${seg.id}"><span class="material-icons-outlined">${seg.llamada_35d ? 'check_box' : 'check_box_outline_blank'}</span></span></td>
            <td class="cell-obs"><em>${seg.observaciones || 'Sin observaciones'}</em></td>
            <td><span class="calidad-badge ${seg.calidad || 'BUENO'}"><span class="calidad-dot"></span> ${seg.calidad || 'BUENO'}</span></td>
        `;
        tbody.appendChild(row);
    });

    initCheckboxes();
    updateFooter(filteredRows.length, allRows.length);
}

function updateFooter(shown, total) {
    const totalPages = Math.ceil(shown / PAGE_SIZE) || 1;
    document.getElementById('table-info').textContent = `Mostrando ${Math.min(shown, PAGE_SIZE)} de ${shown} registros (Pág. ${currentPage}/${totalPages})`;
    document.getElementById('page-indicator').textContent = `${currentPage} / ${totalPages}`;
}

// ============================================================
// PAGINATION
// ============================================================
function initPagination() {
    document.getElementById('page-prev').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    document.getElementById('page-next').addEventListener('click', () => { const tp = Math.ceil(filteredRows.length / PAGE_SIZE); if (currentPage < tp) { currentPage++; renderTable(); } });
}

// ============================================================
// CHECKBOXES
// ============================================================
function initCheckboxes() {
    document.querySelectorAll('.check-icon').forEach(icon => {
        const newIcon = icon.cloneNode(true);
        icon.parentNode.replaceChild(newIcon, icon);
        newIcon.addEventListener('click', async () => {
            const segId = newIcon.dataset.id, field = newIcon.dataset.field;
            const isChecked = newIcon.classList.contains('checked');
            const nv = !isChecked;
            const mi = newIcon.querySelector('.material-icons-outlined');
            newIcon.classList.toggle('checked', nv); newIcon.classList.toggle('unchecked', !nv);
            mi.textContent = nv ? 'check_box' : 'check_box_outline_blank';
            newIcon.style.transform = 'scale(1.3)';
            setTimeout(() => { newIcon.style.transform = 'scale(1)'; }, 200);
            const { error } = await supabase.from('seguimientos_fidelizacion').update({ [field]: nv }).eq('id', segId);
            if (error) { newIcon.classList.toggle('checked', !nv); newIcon.classList.toggle('unchecked', nv); mi.textContent = !nv ? 'check_box' : 'check_box_outline_blank'; }
        });
    });
}

// ============================================================
// SIDEBAR
// ============================================================
function initSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => { if (window.innerWidth <= 1024 && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) sidebar.classList.remove('open'); });

    const titles = { tablero: 'TABLERO', tareas: 'SEGUIMIENTO DE TAREAS', clientes: 'CLIENTES', logistica: 'LOGÍSTICA', reportes: 'REPORTES', ajustes: 'AJUSTES' };
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const s = item.dataset.section;
            document.getElementById('page-title').textContent = titles[s] || 'TABLERO';
            const show = (id, visible) => { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; };
            show('kpi-section', s === 'tablero');
            show('interaction-stats', s === 'tablero' || s === 'reportes');
            show('charts-section', s === 'tablero');
            show('filters-section', s === 'tablero' || s === 'tareas');
            show('table-section', true);
            if (window.innerWidth <= 1024) sidebar.classList.remove('open');
        });
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        const icon = document.querySelector('#btn-refresh .material-icons-outlined');
        icon.style.animation = 'spin 0.6s ease';
        setTimeout(() => icon.style.animation = '', 600);
        loadAll();
    });
    document.getElementById('btn-download')?.addEventListener('click', downloadCSV);
}

// ============================================================
// TABS
// ============================================================
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            loadTable();
        });
    });
}

// ============================================================
// SEARCH
// ============================================================
function initSearch() {
    document.getElementById('search-input').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        if (!q) { filteredRows = [...allRows]; } else {
            filteredRows = allRows.filter(r => {
                const c = r.pedidos?.clientes || {}; const p = r.pedidos || {};
                return [c.nombre_completo, c.whatsapp, c.ciudad, c.departamento, p.producto, p.estado_logistico, r.observaciones, r.calidad, r.prioridad].filter(Boolean).join(' ').toLowerCase().includes(q);
            });
        }
        currentPage = 1; renderTable();
    });
}

// ============================================================
// CSV
// ============================================================
function downloadCSV() {
    const h = ['Prioridad','Cliente','WhatsApp','Ciudad','Depto','Segmento','Canal','Producto','Ticket','Estado','WA Respondido','Llamada IA','5D','15D','25D','35D','Observaciones','Calidad'];
    const rows = filteredRows.map(s => {
        const p = s.pedidos || {}; const c = p.clientes || {}; const ints = s.interacciones || [];
        const lastWA = ints.find(i => i.tipo === 'WHATSAPP_PLANTILLA');
        const lastCall = ints.find(i => i.tipo === 'LLAMADA_IA');
        return [s.prioridad, c.nombre_completo, c.whatsapp, c.ciudad, c.departamento, c.etiqueta, c.canal_adquisicion, p.producto, p.ticket_compra, p.estado_logistico, lastWA?.whatsapp_respondido ? 'SÍ' : 'NO', lastCall?.resultado || '-', s.llamada_5d ? 'SÍ' : 'NO', s.llamada_15d ? 'SÍ' : 'NO', s.llamada_25d ? 'SÍ' : 'NO', s.llamada_35d ? 'SÍ' : 'NO', s.observaciones, s.calidad].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
    });
    const csv = [h.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `elite_crm_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}
