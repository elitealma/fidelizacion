// ================================
// ELITE NUTRITION - Seguimiento de Tareas
// Conectado con Supabase
// ================================

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initTabs();
    initPagination();
    initModal();
    initSearch();
    loadTareas(); // Cargar datos desde Supabase
    loadKPIs();   // Cargar KPIs desde Supabase
});

// ================================
// SUPABASE - LOAD DATA
// ================================
let currentTab = 'activa';
let allTareas = [];

// Helper: Badge para tipo de cliente (clasificación del workflow n8n)
function getTipoClienteBadge(tipo) {
    if (!tipo) return '<span class="tipo-badge prospecto">PROSPECTO</span>';
    
    const tipoLower = tipo.toLowerCase();
    let cssClass = 'prospecto';
    let label = tipo.toUpperCase();
    
    if (tipoLower.includes('recurrente activo')) cssClass = 'recurrente-activo';
    else if (tipoLower.includes('recurrente inactivo')) cssClass = 'recurrente-inactivo';
    else if (tipoLower.includes('ocasional activo')) cssClass = 'ocasional-activo';
    else if (tipoLower.includes('ocasional inactivo')) cssClass = 'ocasional-inactivo';
    else if (tipoLower.includes('nuevo')) cssClass = 'nuevo';
    else if (tipoLower.includes('no quiso')) cssClass = 'no-quiso';
    else if (tipoLower.includes('prospecto')) cssClass = 'prospecto';

    // Shorten labels
    if (label.length > 20) label = label.substring(0, 18) + '…';
    
    return `<span class="tipo-badge ${cssClass}">${label}</span>`;
}

async function loadTareas() {
    try {
        const { data, error } = await supabase
            .from('fid_tareas')
            .select(`
                *,
                fid_clientes (
                    id, nombre, apellido, whatsapp, producto, tipo_cliente, num_facturas, meses_sin_comprar
                )
            `)
            .eq('estado', currentTab)
            .order('hora', { ascending: true });

        if (error) {
            console.error('Error cargando tareas:', error);
            return;
        }

        allTareas = data || [];
        renderTable(allTareas);
    } catch (err) {
        console.error('Error:', err);
    }
}

async function loadKPIs() {
    try {
        // Total clientes
        const { count: totalClientes } = await supabase
            .from('fid_clientes')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);

        // Tareas pendientes
        const { count: tareasPendientes } = await supabase
            .from('fid_tareas')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'activa');

        // Calidad - contar buenos vs total
        const { data: calidadData } = await supabase
            .from('fid_tareas')
            .select('calidad');

        let calidadMedia = 'A+';
        if (calidadData && calidadData.length > 0) {
            const buenos = calidadData.filter(t => t.calidad === 'bueno').length;
            const ratio = buenos / calidadData.length;
            if (ratio >= 0.7) calidadMedia = 'A+';
            else if (ratio >= 0.5) calidadMedia = 'A';
            else if (ratio >= 0.3) calidadMedia = 'B';
            else calidadMedia = 'C';
        }

        // Conversión - tareas con al menos 3 llamadas
        const { data: conversionData } = await supabase
            .from('fid_tareas')
            .select('llamada_5d, llamada_15d, llamada_25d, llamada_35d');

        let conversion = 0;
        if (conversionData && conversionData.length > 0) {
            const completadas = conversionData.filter(t => 
                t.llamada_5d && t.llamada_15d && t.llamada_25d
            ).length;
            conversion = Math.round((completadas / conversionData.length) * 100);
        }

        // Actualizar KPIs en el DOM
        document.querySelector('#kpi-clientes .kpi-value').textContent = (totalClientes || 0).toLocaleString();
        document.querySelector('#kpi-pendientes .kpi-value').textContent = tareasPendientes || 0;
        document.querySelector('#kpi-calidad .kpi-value').textContent = calidadMedia;
        document.querySelector('#kpi-conversion .kpi-value').textContent = conversion + '%';

    } catch (err) {
        console.error('Error KPIs:', err);
    }
}

