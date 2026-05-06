// ===== APP CONTROLLER =====

let currentView = 'dashboard';

// ===== NAVIGATION =====
function navigateTo(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  const main = document.getElementById('mainContent');
  switch(view) {
    case 'dashboard': main.innerHTML = renderDashboard(); break;
    case 'consultores': main.innerHTML = renderConsultores(); break;
    case 'importar': main.innerHTML = renderImportar(); break;
    case 'gestiones': main.innerHTML = renderGestiones(); break;
    case 'reportes': main.innerHTML = renderReportes(); break;
  }
  updateAlertBadge();
  if (window.innerWidth <= 900) {
    document.getElementById('sidebar').classList.remove('active');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('active');
}

function cambiarFiltroVertical(val) {
  APP.config.filtroVertical = val;
  saveData(APP);
  navigateTo('dashboard');
}

function updateAlertBadge() {
  const badge = document.getElementById('alertBadge');
  const count = getActiveConsultores().filter(c => getAlertaLegal(c).nivel !== 'ok').length;
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }
}

// ===== MODAL =====
function openModal(title, bodyHtml, footerHtml, wide) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml || '';
  const container = document.getElementById('modalContainer');
  container.className = wide ? 'modal wide' : 'modal';
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// ===== TOAST =====
function showToast(msg, type) {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'info');
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ===== CONSULTOR MODAL =====
function openModalConsultor(id) {
  const c = id ? getConsultor(id) : null;
  const title = c ? 'Editar Consultor' : 'Nuevo Consultor';
  const body = `
    <div class="form-group">
      <label>Nombre completo</label>
      <input class="form-control" id="fNombre" value="${c?c.nombre:''}" placeholder="Juan Pérez">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Cargo</label>
        <input class="form-control" id="fCargo" value="${c?c.cargo:''}" placeholder="Consultor Senior">
      </div>
      <div class="form-group">
        <label>Fecha de ingreso</label>
        <input class="form-control" id="fIngreso" type="date" value="${c?c.fechaIngreso:''}">
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarConsultor('${id||''}')">${c?'Guardar Cambios':'Crear Consultor'}</button>
  `;
  openModal(title, body, footer);
}

function guardarConsultor(id) {
  const nombre = document.getElementById('fNombre').value.trim();
  const cargo = document.getElementById('fCargo').value.trim();
  const fechaIngreso = document.getElementById('fIngreso').value;

  if (!nombre) { showToast('Ingresa el nombre del consultor', 'error'); return; }
  if (!fechaIngreso) { showToast('Ingresa la fecha de ingreso', 'error'); return; }

  if (id) {
    updateConsultor(id, { nombre, cargo, fechaIngreso });
    showToast('Consultor actualizado', 'success');
  } else {
    // defaults for a new manual consultant
    addConsultor({ 
      nombre, 
      cargo, 
      fechaIngreso,
      estado: 'activo',
      diasPendientesHR: 0,
      diasTruncos: 0
    });
    showToast('Consultor creado', 'success');
  }
  closeModal();
  navigateTo(currentView);
}

function confirmarEliminar(id, nombre) {
  openModal('Eliminar Consultor', `<p>¿Seguro que deseas eliminar a <strong>${nombre}</strong>? Se eliminarán también sus solicitudes.</p>`,
    `<button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="deleteConsultor('${id}');closeModal();navigateTo(currentView);showToast('Consultor eliminado','info')">Eliminar</button>`);
}

