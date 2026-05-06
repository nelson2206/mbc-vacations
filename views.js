function getInitials(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function shortenName(fullName) {
  if (!fullName) return '';
  const parts = fullName.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    // Format: SURNAMES, NAMES
    const surnames = parts[0].split(' ');
    const names = parts[1].split(' ');
    return `${names[0]} ${surnames[0]}`;
  }
  const words = fullName.split(' ').filter(Boolean);
  if (words.length >= 2) return `${words[0]} ${words[1]}`;
  return fullName;
}

function renderDashboard() {
  const consFull = getActiveConsultores();
  const verticals = [...new Set(consFull.map(c => c.vertical).filter(Boolean))].sort();
  const currentVertical = APP.config.filtroVertical || 'Todos';
  
  const cons = currentVertical === 'Todos' ? consFull : consFull.filter(c => c.vertical === currentVertical);
  
  const totalDias = cons.reduce((s,c) => s + calcDiasGabin(c), 0);
  const hoy = new Date().toISOString().slice(0,10);
  const enVacHoy = APP.solicitudes.filter(s => {
    const c = getConsultor(s.consultorId);
    return s.estado==='aprobado' && s.fechaInicio <= hoy && s.fechaFin >= hoy && (currentVertical === 'Todos' || (c && c.vertical === currentVertical));
  }).length;

  // Classify consultants by risk level
  const criticos = cons.filter(c => getAlertaLegal(c).nivel === 'critical');
  const medios = cons.filter(c => getAlertaLegal(c).nivel === 'warning');
  const negras = cons.filter(c => calcDiasGozadosGabin(c) > calcDiasGozadosReales(c.id));
  
  const pctCrit = cons.length ? Math.round((criticos.length / cons.length) * 100) : 0;
  const pctMed = cons.length ? Math.round((medios.length / cons.length) * 100) : 0;
  const pctNegras = cons.length ? Math.round((negras.length / cons.length) * 100) : 0;

  function renderNegraCard(c) {
    const deuda = calcDiasGozadosGabin(c) - calcDiasGozadosReales(c.id);
    return `<div class="risk-person-card risk-safe" onclick="verDetalleConsultor('${c.id}')" style="cursor:pointer; border-left: 4px solid var(--accent)">
      <div class="risk-avatar" style="background:var(--bg-panel); color:var(--accent)">${getInitials(c.nombre)}</div>
      <div class="risk-person-info">
        <div class="risk-person-name">${shortenName(c.nombre)}</div>
        <div class="risk-person-cargo">${c.vertical || c.cargo}</div>
        <div style="font-size:0.65rem;margin-top:2px;color:var(--text-muted)"><strong>Deuda registrada</strong></div>
      </div>
      <div class="risk-person-days">
        <span class="risk-days-number" style="color:var(--accent)">+${Math.round(deuda)}</span>
        <span class="risk-days-label">días deuda</span>
      </div>
    </div>`;
  }

  function renderRiskCard(c) {
    const disp = calcDiasGabin(c);
    const al = getAlertaLegal(c);
    const cls = al.nivel === 'critical' ? 'crit' : al.nivel === 'warning' ? 'warn' : 'safe';
    const colors = { crit: '#ef4444', warn: '#f59e0b', safe: '#10b981' };
    const fechaMax = c.fechaMaxGabin ? `<div style="font-size:0.65rem;margin-top:2px;color:var(--text-muted)">Max Gabin: <strong>${c.fechaMaxGabin}</strong></div>` : '';
    
    return `<div class="risk-person-card risk-${cls}" onclick="verDetalleConsultor('${c.id}')" style="cursor:pointer">
      <div class="risk-avatar">${getInitials(c.nombre)}</div>
      <div class="risk-person-info">
        <div class="risk-person-name">${shortenName(c.nombre)}</div>
        <div class="risk-person-cargo">${c.vertical || c.cargo}</div>
        ${fechaMax}
      </div>
      <div class="risk-person-days">
        <span class="risk-days-number">${disp}</span>
        <span class="risk-days-label">días Gabin</span>
      </div>
    </div>`;
  }

  return `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h2>📊 Dashboard</h2>
        <p>Resumen general del equipo — ${APP.config.fechaActualizacion || new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        <button onclick="cambiarFiltroVertical('Todos')" style="padding:6px 14px;border-radius:20px;border:1.5px solid ${currentVertical==='Todos'?'var(--bg-panel)':'var(--border)'};background:${currentVertical==='Todos'?'var(--bg-panel)':'transparent'};color:${currentVertical==='Todos'?'white':'var(--text-on-light)'};font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.2s">Todas</button>
        ${verticals.map(v => `<button onclick="cambiarFiltroVertical('${v}')" style="padding:6px 14px;border-radius:20px;border:1.5px solid ${v===currentVertical?'var(--bg-panel)':'var(--border)'};background:${v===currentVertical?'var(--bg-panel)':'transparent'};color:${v===currentVertical?'white':'var(--text-on-light)'};font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.2s">${v}</button>`).join('')}
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="card stat-card accent">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${cons.length}</div>
        <div class="stat-label">Consultores</div>
      </div>
      <div class="card stat-card success">
        <div class="stat-icon">🏖️</div>
        <div class="stat-value">${enVacHoy}</div>
        <div class="stat-label">En vacaciones hoy</div>
      </div>
      <div class="card stat-card warning">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${Math.round(totalDias)}</div>
        <div class="stat-label">Días pendientes (Gabin)</div>
      </div>
      <div class="card stat-card danger">
        <div class="stat-icon">⚠️</div>
        <div class="stat-value">${criticos.length + medios.length}</div>
        <div class="stat-label">Alertas activas</div>
      </div>
    </div>

    <!-- ===== SEMÁFORO DE RIESGO ===== -->
    <div class="section slide-up">
      <div class="section-title">🚦 Semáforo de Riesgo — Vacaciones por Vencer (DL 713 Art. 23)</div>
      ${cons.length === 0 ?
        '<div class="card"><div class="empty-state"><div class="empty-icon">🚦</div><h4>Sin consultores</h4><p>Importa los archivos de RRHH para activar el semáforo</p></div></div>' :
        `<div class="risk-grid" style="align-items:start">
          <!-- CRÍTICO -->
          <div class="risk-column risk-col-critical">
            <div class="risk-column-header risk-header-critical">
              <div class="risk-header-icon">🔴</div>
              <div class="risk-header-text">
                <h4>Crítico</h4>
                <p>Triple vacacional inminente</p>
              </div>
              <div class="risk-header-count">
                <span class="risk-count">${criticos.length}</span>
                <span class="risk-pct">${pctCrit}%</span>
              </div>
            </div>
            <div class="risk-column-body">
              ${criticos.length === 0 ?
                '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.8rem">✅ Sin casos críticos</div>' :
                criticos.map(renderRiskCard).join('')}
            </div>
          </div>

          <!-- MEDIO -->
          <div class="risk-column risk-col-warning">
            <div class="risk-column-header risk-header-warning">
              <div class="risk-header-icon">🟡</div>
              <div class="risk-header-text">
                <h4>Atención</h4>
                <p>Programar pronto</p>
              </div>
              <div class="risk-header-count">
                <span class="risk-count">${medios.length}</span>
                <span class="risk-pct">${pctMed}%</span>
              </div>
            </div>
            <div class="risk-column-body">
              ${medios.length === 0 ?
                '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.8rem">👍 Sin alertas medias</div>' :
                medios.map(renderRiskCard).join('')}
            </div>
          </div>

          <!-- VACACIONES NEGRAS -->
          <div class="risk-column risk-col-safe" style="border-top-color: var(--accent);">
            <div class="risk-column-header risk-header-safe" style="background: rgba(76, 17, 31, 0.05); color: var(--accent);">
              <div class="risk-header-icon" style="background: var(--accent); color: white;">🖤</div>
              <div class="risk-header-text">
                <h4 style="color: var(--accent);">Vacaciones Negras</h4>
                <p>Deuda por días trabajados</p>
              </div>
              <div class="risk-header-count">
                <span class="risk-count" style="color: var(--accent);">${negras.length}</span>
                <span class="risk-pct" style="color: var(--accent); opacity:0.7;">${pctNegras}%</span>
              </div>
            </div>
            <div class="risk-column-body">
              ${negras.length === 0 ?
                '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.8rem">✅ Cero deuda vacacional</div>' :
                negras.map(renderNegraCard).join('')}
            </div>
          </div>
        </div>`}
    </div>

    <!-- ===== TABLA DE CONCILIACIÓN EXPANDIDA ===== -->
    <div class="section slide-up" style="margin-top:40px">
      <div class="section-title">📊 Conciliación Detallada: Gabin vs Real (Vista Expandida)</div>
      <div class="card" style="padding:0; overflow:hidden">
        ${cons.length === 0 ? '<div class="empty-state"><div class="empty-icon">👥</div><h4>Sin consultores</h4></div>' :
          `<div class="table-container" style="max-height: 800px; overflow-y: auto;">
            <table style="width:100%">
            <thead style="position:sticky; top:0; z-index:10; background:var(--bg-panel-alt)">
              <tr>
                <th style="padding:20px">Consultor</th>
                <th>Vertical</th>
                <th>Saldo Gabin (Vigente)</th>
                <th>Días Truncos</th>
                <th>Gozados Gabin (Histórico)</th>
                <th>Gozados Real (Gestión)</th>
                <th>Diferencia (Deuda)</th>
                <th>Estado Legal</th>
              </tr>
            </thead>
            <tbody>${cons.map(c => {
              const dispGabin = calcDiasGabin(c);
              const gozGabin = calcDiasGozadosGabin(c);
              const gozReal = calcDiasGozadosReales(c.id);
              const diff = gozGabin - gozReal;
              const truncos = c.diasTruncos || 0;
              const truncosDisplay = truncos % 1 === 0 ? truncos : Number(truncos).toFixed(2);
              const al = getAlertaLegal(c);
              const cls = al.nivel === 'critical' ? 'red' : al.nivel === 'warning' ? 'yellow' : 'green';
              return `<tr onclick="verDetalleConsultor('${c.id}')" style="cursor:pointer; height:80px">
                <td style="padding:15px 20px"><strong>${shortenName(c.nombre)}</strong></td>
                <td><span style="color:var(--text-muted);font-size:0.85rem">${c.vertical || c.cargo}</span></td>
                <td><strong style="font-size:1.1rem">${Math.round(dispGabin)}</strong></td>
                <td><span style="color:var(--text-muted); font-size:1rem">${truncosDisplay}</span></td>
                <td><span style="color:var(--bg-panel); font-weight:700">${Math.round(gozGabin)}</span></td>
                <td><strong style="font-size:1.1rem; color:var(--accent)">${Math.round(gozReal)}</strong></td>
                <td>
                  <span style="font-weight:800; font-size:1.15rem; color:${diff > 0 ? 'var(--accent)' : diff < 0 ? 'var(--danger)' : 'var(--success)'}">
                    ${diff > 0 ? '+' + Math.round(diff) : Math.round(diff)}
                  </span>
                </td>
                <td><span class="status ${cls}" style="padding:8px 18px; font-size:0.85rem; min-width:100px; text-align:center">${al.nivel === 'critical' ? 'Crítico' : al.nivel === 'warning' ? 'Atención' : 'Al día'}</span></td>
              </tr>`;
            }).join('')}</tbody></table></div>`}
      </div>
    </div>
  `;
}

