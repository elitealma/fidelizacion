// ============================================================
// ELITE NUTRITION - CRM Fidelización Logística
// Conectado con Supabase (FACTURACION AUTOMATICA)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initTabs();
    initModal();
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
let asesoresCache = [];

async function loadAll() {
    await loadAsesores();
    await Promise.all([loadKPIs(), loadCharts(), loadTable()]);
}

// ============================================================
// SUPABASE - LOAD ASESORES
// ============================================================
async function loadAsesores() {
    try {
        const { data, error } = await supabase
            .from('asesores')
            .select('id, nombre_completo')
            .eq('activo', true)
            .order('nombre_completo');

        if (!error && data) {
            asesoresCache = data;
            const sel = document.getElementById('task-asesor');
            if (sel) {
                sel.innerHTML = '<option value="">Seleccionar asesor...</option>';
                data.forEach(a => {
                    sel.innerHTML += `<option value="${a.id}">${a.nombre_completo}</option>`;
                });
            }
        }
    } catch (e) { console.error('Error asesores:', e); }
}

// ============================================================
// SUPABASE - KPIs
// ============================================================
async function loadKPIs() {
    try {
        // Total clientes
        const { count: totalClientes } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true });

        // Ticket promedio
        const { data: ticketData } = await supabase
            .from('pedidos')
            .select('ticket_compra');

        let ticketPromedio = 0;
        if (ticketData && ticketData.length > 0) {
            const sum = ticketData.reduce((acc, p) => acc + parseFloat(p.ticket_compra || 0), 0);
            ticketPromedio = Math.round(sum / ticketData.length);
        }

        // Tareas pendientes
        const { count: tareasPendientes } = await supabase
            .from('seguimientos_fidelizacion')
            .select('*', { count: 'exact', head: true })
            .eq('estado_tarea', 'ACTIVA');

        // Tasa de retención (recurrentes / total)
        const { count: recurrentes } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true })
            .eq('etiqueta', 'RECURRENTE');

        const retencion = totalClientes > 0 ? Math.round((recurrentes / totalClientes) * 100) : 0;

        // Update DOM
        document.getElementById('kpi-val-clientes').textContent = (totalClientes || 0).toLocaleString('es-CO');
        document.getElementById('kpi-val-ticket').textContent = '$' + (ticketPromedio || 0).toLocaleString('es-CO');
        document.getElementById('kpi-val-pendientes').textContent = tareasPendientes || 0;
        document.getElementById('kpi-val-retencion').textContent = retencion + '%';

    } catch (err) {
        console.error('Error KPIs:', err);
    }
}