// ===== REGISTRO REAL MODAL =====
function openModalRegistroReal() {
  const cons = APP.consultores;
  if (cons.length === 0) { showToast('Primero agrega consultores', 'error'); return; }
  
  const sortedCons = [...cons].sort((a,b) => a.nombre.localeCompare(b.nombre));
  const opts = sortedCons.map(c => `<option value="${c.nombre}"></option>`).join('');
  
  const body = `
    <div class="form-group">
      <label>Consultor</label>
      <input list="consultores-list" class="form-control" id="fRealConsultorInput" placeholder="Escribe el nombre del consultor..." autocomplete="off">
      <datalist id="consultores-list">${opts}</datalist>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Día Inicial</label>
        <input class="form-control" id="fRealInicio" type="date" onchange="updateDiasPreview('fRealInicio', 'fRealFin', 'diasPreview')">
      </div>
      <div class="form-group">
        <label>Día Final</label>
        <input class="form-control" id="fRealFin" type="date" onchange="updateDiasPreview('fRealInicio', 'fRealFin', 'diasPreview')">
      </div>
    </div>
    <div id="diasPreview" style="margin-top:10px; font-weight:700; color:var(--accent); font-size:1.1rem">0 días seleccionados</div>
    <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px">Nota: El conteo es inclusivo. Si sale el 01 y vuelve a trabajar el 03, el día final a registrar debe ser el 02.</p>
  `;
  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarRegistroReal()">Registrar</button>
  `;
  openModal('Registrar Vacación Real', body, footer);
}

function updateDiasPreview(idInicio, idFin, idPreview) {
  const fInicio = document.getElementById(idInicio).value;
  const fFin = document.getElementById(idFin).value;
  const preview = document.getElementById(idPreview);
  if (!preview) return;
  
  if (fInicio && fFin) {
    if (new Date(fFin) < new Date(fInicio)) {
      preview.innerHTML = '<span style="color:var(--status-crit)">Fecha final inválida</span>';
    } else {
      const dias = calcDiffDias(fInicio, fFin);
      preview.innerText = `${dias} ${dias === 1 ? 'día seleccionado' : 'días seleccionados'}`;
    }
  } else {
    preview.innerText = '0 días seleccionados';
  }
}

function guardarRegistroReal() {
  const inputVal = document.getElementById('fRealConsultorInput').value;
  const cMatch = APP.consultores.find(x => x.nombre === inputVal);
  const cid = cMatch ? cMatch.id : null;

  const fInicio = document.getElementById('fRealInicio').value;
  const fFin = document.getElementById('fRealFin').value;
  
  if (!cid || !fInicio || !fFin) { showToast('Selecciona un consultor válido de la lista y completa las fechas', 'error'); return; }
  if (new Date(fFin) < new Date(fInicio)) { showToast('La fecha final no puede ser antes de la inicial', 'error'); return; }
  
  const c = getConsultor(cid);
  if (!c) return;
  if (!c.realVacations) c.realVacations = [];
  
  const diff = calcDiffDias(fInicio, fFin);
  c.realVacations.push({
    inicio: fInicio,
    fin: fFin,
    dias: diff,
    origen: 'Manual'
  });
  
  saveData(APP);
  showToast('Registro de gestión real añadido', 'success');
  closeModal();
  navigateTo(currentView);
}

function editarVacacionReal(cid, idx) {
  const c = getConsultor(cid);
  if (!c || !c.realVacations || !c.realVacations[idx]) return;
  const v = c.realVacations[idx];

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label>Día Inicial</label>
        <input class="form-control" id="fEditInicio" type="date" value="${v.inicio}" onchange="updateDiasPreview('fEditInicio', 'fEditFin', 'editDiasPreview')">
      </div>
      <div class="form-group">
        <label>Día Final</label>
        <input class="form-control" id="fEditFin" type="date" value="${v.fin}" onchange="updateDiasPreview('fEditInicio', 'fEditFin', 'editDiasPreview')">
      </div>
    </div>
    <div id="editDiasPreview" style="margin-top:10px; font-weight:700; color:var(--accent); font-size:1.1rem">${v.dias} ${v.dias === 1 ? 'día seleccionado' : 'días seleccionados'}</div>
  `;
  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarEdicionReal('${cid}', ${idx})">Guardar</button>
  `;
  openModal(`Editar Vacación — ${c.nombre}`, body, footer);
}

function guardarEdicionReal(cid, idx) {
  const c = getConsultor(cid);
  if (!c || !c.realVacations || !c.realVacations[idx]) return;
  
  const fInicio = document.getElementById('fEditInicio').value;
  const fFin = document.getElementById('fEditFin').value;
  
  if (!fInicio || !fFin) { showToast('Completa todos los campos', 'error'); return; }
  if (new Date(fFin) < new Date(fInicio)) { showToast('La fecha final no puede ser antes de la inicial', 'error'); return; }
  
  c.realVacations[idx].inicio = fInicio;
  c.realVacations[idx].fin = fFin;
  c.realVacations[idx].dias = calcDiffDias(fInicio, fFin);
  
  saveData(APP);
  showToast('Registro actualizado', 'success');
  closeModal();
  navigateTo(currentView);
  verDetalleConsultor(cid);
}

function eliminarVacacionReal(cid, idx) {
  const c = getConsultor(cid);
  if (!c || !c.realVacations || !c.realVacations[idx]) return;
  
  openModal('Eliminar Registro', '<p>¿Seguro que deseas eliminar este registro de vacaciones reales?</p>',
    `<button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="confirmarEliminarReal('${cid}', ${idx})">Eliminar</button>`
  );
}

function confirmarEliminarReal(cid, idx) {
  const c = getConsultor(cid);
  if (!c || !c.realVacations) return;
  c.realVacations.splice(idx, 1);
  saveData(APP);
  showToast('Registro eliminado', 'info');
  closeModal();
  navigateTo(currentView);
  verDetalleConsultor(cid);
}

// ===== SOLICITUD MODAL =====
function openModalSolicitud() {
  const cons = getActiveConsultores();
  if (cons.length === 0) { showToast('Primero agrega consultores', 'error'); return; }
  const opts = cons.map(c => `<option value="${c.id}">${c.nombre} (${calcDiasDisponibles(c)} días disp.)</option>`).join('');
  const body = `
    <div class="form-group">
      <label>Consultor</label>
      <select class="form-control" id="sCons">${opts}</select>
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select class="form-control" id="sTipo">
        <option value="descanso">🏖️ Descanso vacacional</option>
        <option value="venta">💰 Venta de vacaciones</option>
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Fecha inicio</label>
        <input class="form-control" id="sInicio" type="date">
      </div>
      <div class="form-group">
        <label>Fecha fin</label>
        <input class="form-control" id="sFin" type="date">
      </div>
    </div>
    <div class="form-group">
      <label>Notas</label>
      <input class="form-control" id="sNotas" placeholder="Observaciones (opcional)">
    </div>
    <div id="sValidation" style="margin-top:8px"></div>
  `;
  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarSolicitud()">Registrar Solicitud</button>
  `;
  openModal('Nueva Solicitud de Vacaciones', body, footer);
}