function renderConsultores() {
  const cons = APP.consultores;
  return `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h2><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>Consultores</h2><p>Gestión del equipo de consultoría</p></div>
      <div style="display:flex; gap:12px">
        <button class="btn btn-outline" onclick="openModalRegistroReal()" style="display:flex; align-items:center; gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Registrar Vacación
        </button>
        <button class="btn btn-primary" onclick="openModalConsultor()" style="display:flex; align-items:center; gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nuevo Consultor
        </button>
      </div>
    </div>
    ${cons.length === 0 ? '<div class="card"><div class="empty-state"><div class="empty-icon">👥</div><h4>No hay consultores registrados</h4><p>Agrega consultores manualmente o importa desde un Excel de RRHH</p></div></div>' :
      `<div class="card"><div class="table-container"><table>
        <thead><tr><th>Nombre</th><th>Vertical</th><th>Ingreso</th><th>Antigüedad</th><th>Días HR</th><th>Disponibles</th><th>Alerta</th><th style="text-align:right">Acciones</th></tr></thead>
        <tbody>${cons.map(c => {
          const ant = calcAntiguedad(c.fechaIngreso);
          const disp = calcDiasDisponibles(c);
          const al = getAlertaLegal(c);
          const cls = al.nivel==='critical'?'red':al.nivel==='warning'?'yellow':'green';
          return `<tr style="${c.estado==='cesado'?'opacity:0.5':''}">
            <td><strong style="color:var(--bg-panel)">${c.nombre}</strong></td>
            <td><span style="color:var(--text-muted);font-size:0.85rem">${c.cargo || 'Consultor'}</span></td>
            <td>${c.fechaIngreso}</td>
            <td>${ant.years}a ${ant.months}m</td>
            <td>${c.diasPendientesHR || '—'}</td>
            <td><strong style="font-size:1.1rem">${Math.round(disp)}</strong></td>
            <td><span class="status ${cls}" style="padding:6px 12px; font-size:0.75rem">${al.nivel==='critical'?'Crítico':al.nivel==='warning'?'Atención':'OK'}</span></td>
            <td style="text-align:right">
              <div style="display:flex; gap:8px; justify-content:flex-end">
                <button class="btn btn-outline btn-sm" onclick="openModalConsultor('${c.id}')" title="Editar" style="padding:6px; border-color:transparent; background:rgba(76,17,31,0.05); color:var(--bg-panel)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn btn-outline btn-sm" onclick="confirmarEliminar('${c.id}','${c.nombre}')" title="Eliminar" style="padding:6px; border-color:transparent; background:rgba(220,38,38,0.1); color:#dc2626">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody></table></div></div>`}
  `;
}

function renderImportar() {
  return `
    <div class="page-header">
      <h2>📤 Importación de Datos</h2>
      <p>Carga los archivos mensuales de RRHH, Verticales y Gestión Real</p>
    </div>
    
    <div class="grid-3" style="margin-bottom:24px">
      <!-- OFICIAL RRHH -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between; border: 1px solid var(--bg-panel-alt)">
        <div>
          <div style="font-size:2rem;margin-bottom:12px">🏢</div>
          <h3 style="margin-bottom:8px; color:var(--bg-panel)">Reporte RRHH (Gabin)</h3>
          <p style="font-size:0.85rem;color:var(--bg-panel);opacity:0.7;margin-bottom:16px; font-weight:500">Días oficiales, truncos y fecha máxima de salida.</p>
        </div>
        <div class="upload-zone" style="padding:20px 10px; border-style:dashed; border-width:2px; border-color:var(--bg-panel-alt)">
          <input type="file" style="opacity:1;position:static;width:100%" onchange="handleFileUpload(this.files[0], 'rrhh')">
        </div>
      </div>

      <!-- VERTICALES -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between; border: 1px solid var(--bg-panel-alt)">
        <div>
          <div style="font-size:2rem;margin-bottom:12px">🏗️</div>
          <h3 style="margin-bottom:8px; color:var(--bg-panel)">Verticales / Equipos</h3>
          <p style="font-size:0.85rem;color:var(--bg-panel);opacity:0.7;margin-bottom:16px; font-weight:500">Mapeo de consultores a sus respectivos equipos.</p>
        </div>
        <div class="upload-zone" style="padding:20px 10px; border-style:dashed; border-width:2px; border-color:var(--bg-panel-alt)">
          <input type="file" style="opacity:1;position:static;width:100%" onchange="handleFileUpload(this.files[0], 'verticales')">
        </div>
      </div>

      <!-- GESTION REAL -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between; border: 1px solid var(--bg-panel-alt)">
        <div>
          <div style="font-size:2rem;margin-bottom:12px">✅</div>
          <h3 style="margin-bottom:8px; color:var(--bg-panel)">Gestión Real</h3>
          <p style="font-size:0.85rem;color:var(--bg-panel);opacity:0.7;margin-bottom:16px; font-weight:500">Días reales tomados (aunque sean menos de 7 días).</p>
        </div>
        <div class="upload-zone" style="padding:20px 10px; border-style:dashed; border-width:2px; border-color:var(--bg-panel-alt)">
          <input type="file" style="opacity:1;position:static;width:100%" onchange="handleFileUpload(this.files[0], 'real')">
        </div>
      </div>
    </div>
    
    <div id="previewArea" style="margin-top:16px"></div>

    ${APP.importaciones.length > 0 ? `
    <div class="card" style="margin-top:16px">
      <div class="section-title">
        <span>📂 Historial de Bases de Datos Cargadas (${APP.importaciones.length})</span>
      </div>
      <div class="table-container"><table>
        <thead><tr>
          <th>#</th>
          <th>Fecha y Hora de Carga</th>
          <th>Archivo</th>
          <th>Tipo</th>
          <th>Registros</th>
          <th>Acciones</th>
        </tr></thead>
        <tbody>${[...APP.importaciones].reverse().map((imp, idx) => {
          const fechaObj = new Date(imp.fecha);
          const fechaStr = imp.timestampLocal || fechaObj.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'medium' });
          const timeAgo = getTimeAgo(fechaObj);
          return `<tr>
            <td><span style="color:var(--text-muted);font-weight:600">${APP.importaciones.length - idx}</span></td>
            <td>
              <strong>${fechaStr}</strong>
              <br><span style="font-size:0.72rem;color:var(--text-muted)">${timeAgo}</span>
            </td>
            <td>📄 ${imp.archivo}</td>
            <td><span class="status ${imp.tipo==='RRHH Gabin'?'blue':imp.tipo==='Verticales'?'green':'yellow'}">${imp.tipo || 'General'}</span></td>
            <td><strong>${imp.registros}</strong></td>
            <td>
              <div class="btn-group">
                <button class="btn btn-outline btn-sm" onclick="verDatosImportacion('${imp.id || idx}')">👁️ Ver</button>
                <button class="btn btn-outline btn-sm" onclick="eliminarImportacion('${imp.id || idx}')">🗑️</button>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>` : ''}
  `;
}

function renderAlertas() {
  const cons = getActiveConsultores();
  const criticos = cons.filter(c => getAlertaLegal(c).nivel === 'critical');
  const warnings = cons.filter(c => getAlertaLegal(c).nivel === 'warning');
  const ok = cons.filter(c => getAlertaLegal(c).nivel === 'ok');

  return `
    <div class="page-header"><h2>⚠️ Alertas de Cumplimiento Legal</h2><p>Monitoreo de riesgos según DL 713 — Triple Vacacional</p></div>
    <div class="stats-grid">
      <div class="card stat-card danger"><div class="stat-icon">🔴</div><div class="stat-value">${criticos.length}</div><div class="stat-label">Riesgo Triple Vacacional</div></div>
      <div class="card stat-card warning"><div class="stat-icon">🟡</div><div class="stat-value">${warnings.length}</div><div class="stat-label">Requieren atención</div></div>
      <div class="card stat-card success"><div class="stat-icon">🟢</div><div class="stat-value">${ok.length}</div><div class="stat-label">Al día</div></div>
    </div>
    <div class="card">
      <div class="section-title">Detalle por Consultor</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${cons.map(c => {
          const al = getAlertaLegal(c);
          return `<div class="alert-card ${al.nivel}" onclick="verDetalleConsultor('${c.id}')" style="cursor:pointer">
            <span class="alert-icon">${al.nivel==='critical'?'🔴':al.nivel==='warning'?'🟡':'🟢'}</span>
            <div class="alert-content">
              <h4>${c.nombre} — ${c.cargo}</h4>
              <p>${al.msg}</p>
              <p class="legal-ref" style="margin-top:4px; opacity:0.6">Base legal: DL 713 Art. 23 — Indemnización por no goce de vacaciones</p>
            </div>
          </div>`;
        }).join('')}
      </div>
      ${cons.length===0?'<div class="empty-state"><div class="empty-icon">✅</div><h4>Sin consultores activos</h4></div>':''}
    </div>
  `;
}

function renderReportes() {
  return `
    <div class="page-header"><h2>📈 Reportes y Datos</h2><p>Exportación de datos y backup</p></div>
    <div class="grid-3">
      <div class="card" style="text-align:center;padding:30px">
        <div style="font-size:2.5rem;margin-bottom:12px">📊</div>
        <h4>Reporte CSV</h4>
        <p style="font-size:0.8rem;color:var(--text-muted);margin:8px 0 16px">Estado de vacaciones de todo el equipo</p>
        <button class="btn btn-primary" onclick="exportarCSV()">Descargar CSV</button>
      </div>
      <div class="card" style="text-align:center;padding:30px">
        <div style="font-size:2.5rem;margin-bottom:12px">💾</div>
        <h4>Backup JSON</h4>
        <p style="font-size:0.8rem;color:var(--text-muted);margin:8px 0 16px">Todos los datos de la aplicación</p>
        <button class="btn btn-primary" onclick="exportarJSON()">Exportar Backup</button>
      </div>
      <div class="card" style="text-align:center;padding:30px">
        <div style="font-size:2.5rem;margin-bottom:12px">📥</div>
        <h4>Restaurar Backup</h4>
        <p style="font-size:0.8rem;color:var(--text-muted);margin:8px 0 16px">Cargar datos desde archivo JSON</p>
        <div style="position:relative">
          <input type="file" accept=".json" onchange="handleRestoreBackup(this.files[0])" style="position:absolute;inset:0;opacity:0;cursor:pointer">
          <button class="btn btn-outline">Seleccionar Archivo</button>
        </div>
      </div>
    </div>
  `;
}

function verDetalleConsultor(id) {
  const c = getConsultor(id);
  if (!c) return;

  const ant = calcAntiguedad(c.fechaIngreso);
  const gozGabin = calcDiasGozadosGabin(c);
  const gozReal = calcDiasGozadosReales(c.id);
  const realVacs = c.realVacations || [];
  
  const body = `
    <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:25px;margin-bottom:30px">
      <div class="card" style="padding:25px;background:var(--bg-panel-alt);border:none">
        <h4 style="margin-bottom:15px;color:var(--bg-panel);font-size:1.1rem;display:flex;align-items:center;gap:10px">📋 <span>Expediente Base</span></h4>
        <div style="display:grid;grid-template-columns:1fr;gap:15px;font-size:0.95rem">
          <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Nombre Completo</span><br><strong>${c.nombre}</strong></div>
          <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">ID RRHH (Gabin)</span><br><strong>${c.idGabin || '—'}</strong></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Fecha Ingreso</span><br><strong>${c.fechaIngreso}</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Antigüedad</span><br><strong>${ant.years}a ${ant.months}m</strong></div>
          </div>
          <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Vertical / Equipo</span><br><strong>${c.vertical || 'Sin asignar'}</strong></div>
          <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Cargo Actual</span><br><strong>${c.cargo}</strong></div>
        </div>
      </div>
      
      <div class="card" style="padding:25px;background:white;border:2px solid var(--bg-panel-alt)">
        <h4 style="margin-bottom:20px;color:var(--bg-panel);font-size:1.1rem;display:flex;align-items:center;gap:10px">⚖️ <span>Conciliación: Días Gozados</span></h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;text-align:center;margin-bottom:25px">
          <div style="padding:20px;border-radius:15px;background:rgba(76, 17, 31, 0.03);border:1px solid rgba(76, 17, 31, 0.1)">
            <span style="color:var(--text-muted);font-size:0.8rem;font-weight:600;text-transform:uppercase">Oficial (Gabin)</span><br>
            <strong style="font-size:2.4rem;color:var(--bg-panel)">${Math.round(gozGabin)}</strong> <span style="font-size:0.9rem">días</span>
          </div>
          <div style="padding:20px;border-radius:15px;background:rgba(233, 78, 119, 0.03);border:1px solid rgba(233, 78, 119, 0.1)">
            <span style="color:var(--text-muted);font-size:0.8rem;font-weight:600;text-transform:uppercase">Real (Gestión)</span><br>
            <strong style="font-size:2.4rem;color:var(--accent)">${Math.round(gozReal)}</strong> <span style="font-size:0.9rem">días</span>
          </div>
        </div>
        
        <div style="padding:15px;border-radius:12px;background:${gozGabin === gozReal ? 'rgba(16,185,129,0.1)' : 'rgba(233, 78, 119, 0.1)'};text-align:center">
          <span style="font-size:1rem;font-weight:700;color:${gozGabin === gozReal ? 'var(--success)' : 'var(--accent)'}">
            ${gozGabin === gozReal ? '✅ Saldos perfectamente conciliados' : 
              gozGabin > gozReal ? `⚠️ Deuda Interna: ${Math.round((gozGabin - gozReal)*100)/100} días por no goce real` : 
              `⚠️ Exceso de goce: ${Math.round((gozReal - gozGabin)*100)/100} días no registrados en Gabin`}
          </span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title" style="font-size:1.1rem;margin-bottom:15px">📅 Historial Detallado de Salidas Reales</div>
      ${realVacs.length === 0 ? 
        '<div class="empty-state" style="padding:40px;background:var(--bg-panel-alt);border-radius:15px"><div class="empty-icon" style="font-size:3rem">📅</div><h4>Sin historial real</h4><p>Importa el archivo de Gestión Real para ver las salidas efectivas</p></div>' :
        `<div class="table-container" style="border:1px solid var(--bg-panel-alt);border-radius:12px"><table style="width:100%">
          <thead style="background:var(--bg-panel-alt)"><tr><th style="padding:15px">Fecha Inicio</th><th>Fecha Fin</th><th>Días Tomados</th><th>Origen</th><th style="text-align:right; padding-right:15px">Acciones</th></tr></thead>
          <tbody>${realVacs.map((v, idx) => `
            <tr>
              <td style="padding:15px"><strong>${v.inicio}</strong></td>
              <td><strong>${v.fin}</strong></td>
              <td><span class="status green" style="font-size:1rem;padding:5px 12px">${v.dias} días</span></td>
              <td><span style="color:var(--text-muted);font-size:0.8rem">${v.origen === 'Manual' ? 'Manual' : 'Importación Real'}</span></td>
              <td style="text-align:right; padding-right:15px">
                <div style="display:flex; gap:8px; justify-content:flex-end">
                  <button class="btn btn-outline btn-sm" onclick="editarVacacionReal('${c.id}', ${idx})" title="Editar" style="padding:4px 8px; border-color:transparent; background:rgba(76,17,31,0.05); color:var(--bg-panel)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button class="btn btn-outline btn-sm" onclick="eliminarVacacionReal('${c.id}', ${idx})" title="Eliminar" style="padding:4px 8px; border-color:transparent; background:rgba(220,38,38,0.1); color:#dc2626">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </td>
            </tr>`).join('')}</tbody>
        </table></div>`}
    </div>

    <div style="margin-top:25px;padding:18px;background:rgba(76, 17, 31, 0.03);border-radius:12px;font-size:0.85rem;color:var(--text-on-light);line-height:1.6;border:1px solid rgba(76, 17, 31, 0.05)">
      <p><strong>🚨 Nota de Cumplimiento:</strong> El Saldo Oficial (Gabin) indica que la fecha límite legal para goce es el <strong>${c.fechaMaxGabin || 'Pendiente de cálculo'}</strong>. 
      Cualquier discrepancia positiva (Días Reales > Gabin) debe ser gestionada como deuda interna para evitar riesgos de clima laboral.</p>
    </div>
  `;

  openModal(`Auditoría de Consultor: ${c.nombre}`, body, `<button class="btn btn-primary" style="padding:12px 30px" onclick="closeModal()">Cerrar Auditoría</button>`, true);
}