// ============================================================
// CHARTS - Donut + Bars (Canvas nativo)
// ============================================================
async function loadCharts() {
    await drawSegmentacionChart();
    await drawLogisticaChart();
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

    // Draw donut
    const ctx = canvas.getContext('2d');
    const cx = 140, cy = 140, outerR = 110, innerR = 65;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let startAngle = -Math.PI / 2;
    segments.forEach(seg => {
        const sliceAngle = (seg.value / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        startAngle += sliceAngle;
    });

    // Center text
    ctx.fillStyle = '#e8eaf0';
    ctx.font = 'bold 28px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total.toString(), cx, cy - 8);
    ctx.fillStyle = '#8b8fa3';
    ctx.font = '11px Inter';
    ctx.fillText('CLIENTES', cx, cy + 14);

    // Legend
    const legend = document.getElementById('legend-segmentacion');
    if (legend) {
        legend.innerHTML = segments.map(s => `
            <div class="legend-item">
                <span class="legend-dot" style="background:${s.color}"></span>
                <span>${s.label}</span>
                <span class="legend-value">${s.value}</span>
            </div>
        `).join('');
    }
}

async function drawLogisticaChart() {
    const { data } = await supabase.from('pedidos').select('estado_logistico');
    const canvas = document.getElementById('canvas-logistica');
    if (!canvas || !data) return;

    const labels = [
        'GUIA_GENERADA', 'EN_REPARTO', 'EN_OFICINA', 'ENTREGADO_AL_CLIENTE',
        'HABLAR_CON_ASESOR', 'RETRASO_O_MOLESTIA', 'NOVEDADES', 'GARANTIAS', 'DEVOLUCIONES'
    ];
    const shortLabels = [
        'Guía', 'Reparto', 'Oficina', 'Entregado',
        'Asesor', 'Retraso', 'Novedad', 'Garantía', 'Devol.'
    ];
    const colors = [
        '#3b82f6', '#fbbf24', '#8b5cf6', '#22c55e',
        '#ec4899', '#ef4444', '#06b6d4', '#f5c542', '#f87171'
    ];

    const counts = {};
    labels.forEach(l => counts[l] = 0);
    data.forEach(p => { if (counts.hasOwnProperty(p.estado_logistico)) counts[p.estado_logistico]++; });

    const maxVal = Math.max(...Object.values(counts), 1);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = 36;
    const gap = 14;
    const chartHeight = 200;
    const offsetY = 30;
    const offsetX = 15;

    labels.forEach((label, i) => {
        const x = offsetX + i * (barWidth + gap);
        const barH = (counts[label] / maxVal) * chartHeight;
        const y = offsetY + chartHeight - barH;

        // Bar with rounded top
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        const r = 4;
        ctx.moveTo(x, y + r);
        ctx.arcTo(x, y, x + barWidth, y, r);
        ctx.arcTo(x + barWidth, y, x + barWidth, y + barH, r);
        ctx.lineTo(x + barWidth, offsetY + chartHeight);
        ctx.lineTo(x, offsetY + chartHeight);
        ctx.closePath();
        ctx.fill();

        // Value on top
        ctx.fillStyle = '#e8eaf0';
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(counts[label].toString(), x + barWidth / 2, y - 6);

        // Label below
        ctx.fillStyle = '#5c6073';
        ctx.font = '9px Inter';
        ctx.fillText(shortLabels[i], x + barWidth / 2, offsetY + chartHeight + 16);
    });
}

// ============================================================
// SUPABASE - TABLE DATA
// ============================================================
async function loadTable() {
    try {
        const { data, error } = await supabase
            .from('seguimientos_fidelizacion')
            .select(`
                *,
                pedidos (
                    id, producto, ticket_compra, area_ventas, estado_logistico, fecha_pedido,
                    clientes (
                        id, nombre_completo, whatsapp, departamento, ciudad, etiqueta, canal_adquisicion
                    )
                ),
                asesores (
                    id, nombre_completo
                )
            `)
            .eq('estado_tarea', currentTab)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error tabla:', error);
            allRows = [];
        } else {
            allRows = data || [];
        }

        applyFilters();
    } catch (err) {
        console.error('Error:', err);
    }
}

// ============================================================
// FILTERS
// ============================================================
function initFilters() {
    document.getElementById('btn-filter-apply').addEventListener('click', applyFilters);
    document.getElementById('btn-filter-clear').addEventListener('click', () => {
        document.getElementById('filter-segmento').value = '';
        document.getElementById('filter-logistico').value = '';
        document.getElementById('filter-canal').value = '';
        document.getElementById('filter-ciudad').value = '';
        applyFilters();
    });
}