function guardarSolicitud() {
  const consultorId = document.getElementById('sCons').value;
  const tipo = document.getElementById('sTipo').value;
  const fechaInicio = document.getElementById('sInicio').value;
  const fechaFin = document.getElementById('sFin').value;
  const notas = document.getElementById('sNotas').value;
  const consultor = getConsultor(consultorId);

  if (!fechaInicio || !fechaFin) { showToast('Selecciona las fechas', 'error'); return; }
  const diasCalendario = calcDiffDias(fechaInicio, fechaFin);
  const errors = validarSolicitud(consultor, fechaInicio, fechaFin, tipo);

  if (errors.length > 0) {
    document.getElementById('sValidation').innerHTML = errors.map(e => `<div class="alert-card critical" style="padding:8px"><span class="alert-icon" style="font-size:1rem">⚠️</span><div class="alert-content"><p>${e}</p></div></div>`).join('');
    return;
  }

  addSolicitud({ consultorId, tipo, fechaInicio, fechaFin, diasCalendario, notas });
  showToast(`Solicitud de ${diasCalendario} días registrada`, 'success');
  closeModal();
  navigateTo(currentView);
}

function cambiarEstado(id, estado) {
  updateSolicitud(id, { estado });
  showToast('Estado actualizado a: ' + estado, 'success');
  navigateTo(currentView);
}

// ===== VENTA MODAL =====
function openModalVenta() {
  const cons = getActiveConsultores();
  if (cons.length === 0) { showToast('Primero agrega consultores', 'error'); return; }
  const opts = cons.map(c => {
    const vendidos = calcDiasVendidos(c.id);
    return `<option value="${c.id}">${c.nombre} (vendidos: ${vendidos}/15)</option>`;
  }).join('');
  const body = `
    <div class="form-group"><label>Consultor</label><select class="form-control" id="vCons" onchange="updateMontoVenta()">${opts}</select></div>
    <div class="form-row">
      <div class="form-group"><label>Días a vender (máx 15 por periodo)</label><input class="form-control" id="vDias" type="number" min="1" max="15" value="1" onchange="updateMontoVenta()"></div>
      <div class="form-group"><label>Monto compensación (S/)</label><input class="form-control" id="vMonto" type="number" step="0.01" readonly></div>
    </div>
    <div class="form-group"><label>Notas</label><input class="form-control" id="vNotas" placeholder="Referencia del acuerdo escrito"></div>
    <p class="legal-ref" style="margin-top:8px">DL 713 Art. 19: Requiere acuerdo escrito entre trabajador y empleador</p>
  `;
  const footer = `<button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-warning" onclick="guardarVenta()">Registrar Venta</button>`;
  openModal('Registrar Venta de Vacaciones', body, footer);
  setTimeout(updateMontoVenta, 100);
}