// ================================
// RENDER TABLE
// ================================
function renderTable(tareas) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    if (tareas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center; padding:40px; color:#9ca3af;">
                    <span class="material-icons-outlined" style="font-size:48px; display:block; margin-bottom:8px;">inbox</span>
                    No hay tareas ${currentTab}s
                </td>
            </tr>
        `;
        updateFooter(0);
        return;
    }

    tareas.forEach(tarea => {
        const cliente = tarea.fid_clientes || {};
        const row = document.createElement('tr');
        row.dataset.tareaId = tarea.id;
        row.style.animation = 'fadeInUp 0.4s ease backwards';

        // Format time - handle both string and time formats
        const hora = tarea.hora ? tarea.hora.substring(0, 5) : '--:--';

        row.innerHTML = `
            <td class="cell-hora">${hora}</td>
            <td class="cell-nombre"><strong>${cliente.nombre || ''}<br>${cliente.apellido || ''}</strong></td>
            <td class="cell-whatsapp">${cliente.whatsapp || '-'}</td>
            <td class="cell-producto"><span class="product-badge">${(cliente.producto || 'SIN ASIGNAR').toUpperCase()}</span></td>
            <td class="cell-tipo">${getTipoClienteBadge(cliente.tipo_cliente)}</td>
            <td class="cell-check">
                <span class="check-icon ${tarea.llamada_5d ? 'checked' : 'unchecked'}" data-field="llamada_5d" data-id="${tarea.id}">
                    <span class="material-icons-outlined">${tarea.llamada_5d ? 'check_box' : 'check_box_outline_blank'}</span>
                </span>
            </td>
            <td class="cell-check">
                <span class="check-icon ${tarea.llamada_15d ? 'checked' : 'unchecked'}" data-field="llamada_15d" data-id="${tarea.id}">
                    <span class="material-icons-outlined">${tarea.llamada_15d ? 'check_box' : 'check_box_outline_blank'}</span>
                </span>
            </td>
            <td class="cell-check">
                <span class="check-icon ${tarea.llamada_25d ? 'checked' : 'unchecked'}" data-field="llamada_25d" data-id="${tarea.id}">
                    <span class="material-icons-outlined">${tarea.llamada_25d ? 'check_box' : 'check_box_outline_blank'}</span>
                </span>
            </td>
            <td class="cell-check">
                <span class="check-icon ${tarea.llamada_35d ? 'checked' : 'unchecked'}" data-field="llamada_35d" data-id="${tarea.id}">
                    <span class="material-icons-outlined">${tarea.llamada_35d ? 'check_box' : 'check_box_outline_blank'}</span>
                </span>
            </td>
            <td class="cell-obs"><em>${tarea.observaciones || 'Sin observaciones'}</em></td>
            <td class="cell-calidad"><span class="calidad-badge ${tarea.calidad}">● ${(tarea.calidad || 'bueno').toUpperCase()}</span></td>
        `;

        tbody.appendChild(row);
    });

    // Init checkboxes for all rows
    initCheckboxes();
    updateFooter(tareas.length);
}

function updateFooter(count) {
    const tableInfo = document.querySelector('.table-info');
    tableInfo.textContent = `Mostrando ${count} registro${count !== 1 ? 's' : ''}`;
}

// ================================
// CHECKBOXES - Update Supabase
// ================================
function initCheckboxes() {
    document.querySelectorAll('.check-icon').forEach(icon => {
        // Remove old listeners by cloning
        const newIcon = icon.cloneNode(true);
        icon.parentNode.replaceChild(newIcon, icon);

        newIcon.addEventListener('click', async () => {
            const tareaId = newIcon.dataset.id;
            const field = newIcon.dataset.field;
            const isChecked = newIcon.classList.contains('checked');
            const newValue = !isChecked;

            // Optimistic UI update
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

            // Scale animation
            newIcon.style.transform = 'scale(1.3)';
            setTimeout(() => { newIcon.style.transform = 'scale(1)'; }, 200);

            // Update Supabase
            const { error } = await supabase
                .from('fid_tareas')
                .update({ [field]: newValue })
                .eq('id', tareaId);

            if (error) {
                console.error('Error actualizando:', error);
                // Revert on error
                if (newValue) {
                    newIcon.classList.remove('checked');
                    newIcon.classList.add('unchecked');
                    materialIcon.textContent = 'check_box_outline_blank';
                } else {
                    newIcon.classList.remove('unchecked');
                    newIcon.classList.add('checked');
                    materialIcon.textContent = 'check_box';
                }
            } else {
                // Refresh KPIs
                loadKPIs();
            }
        });
    });
}

// ================================
// SIDEBAR
// ================================
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
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('open');
            }
        });
    });
}

// ================================
// TABS - Filter by estado
// ================================
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabMap = {
        'activas': 'activa',
        'completadas': 'completada',
        'archivadas': 'archivada'
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tabMap[tab.dataset.tab] || 'activa';
            loadTareas(); // Reload from Supabase with new filter
        });
    });
}

// ================================
// PAGINATION
// ================================
function initPagination() {
    const paginationBtns = document.querySelectorAll('.page-btn[data-page]');

    paginationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            paginationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const prevBtn = document.getElementById('page-prev');
    const nextBtn = document.getElementById('page-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            const active = document.querySelector('.page-btn.active[data-page]');
            if (active) {
                const currentPage = parseInt(active.dataset.page);
                if (currentPage > 1) {
                    const target = document.querySelector(`.page-btn[data-page="${currentPage - 1}"]`);
                    if (target) target.click();
                }
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const active = document.querySelector('.page-btn.active[data-page]');
            if (active) {
                const currentPage = parseInt(active.dataset.page);
                const maxPage = paginationBtns.length;
                if (currentPage < maxPage) {
                    const target = document.querySelector(`.page-btn[data-page="${currentPage + 1}"]`);
                    if (target) target.click();
                }
            }
        });
    }
}

// ================================
// MODAL - Save to Supabase
// ================================
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
        document.getElementById('task-nombre').value = '';
        document.getElementById('task-whatsapp').value = '';
        document.getElementById('task-producto').value = '';
        document.getElementById('task-observaciones').value = '';
        document.getElementById('task-calidad').value = 'bueno';
        document.getElementById('task-hora').value = '09:00';
    }

    btnNewTask.addEventListener('click', openModal);
    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeModal();
        }
    });

    // Save new task to Supabase
    btnSave.addEventListener('click', async () => {
        const nombreCompleto = document.getElementById('task-nombre').value.trim();
        const whatsapp = document.getElementById('task-whatsapp').value.trim();
        const producto = document.getElementById('task-producto').value.trim();
        const observaciones = document.getElementById('task-observaciones').value.trim();
        const calidad = document.getElementById('task-calidad').value;
        const hora = document.getElementById('task-hora').value;

        if (!nombreCompleto) {
            shakeElement(document.getElementById('task-nombre'));
            return;
        }

        // Disable save button while saving
        btnSave.disabled = true;
        btnSave.textContent = 'Guardando...';

        try {
            // Split name
            const parts = nombreCompleto.split(' ');
            const nombre = parts[0] || '';
            const apellido = parts.slice(1).join(' ') || '';

            // 1. Create or find client
            const { data: clienteData, error: clienteError } = await supabase
                .from('fid_clientes')
                .insert({
                    nombre: nombre,
                    apellido: apellido,
                    whatsapp: whatsapp || null,
                    producto: producto.toUpperCase() || null,
                    calidad: calidad,
                    observaciones: observaciones || null
                })
                .select()
                .single();

            if (clienteError) {
                console.error('Error creando cliente:', clienteError);
                alert('Error al guardar el cliente. Intenta de nuevo.');
                return;
            }

            // 2. Create task linked to client
            const { error: tareaError } = await supabase
                .from('fid_tareas')
                .insert({
                    cliente_id: clienteData.id,
                    hora: hora || '09:00',
                    observaciones: observaciones || null,
                    calidad: calidad,
                    estado: 'activa',
                    asesora: 'Daniela Vega'
                });

            if (tareaError) {
                console.error('Error creando tarea:', tareaError);
                alert('Error al guardar la tarea. Intenta de nuevo.');
                return;
            }

            // 3. Reload data
            closeModal();
            await loadTareas();
            await loadKPIs();

        } catch (err) {
            console.error('Error:', err);
            alert('Error inesperado. Intenta de nuevo.');
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Guardar Tarea';
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

// ================================
// SEARCH - Filter local data
// ================================
function initSearch() {
    const searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        if (query === '') {
            renderTable(allTareas);
            return;
        }

        const filtered = allTareas.filter(tarea => {
            const cliente = tarea.fid_clientes || {};
            const searchText = [
                cliente.nombre, cliente.apellido, cliente.whatsapp,
                cliente.producto, cliente.tipo_cliente, tarea.observaciones, tarea.calidad
            ].filter(Boolean).join(' ').toLowerCase();
            return searchText.includes(query);
        });

        renderTable(filtered);
    });
}