function applyFilters() {
    const segmento = document.getElementById('filter-segmento').value;
    const logistico = document.getElementById('filter-logistico').value;
    const canal = document.getElementById('filter-canal').value;
    const ciudad = document.getElementById('filter-ciudad').value.toLowerCase().trim();

    filteredRows = allRows.filter(row => {
        const cliente = row.pedidos?.clientes || {};
        const pedido = row.pedidos || {};

        if (segmento && cliente.etiqueta !== segmento) return false;
        if (logistico && pedido.estado_logistico !== logistico) return false;
        if (canal && cliente.canal_adquisicion !== canal) return false;
        if (ciudad && !(cliente.ciudad || '').toLowerCase().includes(ciudad) && !(cliente.departamento || '').toLowerCase().includes(ciudad)) return false;

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
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center; padding:40px; color:var(--color-text-muted);">
                    <span class="material-icons-outlined" style="font-size:48px; display:block; margin-bottom:8px;">inbox</span>
                    No hay registros ${currentTab.toLowerCase()}s
                </td>
            </tr>
        `;
        updateFooter(0, 0);
        return;
    }

    pageRows.forEach((seg, idx) => {
        const pedido = seg.pedidos || {};
        const cliente = pedido.clientes || {};
        const asesor = seg.asesores || {};
        const row = document.createElement('tr');
        row.dataset.segId = seg.id;
        row.style.animationDelay = `${idx * 0.05}s`;

        const estadoLabel = (pedido.estado_logistico || 'TODAS').replace(/_/g, ' ');
        const ticketFormatted = parseFloat(pedido.ticket_compra || 0).toLocaleString('es-CO');

        row.innerHTML = `
            <td class="cell-cliente">
                <span class="client-name">${cliente.nombre_completo || 'Sin nombre'}</span>
                <span class="client-location">${cliente.ciudad || ''}${cliente.ciudad && cliente.departamento ? ', ' : ''}${cliente.departamento || ''}</span>
            </td>
            <td class="cell-whatsapp">
                <a href="https://wa.me/${(cliente.whatsapp || '').replace('+', '')}" target="_blank" rel="noopener">
                    ${cliente.whatsapp || '-'}
                </a>
            </td>
            <td>
                <span class="segmento-badge ${cliente.etiqueta || 'NUEVO'}">${cliente.etiqueta || 'NUEVO'}</span><br>
                <span class="canal-badge">${cliente.canal_adquisicion || '-'}</span>
            </td>
            <td>
                <span class="product-badge">${(pedido.producto || 'SIN ASIGNAR').toUpperCase()}</span><br>
                <span class="cell-ticket">$${ticketFormatted}</span>
            </td>
            <td>
                <span class="estado-badge ${pedido.estado_logistico || 'TODAS'}">${estadoLabel}</span>
            </td>
            <td class="cell-check">
                <span class="check-icon ${seg.llamada_5d ? 'checked' : 'unchecked'}" data-field="llamada_5d" data-id="${seg.id}">
                    <span class="material-icons-outlined">${seg.llamada_5d ? 'check_box' : 'check_box_outline_blank'}</span>
                </span>
            </td>
            <td class="cell-check">
                <span class="check-icon ${seg.llamada_15d ? 'checked' : 'unchecked'}" data-field="llamada_15d" data-id="${seg.id}">
                    <span class="material-icons-outlined">${seg.llamada_15d ? 'check_box' : 'check_box_outline_blank'}</span>
                </span>
            </td>
            <td class="cell-check">
                <span class="check-icon ${seg.llamada_25d ? 'checked' : 'unchecked'}" data-field="llamada_25d" data-id="${seg.id}">
                    <span class="material-icons-outlined">${seg.llamada_25d ? 'check_box' : 'check_box_outline_blank'}</span>
                </span>
            </td>
            <td class="cell-check">
                <span class="check-icon ${seg.llamada_35d ? 'checked' : 'unchecked'}" data-field="llamada_35d" data-id="${seg.id}">
                    <span class="material-icons-outlined">${seg.llamada_35d ? 'check_box' : 'check_box_outline_blank'}</span>
                </span>
            </td>
            <td class="cell-obs"><em>${seg.observaciones || 'Sin observaciones'}</em></td>
            <td>
                <span class="calidad-badge ${seg.calidad || 'BUENO'}">
                    <span class="calidad-dot"></span> ${(seg.calidad || 'BUENO')}
                </span>
            </td>
        `;
        tbody.appendChild(row);
    });

    initCheckboxes();
    updateFooter(filteredRows.length, allRows.length);
}

function updateFooter(shown, total) {
    const info = document.getElementById('table-info');
    const totalPages = Math.ceil(shown / PAGE_SIZE) || 1;
    info.textContent = `Mostrando ${Math.min(shown, PAGE_SIZE)} de ${shown} registros (Pág. ${currentPage}/${totalPages})`;
    document.getElementById('page-indicator').textContent = `${currentPage} / ${totalPages}`;
}

// ============================================================
// PAGINATION
// ============================================================
function initPagination() {
    document.getElementById('page-prev').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
    document.getElementById('page-next').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });
}

// ============================================================
// CHECKBOXES - Update Supabase
// ============================================================
function initCheckboxes() {
    document.querySelectorAll('.check-icon').forEach(icon => {
        const newIcon = icon.cloneNode(true);
        icon.parentNode.replaceChild(newIcon, icon);

        newIcon.addEventListener('click', async () => {
            const segId = newIcon.dataset.id;
            const field = newIcon.dataset.field;
            const isChecked = newIcon.classList.contains('checked');
            const newValue = !isChecked;

            const materialIcon = newIcon.querySelector('.material-icons-outlined');
            if (newValue) {
                newIcon.classList.remove('unchecked');
                newIcon.classList.add('checked');
                materialIcon.textContent = 'check_box';
            } else {
                newIcon.classList.remove('checked');
                newIcon.classList.add('unchecked');
                materialIcon.textContent = 'check_box_outline_blank';
            }

            newIcon.style.transform = 'scale(1.3)';
            setTimeout(() => { newIcon.style.transform = 'scale(1)'; }, 200);

            const { error } = await supabase
                .from('seguimientos_fidelizacion')
                .update({ [field]: newValue })
                .eq('id', segId);

            if (error) {
                console.error('Error actualizando:', error);
                if (newValue) {
                    newIcon.classList.remove('checked');
                    newIcon.classList.add('unchecked');
                    materialIcon.textContent = 'check_box_outline_blank';
                } else {
                    newIcon.classList.remove('unchecked');
                    newIcon.classList.add('checked');
                    materialIcon.textContent = 'check_box';
                }
            }
        });
    });
}

// ============================================================
// SIDEBAR
// ============================================================
function initSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    const navItems = document.querySelectorAll('.nav-item');
    const sectionTitles = {
        tablero: 'TABLERO',
        tareas: 'SEGUIMIENTO DE TAREAS',
        clientes: 'CLIENTES',
        logistica: 'LOGÍSTICA',
        reportes: 'REPORTES',
        ajustes: 'AJUSTES'
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const section = item.dataset.section;
            document.getElementById('page-title').textContent = sectionTitles[section] || 'TABLERO';

            // Show/hide sections based on nav
            const kpiSection = document.getElementById('kpi-section');
            const chartsSection = document.getElementById('charts-section');
            const filtersSection = document.getElementById('filters-section');
            const tableSection = document.getElementById('table-section');

            if (section === 'tablero') {
                kpiSection.style.display = '';
                chartsSection.style.display = '';
                filtersSection.style.display = '';
                tableSection.style.display = '';
            } else if (section === 'tareas') {
                kpiSection.style.display = 'none';
                chartsSection.style.display = 'none';
                filtersSection.style.display = '';
                tableSection.style.display = '';
            } else {
                kpiSection.style.display = '';
                chartsSection.style.display = 'none';
                filtersSection.style.display = 'none';
                tableSection.style.display = '';
            }

            if (window.innerWidth <= 1024) sidebar.classList.remove('open');
        });
    });

    // Refresh button
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            btnRefresh.querySelector('.material-icons-outlined').style.animation = 'spin 0.6s ease';
            setTimeout(() => {
                btnRefresh.querySelector('.material-icons-outlined').style.animation = '';
            }, 600);
            loadAll();
        });
    }

    // Download CSV
    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) {
        btnDownload.addEventListener('click', downloadCSV);
    }
}

// ============================================================
// TABS
// ============================================================
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            loadTable();
        });
    });
}

// ============================================================
// MODAL - Save to Supabase
// ============================================================
function initModal() {
    const overlay = document.getElementById('modal-overlay');
    const btnNewTask = document.getElementById('btn-new-task');
    const btnClose = document.getElementById('modal-close');
    const btnCancel = document.getElementById('btn-cancel');
    const btnSave = document.getElementById('btn-save');

    function openModal() {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        // Reset form
        ['task-nombre', 'task-departamento', 'task-ciudad', 'task-producto', 'task-observaciones'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('task-whatsapp').value = '+57';
        document.getElementById('task-ticket').value = '';
        document.getElementById('task-etiqueta').value = 'NUEVO';
        document.getElementById('task-canal').value = 'ORGANICO';
        document.getElementById('task-area').value = 'WHATSAPP';
        document.getElementById('task-estado-log').value = 'GUIA_GENERADA';
        document.getElementById('task-calidad').value = 'BUENO';
        document.getElementById('task-asesor').value = '';
    }

    btnNewTask.addEventListener('click', openModal);
    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) closeModal();
    });

    btnSave.addEventListener('click', async () => {
        const nombre = document.getElementById('task-nombre').value.trim();
        const whatsapp = document.getElementById('task-whatsapp').value.trim();
        const departamento = document.getElementById('task-departamento').value.trim();
        const ciudad = document.getElementById('task-ciudad').value.trim();
        const etiqueta = document.getElementById('task-etiqueta').value;
        const canal = document.getElementById('task-canal').value;
        const producto = document.getElementById('task-producto').value.trim();
        const ticket = parseFloat(document.getElementById('task-ticket').value) || 0;
        const areaVentas = document.getElementById('task-area').value;
        const estadoLog = document.getElementById('task-estado-log').value;
        const asesorId = document.getElementById('task-asesor').value;
        const calidad = document.getElementById('task-calidad').value;
        const observaciones = document.getElementById('task-observaciones').value.trim();

        // Validations
        if (!nombre) { shakeElement(document.getElementById('task-nombre')); return; }
        if (!whatsapp.match(/^\+57\d{10}$/)) {
            shakeElement(document.getElementById('task-whatsapp'));
            alert('El WhatsApp debe tener formato +57 seguido de 10 dígitos');
            return;
        }
        if (!asesorId) { shakeElement(document.getElementById('task-asesor')); return; }

        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="material-icons-outlined" style="animation:spin 0.6s linear infinite">sync</span> Guardando...';

        try {
            // 1. Upsert cliente
            const { data: clienteData, error: cErr } = await supabase
                .from('clientes')
                .upsert({
                    nombre_completo: nombre,
                    whatsapp: whatsapp,
                    departamento: departamento || null,
                    ciudad: ciudad || null,
                    etiqueta: etiqueta,
                    canal_adquisicion: canal,
                    ultima_compra: new Date().toISOString()
                }, { onConflict: 'whatsapp' })
                .select()
                .single();

            if (cErr) throw cErr;

            // 2. Create pedido
            const { data: pedidoData, error: pErr } = await supabase
                .from('pedidos')
                .insert({
                    cliente_id: clienteData.id,
                    producto: producto || 'Sin especificar',
                    ticket_compra: ticket,
                    area_ventas: areaVentas,
                    estado_logistico: estadoLog
                })
                .select()
                .single();

            if (pErr) throw pErr;

            // 3. Create seguimiento
            const { error: sErr } = await supabase
                .from('seguimientos_fidelizacion')
                .insert({
                    pedido_id: pedidoData.id,
                    asesor_id: asesorId,
                    calidad: calidad,
                    observaciones: observaciones || null,
                    estado_tarea: 'ACTIVA'
                });

            if (sErr) throw sErr;

            closeModal();
            await loadAll();

        } catch (err) {
            console.error('Error guardando:', err);
            alert('Error al guardar: ' + (err.message || 'Intenta de nuevo'));
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = '<span class="material-icons-outlined">save</span> Guardar Tarea';
        }
    });
}

function shakeElement(el) {
    el.style.borderColor = '#ef4444';
    el.style.animation = 'shake 0.4s ease';

    if (!document.querySelector('#shake-style')) {
        const style = document.createElement('style');
        style.id = 'shake-style';
        style.textContent = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-8px); }
                50% { transform: translateX(8px); }
                75% { transform: translateX(-4px); }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        el.style.borderColor = '';
        el.style.animation = '';
    }, 600);
}

// ============================================================
// SEARCH
// ============================================================
function initSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query === '') {
            filteredRows = [...allRows];
        } else {
            filteredRows = allRows.filter(row => {
                const cliente = row.pedidos?.clientes || {};
                const pedido = row.pedidos || {};
                const searchText = [
                    cliente.nombre_completo, cliente.whatsapp, cliente.ciudad,
                    cliente.departamento, pedido.producto, pedido.estado_logistico,
                    row.observaciones, row.calidad
                ].filter(Boolean).join(' ').toLowerCase();
                return searchText.includes(query);
            });
        }
        currentPage = 1;
        renderTable();
    });
}

// ============================================================
// CSV DOWNLOAD
// ============================================================
function downloadCSV() {
    const headers = ['Cliente', 'WhatsApp', 'Ciudad', 'Departamento', 'Segmento', 'Canal', 'Producto', 'Ticket', 'Estado Logístico', '5D', '15D', '25D', '35D', 'Observaciones', 'Calidad'];
    const rows = filteredRows.map(seg => {
        const p = seg.pedidos || {};
        const c = p.clientes || {};
        return [
            c.nombre_completo, c.whatsapp, c.ciudad, c.departamento, c.etiqueta, c.canal_adquisicion,
            p.producto, p.ticket_compra, p.estado_logistico,
            seg.llamada_5d ? 'SÍ' : 'NO', seg.llamada_15d ? 'SÍ' : 'NO',
            seg.llamada_25d ? 'SÍ' : 'NO', seg.llamada_35d ? 'SÍ' : 'NO',
            seg.observaciones, seg.calidad
        ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elite_nutrition_crm_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