function updateMontoVenta() {
  const cid = document.getElementById('vCons')?.value;
  const dias = parseInt(document.getElementById('vDias')?.value) || 0;
  const c = getConsultor(cid);
  if (c && c.remuneracion) {
    const diario = c.remuneracion / 30;
    document.getElementById('vMonto').value = (diario * dias).toFixed(2);
  }
}

function guardarVenta() {
  const consultorId = document.getElementById('vCons').value;
  const dias = parseInt(document.getElementById('vDias').value) || 0;
  const monto = parseFloat(document.getElementById('vMonto').value) || 0;
  const notas = document.getElementById('vNotas').value;
  const c = getConsultor(consultorId);

  const yaVendidos = calcDiasVendidos(consultorId);
  if (yaVendidos + dias > 15) {
    showToast(`Excede el límite de 15 días. Ya vendió ${yaVendidos} días.`, 'error');
    return;
  }
  if (dias <= 0) { showToast('Ingresa días válidos', 'error'); return; }

  addVenta({ consultorId, dias, monto, notas });
  showToast(`Venta de ${dias} días registrada para ${c.nombre}`, 'success');
  closeModal();
  navigateTo(currentView);
}

// ===== ENHANCED EXCEL IMPORT =====
function handleFileUpload(file, type) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (json.length === 0) { showToast('El archivo está vacío', 'error'); return; }

      if (type === 'rrhh') processingRRHH(json, file.name);
      else if (type === 'verticales') processingVerticales(json, file.name);
      else if (type === 'real') processingReal(json, file.name);
      
    } catch(err) {
      showToast('Error al leer el archivo: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function processingRRHH(rows, filename) {
  // Extract date from filename (e.g. "Reporte 30.04.2026.xlsx", "30-04-2026", "20260430")
  let y, m, d;
  const m1 = filename.match(/(\d{4})[-_./]?(\d{2})[-_./]?(\d{2})/);
  if (m1 && m1[2] <= 12 && m1[3] <= 31) { y = m1[1]; m = m1[2]; d = m1[3]; }
  else {
    const m2 = filename.match(/(\d{2})[-_./]?(\d{2})[-_./]?(\d{4})/);
    if (m2 && m2[2] <= 12 && m2[1] <= 31) { d = m2[1]; m = m2[2]; y = m2[3]; }
    else {
      const m3 = filename.match(/(\d{2})[-_./]?(\d{2})[-_./]?(\d{2})(?!\d)/);
      if (m3 && m3[2] <= 12 && m3[1] <= 31) { d = m3[1]; m = m3[2]; y = "20" + m3[3]; }
    }
  }

  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  if (y && m && d) {
    APP.config.fechaActualizacion = `${parseInt(d, 10)} de ${months[parseInt(m, 10)-1]} de ${y}`;
  } else {
    // FALLBACK: If we still can't parse the date, just show the filename so the user can see it
    APP.config.fechaActualizacion = `${filename} (Fecha no detectada)`;
  }

  // Reporte RRHH (Gabin/Tawa) usually has headers on row 1 or 2
  // We'll skip the first few rows if they look like branding/headers
  let startIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].includes('ID') || rows[i].includes('NOMBRE COMPLETO')) {
      startIdx = i;
      break;
    }
  }
  
  const headers = rows[startIdx];
  const subHeaders = rows[startIdx + 1] || [];
  const dataRows = rows.slice(startIdx + 2);

  const cleanH = headers.map(h => String(h).trim().toUpperCase());
  const idxID = cleanH.findIndex(h => h === 'ID' || h.includes('CÓDIGO'));
  const idxNombre = cleanH.findIndex(h => h.includes('NOMBRE COMPLETO') || h.includes('APELLIDOS Y NOMBRES') || h === 'NOMBRE');
  const idxIngreso = cleanH.findIndex(h => h.includes('FECHA INGRESO') || h.includes('INGRESO'));
  const idxVigentes = cleanH.findIndex(h => h === 'N° DE DÍAS' || h.includes('VIGENTES') || h.includes('PENDIENTES'));
  const idxMaxSalida = cleanH.findIndex(h => h.includes('MAX. DE SALIDA') || h.includes('VENCIMIENTO'));
  const idxTruncos = headers.findIndex((h, i) => String(h).toUpperCase() === 'N° DE DÍAS' && String(subHeaders[i]).toUpperCase() === 'TRUNCOS');
  
  let updated = 0, created = 0;
  const now = new Date().toISOString();
  
  const processedConsultores = new Set();

  dataRows.forEach(row => {
    const id = String(row[idxID] || '').trim();
    const nombre = String(row[idxNombre] || '').trim();
    if (!nombre) return;

    const vigentes = parseFloat(row[idxVigentes]) || 0;
    const parseDate = (val) => {
      if (!val) return '';
      if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().slice(0,10);
      if (typeof val === 'string') {
        const s = val.trim().split(' ')[0]; // Remove time if present
        const parts = s.split(/[\/-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) return s; // YYYY-MM-DD
          return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      }
      try { 
        const d = new Date(val);
        if (!isNaN(d)) return d.toISOString().slice(0, 10);
      } catch(e) {}
      return String(val);
    };

    let maxSalida = parseDate(row[idxMaxSalida]);
    const truncos = idxTruncos >= 0 ? parseFloat(row[idxTruncos]) || 0 : 0;
    let fechaIngreso = parseDate(row[idxIngreso]);

    // Fallback date logic
    if (!maxSalida && fechaIngreso && vigentes > 0) {
      const dIng = new Date(fechaIngreso);
      const hoy = new Date();
      const ant = calcAntiguedad(fechaIngreso);
      if (ant.years >= 1) {
        // "mes anterior de su fecha de ingreso para el año en curso"
        const mesIng = dIng.getMonth();
        let targetMonth = mesIng - 1;
        let targetYear = hoy.getFullYear();
        if (targetMonth < 0) { targetMonth = 11; targetYear--; }
        
        const lastDay = new Date(targetYear, targetMonth + 1, 0);
        maxSalida = lastDay.toISOString().slice(0, 10);
      }
    }

    let existing = APP.consultores.find(c => c.idGabin === id || c.nombre.toLowerCase() === nombre.toLowerCase());

    if (existing) {
      existing.idGabin = id;
      existing.diasPendientesHR = vigentes;
      existing.diasTruncos = truncos;
      existing.fechaMaxGabin = maxSalida;
      existing.fechaUltimaImportacion = now;
      if (fechaIngreso) existing.fechaIngreso = fechaIngreso;
      updated++;
    } else {
      existing = {
        id: uid(),
        idGabin: id,
        nombre,
        cargo: 'Consultor',
        fechaIngreso: fechaIngreso || new Date().toISOString().slice(0,10),
        estado: 'activo',
        diasPendientesHR: vigentes,
        diasTruncos: truncos,
        fechaMaxGabin: maxSalida,
        realVacations: []
      };
      APP.consultores.push(existing);
      created++;
    }
    
    processedConsultores.add(existing.id);

    // Auto-assign vertical from dictionary
    if (APP.config.verticalesDict) {
      const dictEntry = APP.config.verticalesDict[id] || 
                        APP.config.verticalesDict[nombre.toLowerCase().trim()];
      if (dictEntry) {
        existing.vertical = dictEntry;
      }
    }
  });

  // Remove consultants that are NO LONGER in the new Gabin snapshot
  const initialCount = APP.consultores.length;
  APP.consultores = APP.consultores.filter(c => processedConsultores.has(c.id));
  const removed = initialCount - APP.consultores.length;

  // Snapshot for history
  const snapshot = dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if(h) obj[h] = row[i]; });
    return { _raw: obj };
  });

  // Remove previous Gabin import from history log
  APP.importaciones = APP.importaciones.filter(imp => imp.tipo !== 'RRHH Gabin');

  APP.importaciones.push({
    id: uid(),
    fecha: now,
    timestampLocal: new Date().toLocaleString('es-PE'),
    archivo: filename,
    tipo: 'RRHH Gabin',
    registros: dataRows.length,
    updated,
    created,
    datos: snapshot
  });
  saveData(APP);
  showToast(`RRHH: ${created} nuevos, ${updated} act., ${removed} cesados/removidos`, 'success');
  navigateTo('importar');
}

function processingVerticales(rows, filename) {
  // Find header row (it might not be the first one)
  let headerRowIndex = -1;
  let headers = [];
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i].map(h => String(h || '').trim().toLowerCase());
    if (row.some(h => h.includes('cód') || h.includes('emp') || h.includes('vertical') || h.includes('equipo'))) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) {
    showToast(`Error: No se detectaron las columnas necesarias en las primeras 5 filas.`, 'error');
    return;
  }

  const idxID = headers.findIndex(h => h.includes('cód') || h.includes('cod') || h.includes('emp') || h === 'id');
  const idxNombre = headers.findIndex(h => h.includes('nombre') || h.includes('completo'));
  const idxVertical = headers.findIndex(h => h.includes('vertical') || h.includes('equipo') || h.includes('area') || h.includes('unidad'));

  if (idxID === -1 || idxVertical === -1) {
    showToast(`Error: No se encontró ID o Vertical. Columnas: ${headers.filter(h=>h).join(', ')}`, 'error');
    return;
  }

  let updated = 0;
  let skipped = 0;
  if (!APP.config.verticalesDict) APP.config.verticalesDict = {};
  
  rows.slice(headerRowIndex + 1).forEach(row => {
    const id = String(row[idxID] || '').trim();
    const nombre = String(row[idxNombre] || '').trim();
    const vert = String(row[idxVertical] || '').trim();
    
    if (!vert) return;

    // Save to persistent dictionary
    if (id) APP.config.verticalesDict[id] = vert;
    // Also save without leading zeros if numeric
    const idNoZeros = id.replace(/^0+/, '');
    if (idNoZeros && idNoZeros !== id) APP.config.verticalesDict[idNoZeros] = vert;
    
    if (nombre) APP.config.verticalesDict[nombre.toLowerCase().trim()] = vert;

    // Also update existing consultants immediately
    const existing = APP.consultores.find(c => {
      const cId = String(c.idGabin || '').trim();
      const cIdNoZeros = cId.replace(/^0+/, '');
      const matchId = id && (cId === id || cIdNoZeros === id || cId === idNoZeros);
      const matchName = nombre && c.nombre.toLowerCase().trim() === nombre.toLowerCase().trim();
      return matchId || matchName;
    });

    if (existing) {
      existing.vertical = vert;
      updated++;
    } else {
      skipped++;
    }
  });

  // Snapshot for history
  const snapshot = rows.slice(headerRowIndex + 1).map(row => {
    const obj = {};
    rows[headerRowIndex].forEach((h, i) => { if(h) obj[h] = row[i]; });
    return { _raw: obj };
  });

  // Remove previous Verticales import from history log
  APP.importaciones = APP.importaciones.filter(imp => imp.tipo !== 'Verticales');

  APP.importaciones.push({
    id: uid(),
    fecha: new Date().toISOString(),
    timestampLocal: new Date().toLocaleString('es-PE'),
    archivo: filename,
    tipo: 'Verticales',
    registros: rows.length - 1,
    updated,
    created: 0,
    datos: snapshot
  });

  saveData(APP);
  showToast(`Verticales: ${updated} actualizadas, ${skipped} no encontrados`, updated > 0 ? 'success' : 'info');
  navigateTo('importar');
}

function processingReal(rows, filename) {
  let y, m, d;
  const m1 = filename.match(/(\d{4})[-_./]?(\d{2})[-_./]?(\d{2})/);
  if (m1 && m1[2] <= 12 && m1[3] <= 31) { y = m1[1]; m = m1[2]; d = m1[3]; }
  else {
    const m2 = filename.match(/(\d{2})[-_./]?(\d{2})[-_./]?(\d{4})/);
    if (m2 && m2[2] <= 12 && m2[1] <= 31) { d = m2[1]; m = m2[2]; y = m2[3]; }
  }

  if (y && m && d) {
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    APP.config.fechaRealActualizacion = `${parseInt(d, 10)} de ${months[parseInt(m, 10)-1]} de ${y}`;
  }

  const headers = rows[0].map(h => String(h||'').toLowerCase().trim());
  const idxID = headers.findIndex(h => h.includes('cod') || h.includes('id'));
  const idxNombre = headers.findIndex(h => (h.includes('nombre') || h.includes('consultor') || h.includes('empleado')) && !h.includes('cod'));
  const idxInicio = headers.findIndex(h => h.includes('inicio'));
  const idxFin = headers.findIndex(h => h.includes('fin'));
  const idxDias = headers.findIndex(h => h.includes('dias') || h.includes('contador'));

  // Clear previously imported real vacations, but keep manual ones
  APP.consultores.forEach(c => {
    if (c.realVacations) {
      c.realVacations = c.realVacations.filter(v => v.origen === 'Manual');
    }
  });

  const updatedConsultores = new Set();

  rows.slice(1).forEach(row => {
    const id = idxID >= 0 ? String(row[idxID] || '').trim() : '';
    const nombre = idxNombre >= 0 ? String(row[idxNombre] || '').trim() : '';
    
    if (!id && !nombre) return;
    
    let fIni = row[idxInicio];
    let fFin = row[idxFin];
    
    // Parse Excel dates with support for DD/MM/YYYY
    const parseDate = (val) => {
      if (!val) return null;
      if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000).toISOString().slice(0,10);
      if (typeof val === 'string') {
        const parts = val.split(/[\/-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) return val; // YYYY-MM-DD
          return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      }
      try { return new Date(val).toISOString().slice(0,10); } catch(e) { return null; }
    };

    fIni = parseDate(fIni);
    fFin = parseDate(fFin);

    let dias = parseFloat(row[idxDias]) || 0;
    if (fIni && fFin) {
      dias = calcDiffDias(fIni, fFin);
    }

    // Match by Name or ID
    const existing = APP.consultores.find(c => {
      const matchName = nombre && c.nombre.toLowerCase() === nombre.toLowerCase();
      
      const cId = String(c.idGabin || '').trim();
      const cIdNoZeros = cId.replace(/^0+/, '');
      const idNoZeros = id.replace(/^0+/, '');
      const matchId = id && (cId === id || cIdNoZeros === id || cId === idNoZeros || (cIdNoZeros && cIdNoZeros === idNoZeros));
      
      return matchName || matchId;
    });

    if (existing) {
      if (!existing.realVacations) existing.realVacations = [];
      existing.realVacations.push({
        inicio: fIni,
        fin: fFin,
        dias: dias,
        origen: 'Importación Real'
      });
      updatedConsultores.add(existing.id);
    }
  });

  const updated = updatedConsultores.size;

  // Snapshot for history
  const snapshot = rows.slice(1).map(row => {
    const obj = {};
    rows[0].forEach((h, i) => { if(h) obj[h] = row[i]; });
    return { _raw: obj };
  });

  // Remove previous Gestión Real import from history log
  APP.importaciones = APP.importaciones.filter(imp => imp.tipo !== 'Gestión Real');

  APP.importaciones.push({
    id: uid(),
    fecha: new Date().toISOString(),
    timestampLocal: new Date().toLocaleString('es-PE'),
    archivo: filename,
    tipo: 'Gestión Real',
    registros: rows.length - 1,
    updated,
    created: 0,
    datos: snapshot
  });

  saveData(APP);
  showToast(`Gestión Real cargada para ${updated} consultores`, 'success');
  navigateTo('importar');
}

// ===== IMPORT HISTORY FUNCTIONS =====
function getTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} minuto${mins > 1 ? 's' : ''}`;
  if (hrs < 24) return `Hace ${hrs} hora${hrs > 1 ? 's' : ''}`;
  if (days < 30) return `Hace ${days} día${days > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  return `Hace ${months} mes${months > 1 ? 'es' : ''}`;
}

function verDatosImportacion(impId) {
  const imp = APP.importaciones.find(i => i.id === impId) ||
              APP.importaciones[parseInt(impId)];
  if (!imp) { showToast('Importación no encontrada', 'error'); return; }

  const fechaStr = imp.timestampLocal || new Date(imp.fecha).toLocaleString('es-PE', { dateStyle: 'full', timeStyle: 'medium' });
  const datos = imp.datos || [];

  let tableHtml = '';
  if (datos.length > 0 && datos[0]._raw) {
    const cols = Object.keys(datos[0]._raw);
    tableHtml = `<div class="preview-table" style="max-height:400px">
      <table>
        <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${datos.map(d => `<tr>${cols.map(c => `<td>${d._raw[c] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
  } else if (datos.length > 0) {
    tableHtml = `<div class="preview-table" style="max-height:400px">
      <table>
        <thead><tr><th>Nombre</th><th>Días Pendientes</th><th>Cargo</th></tr></thead>
        <tbody>${datos.map(d => `<tr><td>${d.nombre}</td><td>${d.diasPendientes}</td><td>${d.cargo || '—'}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  } else {
    tableHtml = '<div class="empty-state"><div class="empty-icon">📄</div><h4>Sin datos almacenados</h4><p>Esta importación no tiene datos guardados (importación anterior a la actualización)</p></div>';
  }

  const body = `
    <div style="margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><span style="color:var(--text-muted);font-size:0.78rem">Archivo</span><br><strong>📄 ${imp.archivo}</strong></div>
        <div><span style="color:var(--text-muted);font-size:0.78rem">Fecha y hora de carga</span><br><strong>🕐 ${fechaStr}</strong></div>
        <div><span style="color:var(--text-muted);font-size:0.78rem">Total registros</span><br><strong>${imp.registros}</strong></div>
        <div><span style="color:var(--text-muted);font-size:0.78rem">Resultado</span><br>
          ${imp.created != null ? `<span class="status green">${imp.created} creados</span> ` : ''}
          ${imp.updated != null ? `<span class="status blue">${imp.updated} actualizados</span>` : ''}
        </div>
      </div>
    </div>
    <div class="section-title" style="margin-top:16px">Datos Cargados (${datos.length} registros)</div>
    ${tableHtml}
  `;

  const footer = `
    <button class="btn btn-outline" onclick="exportarImportacionCSV('${impId}')">📊 Exportar CSV</button>
    <button class="btn btn-primary" onclick="closeModal()">Cerrar</button>
  `;
  openModal(`📂 Importación — ${imp.archivo}`, body, footer, true);
}

function eliminarImportacion(impId) {
  const idx = APP.importaciones.findIndex(i => i.id === impId);
  if (idx >= 0) {
    APP.importaciones.splice(idx, 1);
  } else {
    const numIdx = parseInt(impId);
    if (numIdx >= 0 && numIdx < APP.importaciones.length) {
      APP.importaciones.splice(numIdx, 1);
    }
  }
  saveData(APP);
  showToast('Registro de importación eliminado', 'info');
  navigateTo('importar');
}

function exportarImportacionCSV(impId) {
  const imp = APP.importaciones.find(i => i.id === impId) ||
              APP.importaciones[parseInt(impId)];
  if (!imp || !imp.datos || imp.datos.length === 0) { showToast('Sin datos para exportar', 'error'); return; }

  let csv = '';
  if (imp.datos[0]._raw) {
    const cols = Object.keys(imp.datos[0]._raw);
    csv = cols.join(',') + '\n';
    imp.datos.forEach(d => {
      csv += cols.map(c => `"${String(d._raw[c] ?? '').replace(/"/g, '""')}"`).join(',') + '\n';
    });
  } else {
    csv = 'Nombre,Días Pendientes,Cargo\n';
    imp.datos.forEach(d => { csv += `"${d.nombre}",${d.diasPendientes},"${d.cargo || ''}"\n`; });
  }

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `importacion_${new Date(imp.fecha).toISOString().slice(0,10)}_${imp.archivo.replace(/\.[^.]+$/,'')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado', 'success');
}

// ===== RESTORE BACKUP =====
function handleRestoreBackup(file) {
  if (!file) return;
  importarJSON(file).then(() => {
    showToast('Backup restaurado exitosamente', 'success');
    navigateTo('dashboard');
  }).catch(err => showToast('Error: ' + err, 'error'));
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  // Close modal on overlay click
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Close modal on Escape
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Initial render
  navigateTo('dashboard');
});
