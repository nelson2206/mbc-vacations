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

window.conciliacionConfig = { filter: '', sortCol: 'nombre', sortAsc: true };

window.setConciliacionSort = function(col) {
  if (conciliacionConfig.sortCol === col) conciliacionConfig.sortAsc = !conciliacionConfig.sortAsc;
  else { conciliacionConfig.sortCol = col; conciliacionConfig.sortAsc = true; }
  navigateTo('dashboard');
};

window.setConciliacionFilter = function() {
  const input = document.getElementById('filterConciliacion');
  if (input) conciliacionConfig.filter = input.value.toLowerCase();
  navigateTo('dashboard');
};

function renderDashboard() {
  const consFull = getActiveConsultores();
  const verticals = [...new Set(consFull.map(c => c.vertical).filter(Boolean))].sort();
  const currentVerticals = getFiltroVertical();

  const cons = currentVerticals.includes('Todos')
    ? consFull
    : consFull.filter(c => currentVerticals.includes(c.vertical));

  const totalDias = cons.reduce((s,c) => s + calcDiasGabin(c), 0);
  const hoy = new Date().toISOString().slice(0,10);
  const enVacHoy = cons.filter(c => {
    if (!c.realVacations) return false;
    return c.realVacations.some(v => v.inicio && v.fin && v.inicio <= hoy && v.fin >= hoy);
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
    return `<button type="button" class="risk-person-card risk-debt" onclick="verDetalleConsultor('${c.id}')">
      <div class="risk-avatar" style="background:var(--bg-panel); color:var(--accent)">${esc(getInitials(c.nombre))}</div>
      <div class="risk-person-info">
        <div class="risk-person-name">${esc(shortenName(c.nombre))}</div>
        <div class="risk-person-cargo">${esc(c.vertical || c.cargo)}</div>
        <div class="risk-person-meta">Deuda registrada</div>
      </div>
      <div class="risk-person-days">
        <span class="risk-days-number risk-days-accent">+${Math.round(deuda)}</span>
        <span class="risk-days-label">días deuda</span>
      </div>
    </button>`;
  }

  function renderRiskCard(c) {
    const disp = calcDiasGabin(c);
    const planificado = calcDiasPlanificadosReales(c.id);
    const al = getAlertaLegal(c);
    const cls = al.nivel === 'critical' ? 'crit' : al.nivel === 'warning' ? 'warn' : 'safe';
    const fechaMax = c.fechaMaxGabin ? `<div style="font-size:0.65rem;margin-top:2px;color:var(--text-muted)">Max Gabin: <strong>${esc(c.fechaMaxGabin)}</strong></div>` : '';
    const planTag = planificado > 0
      ? `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:2px 8px;border-radius:10px;background:var(--brand-tint-8);color:var(--bg-panel);font-size:0.65rem;font-weight:700">📅 ${Math.round(planificado)} días planificados</div>`
      : '';

    return `<button type="button" class="risk-person-card risk-${cls}" onclick="verDetalleConsultor('${c.id}')">
      <div class="risk-avatar">${esc(getInitials(c.nombre))}</div>
      <div class="risk-person-info">
        <div class="risk-person-name">${esc(shortenName(c.nombre))}</div>
        <div class="risk-person-cargo">${esc(c.vertical || c.cargo)}</div>
        ${fechaMax}
        ${planTag}
      </div>
      <div class="risk-person-days">
        <span class="risk-days-number">${disp}</span>
        <span class="risk-days-label">días Gabin</span>
      </div>
    </button>`;
  }

  return `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div>
        <h1>📊 Dashboard</h1>
        <p>Resumen general del equipo · <strong style="color:var(--bg-panel)">${(function(){
          const gabinImp = APP.importaciones && APP.importaciones.find(i => i.tipo === 'RRHH Gabin');
          const fn = gabinImp && gabinImp.archivo;
          if (fn) {
            const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
            let y, m, d;
            const m1 = fn.match(/(\d{4})[-_. /]?(\d{2})[-_. /]?(\d{2})/);
            if (m1 && m1[2]<=12 && m1[3]<=31) { y=m1[1]; m=m1[2]; d=m1[3]; }
            else { const m2 = fn.match(/(\d{2})[-_. /]?(\d{2})[-_. /]?(\d{4})/); if (m2 && m2[2]<=12 && m2[1]<=31) { d=m2[1]; m=m2[2]; y=m2[3]; } }
            if (y && m && d) return 'Actualizado al ' + parseInt(d,10) + ' de ' + months[parseInt(m,10)-1] + ' de ' + y;
          }
          return APP.config.fechaActualizacion ? 'Actualizado al ' + APP.config.fechaActualizacion : 'Datos cargados';
        })()}</strong></p>
      </div>
      <div class="status-badge ${isCloudConnected ? 'online' : 'offline'}">
        ${isCloudConnected ? '● Sincronizado' : '○ Modo Local'}
      </div>
    </div>

    ${(function(){
      const d = new Date();
      const todayMMDD = String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const cumpleañeros = cons.filter(c => {
        if (!c.cumpleaños) return false;
        const cDate = new Date(c.cumpleaños + 'T00:00:00');
        const cMMDD = String(cDate.getMonth()+1).padStart(2,'0') + '-' + String(cDate.getDate()).padStart(2,'0');
        return cMMDD === todayMMDD;
      });
      if (cumpleañeros.length === 0) return '';
      return `
        <div class="card" style="background: linear-gradient(135deg, var(--brand-tint-3) 0%, #fff 100%); border-left: 5px solid var(--accent); margin-bottom: 20px; animation: slideIn 0.5s ease-out">
          <div style="display:flex; align-items:center; gap:20px; padding:10px">
            <div style="font-size:3rem">🎂</div>
            <div>
              <h3 style="color:var(--accent); margin-bottom:4px">¡Hoy celebramos un cumpleaños!</h3>
              <p style="font-size:1.1rem; font-weight:600; color:var(--bg-panel)">
                ${cumpleañeros.map(c => esc(c.nombre)).join(', ')}
              </p>
              <button class="btn btn-outline btn-sm" style="margin-top:10px" onclick="navigateTo('cumpleaños')">Ver todos los cumpleaños ➔</button>
            </div>
          </div>
        </div>
      `;
    })()}
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted)">Filtrar por Vertical</span>
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end">
          ${['Todos', ...verticals].map(v => {
            const isActive = currentVerticals.includes(v);
            return `<button 
              onclick="cambiarFiltroVertical('${v}')" 
              style="
                padding: 7px 16px;
                border-radius: 8px;
                border: 1.5px solid ${isActive ? 'var(--bg-panel)' : 'var(--brand-tint-15)'};
                background: ${isActive ? 'var(--bg-panel)' : 'white'};
                color: ${isActive ? 'white' : 'var(--text-on-light)'};
                font-size: 0.78rem;
                font-weight: ${isActive ? '700' : '500'};
                cursor: pointer;
                transition: all 0.18s ease;
                box-shadow: ${isActive ? '0 3px 10px var(--brand-tint-25)' : '0 1px 3px rgba(0,0,0,0.06)'};
                display: flex;
                align-items: center;
                gap: 6px;
                white-space: nowrap;
              "
              onmouseover="if(!${isActive})this.style.borderColor='var(--bg-panel)';this.style.background=!${isActive}?'var(--brand-tint-5)':this.style.background"
              onmouseout="if(!${isActive}){this.style.borderColor='var(--brand-tint-15)';this.style.background='white'}"
            >
              ${isActive ? '<span style="width:6px;height:6px;border-radius:50%;background:white;display:inline-block;flex-shrink:0"></span>' : ''}
              ${v === 'Todos' ? 'Todas las verticales' : v.replace(/Consultor[ií]a\s*/gi, '').trim() || v}
            </button>`;
          }).join('')}
        </div>
      </div>
    </div>
    
    <section class="hero-strip" aria-label="Resumen del equipo">
      <div class="stat-card lead">
        <div class="stat-label">El equipo</div>
        <div class="stat-value" data-numeric>${cons.length}</div>
        <div class="stat-meta">consultores activos · ${Math.round(totalDias)} días pendientes</div>
      </div>
      <button type="button" class="stat-card compact stat-clickable" onclick="mostrarEnVacacionesHoy()" aria-label="Ver consultores en vacaciones hoy">
        <div class="stat-label">Hoy fuera</div>
        <div class="stat-value" data-numeric>${enVacHoy}</div>
        <div class="stat-meta">de descanso</div>
      </button>
      <div class="stat-card compact ${criticos.length ? 'stat-tone-crit' : ''}">
        <div class="stat-label">Crítico</div>
        <div class="stat-value" data-numeric>${criticos.length}</div>
        <div class="stat-meta">requieren acción</div>
      </div>
      <div class="stat-card compact ${medios.length ? 'stat-tone-warn' : ''}">
        <div class="stat-label">Atención</div>
        <div class="stat-value" data-numeric>${medios.length}</div>
        <div class="stat-meta">programar pronto</div>
      </div>
    </section>

    <!-- ===== SEMÁFORO DE RIESGO ===== -->
    <div class="section slide-up">
      <div class="section-title">🚦 Semáforo de Riesgo · Vacaciones por Vencer (DL 713 Art. 23)</div>
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
            <div class="risk-column-header risk-header-safe" style="background: var(--brand-tint-5); color: var(--accent);">
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
      <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <span>📊 Conciliación Detallada: Gabin vs Real (Vista Expandida)</span>
        <input type="text" id="filterConciliacion" class="form-control" placeholder="🔍 Buscar por nombre..." value="${conciliacionConfig.filter}" onchange="setConciliacionFilter()" style="max-width: 300px; padding: 8px 14px; font-size: 0.8rem;">
      </div>
      <div class="card" style="padding:0; overflow:hidden">
        ${(function(){
          let conciliacionCons = [...cons];
          if (conciliacionConfig.filter) {
            conciliacionCons = conciliacionCons.filter(c => c.nombre.toLowerCase().includes(conciliacionConfig.filter) || (c.vertical && c.vertical.toLowerCase().includes(conciliacionConfig.filter)));
          }

          conciliacionCons.sort((a, b) => {
            let valA, valB;
            const dispGabinA = calcDiasGabin(a);
            const dispGabinB = calcDiasGabin(b);
            const gozGabinA = calcDiasGozadosGabin(a);
            const gozGabinB = calcDiasGozadosGabin(b);
            const gozRealA = calcDiasGozadosReales(a.id);
            const gozRealB = calcDiasGozadosReales(b.id);
            const planA = calcDiasPlanificadosReales(a.id);
            const planB = calcDiasPlanificadosReales(b.id);
            const diffA = gozGabinA - gozRealA;
            const diffB = gozGabinB - gozRealB;

            if (conciliacionConfig.sortCol === 'nombre') { valA = a.nombre; valB = b.nombre; }
            else if (conciliacionConfig.sortCol === 'fechaMax') { valA = a.fechaMaxGabin || ''; valB = b.fechaMaxGabin || ''; }
            else if (conciliacionConfig.sortCol === 'saldo') { valA = dispGabinA; valB = dispGabinB; }
            else if (conciliacionConfig.sortCol === 'truncos') { valA = a.diasTruncos || 0; valB = b.diasTruncos || 0; }
            else if (conciliacionConfig.sortCol === 'gozGabin') { valA = gozGabinA; valB = gozGabinB; }
            else if (conciliacionConfig.sortCol === 'gozReal') { valA = gozRealA; valB = gozRealB; }
            else if (conciliacionConfig.sortCol === 'planificado') { valA = planA; valB = planB; }
            else if (conciliacionConfig.sortCol === 'diff') { valA = diffA; valB = diffB; }
            else if (conciliacionConfig.sortCol === 'estado') { valA = getAlertaLegal(a).nivel; valB = getAlertaLegal(b).nivel; }
            else { valA = a.nombre; valB = b.nombre; }
            
            if (valA < valB) return conciliacionConfig.sortAsc ? -1 : 1;
            if (valA > valB) return conciliacionConfig.sortAsc ? 1 : -1;
            return 0;
          });

          const getConciliacionSortIcon = (col) => conciliacionConfig.sortCol === col ? (conciliacionConfig.sortAsc ? ' 🔼' : ' 🔽') : '';

          if (conciliacionCons.length === 0) return '<div class="empty-state"><div class="empty-icon">👥</div><h4>Sin consultores</h4></div>';

          return `<div class="table-container" style="max-height: 800px; overflow-y: auto;">
            <table style="width:100%">
            <thead style="position:sticky; top:0; z-index:10; background:var(--bg-panel-alt)">
              <tr>
                <th style="padding:20px; cursor:pointer" onclick="setConciliacionSort('nombre')">Consultor${getConciliacionSortIcon('nombre')}</th>
                <th style="cursor:pointer" onclick="setConciliacionSort('fechaMax')">Fecha Máx. Salida${getConciliacionSortIcon('fechaMax')}</th>
                <th style="cursor:pointer" onclick="setConciliacionSort('saldo')">Saldo Gabin (Vigente)${getConciliacionSortIcon('saldo')}</th>
                <th style="cursor:pointer" onclick="setConciliacionSort('truncos')">Días Truncos${getConciliacionSortIcon('truncos')}</th>
                <th style="cursor:pointer" onclick="setConciliacionSort('gozGabin')">Gozados Gabin (Histórico)${getConciliacionSortIcon('gozGabin')}</th>
                <th style="cursor:pointer" onclick="setConciliacionSort('gozReal')">Gozados Real (Gestión)${getConciliacionSortIcon('gozReal')}</th>
                <th style="cursor:pointer" onclick="setConciliacionSort('planificado')" title="Días registrados en Gestión Real con fecha futura (no suman al gozado)">Planificado${getConciliacionSortIcon('planificado')}</th>
                <th style="cursor:pointer" onclick="setConciliacionSort('diff')">Diferencia (Deuda)${getConciliacionSortIcon('diff')}</th>
                <th style="cursor:pointer" onclick="setConciliacionSort('estado')">Estado Legal${getConciliacionSortIcon('estado')}</th>
              </tr>
            </thead>
            <tbody>${conciliacionCons.map(c => {
              const dispGabin = calcDiasGabin(c);
              const gozGabin = calcDiasGozadosGabin(c);
              const gozReal = calcDiasGozadosReales(c.id);
              const planificado = calcDiasPlanificadosReales(c.id);
              const diff = gozGabin - gozReal;
              const truncos = c.diasTruncos || 0;
              const truncosDisplay = truncos % 1 === 0 ? truncos : Number(truncos).toFixed(2);
              const al = getAlertaLegal(c);
              const cls = al.nivel === 'critical' ? 'red' : al.nivel === 'warning' ? 'yellow' : 'green';
              return `<tr onclick="verDetalleConsultor('${c.id}')" style="cursor:pointer; height:80px">
                <td style="padding:15px 20px"><strong>${esc(shortenName(c.nombre))}</strong></td>
                <td><span style="color:var(--text-muted);font-size:0.85rem">${esc(c.fechaMaxGabin) || '—'}</span></td>
                <td><strong style="font-size:1.1rem">${Math.round(dispGabin)}</strong></td>
                <td><span style="color:var(--text-muted); font-size:1rem">${truncosDisplay}</span></td>
                <td><span style="color:var(--bg-panel); font-weight:700">${Math.round(gozGabin)}</span></td>
                <td><strong style="font-size:1.1rem; color:var(--accent)">${Math.round(gozReal)}</strong></td>
                <td><span style="font-weight:600; color:${planificado > 0 ? 'var(--bg-panel)' : 'var(--text-muted)'}">${planificado > 0 ? Math.round(planificado) : '—'}</span></td>
                <td>
                  <span style="font-weight:800; font-size:1.15rem; color:${diff > 0 ? 'var(--accent)' : diff < 0 ? 'var(--danger)' : 'var(--success)'}">
                    ${diff > 0 ? '+' + Math.round(diff) : Math.round(diff)}
                  </span>
                </td>
                <td><span class="status ${cls}" style="padding:8px 18px; font-size:0.85rem; min-width:100px; text-align:center">${al.nivel === 'critical' ? 'Crítico' : al.nivel === 'warning' ? 'Atención' : 'Al día'}</span></td>
              </tr>`;
            }).join('')}</tbody></table></div>`;
        })()}
      </div>
    </div>
  `;
}

window.consConfig = { filter: '', sortCol: 'nombre', sortAsc: true };

window.setConsSort = function(col) {
  if (consConfig.sortCol === col) {
    consConfig.sortAsc = !consConfig.sortAsc;
  } else {
    consConfig.sortCol = col;
    consConfig.sortAsc = true;
  }
  navigateTo('consultores');
};

window.setConsFilter = function() {
  const input = document.getElementById('filterConsGlobal');
  if (input) consConfig.filter = input.value.toLowerCase();
  navigateTo('consultores');
};

function renderConsultores() {
  let cons = [...APP.consultores];
  if (consConfig.filter) {
    cons = cons.filter(c => c.nombre.toLowerCase().includes(consConfig.filter) || (c.cargo && c.cargo.toLowerCase().includes(consConfig.filter)));
  }
  
  cons.sort((a, b) => {
    let valA, valB;
    if (consConfig.sortCol === 'nombre') { valA = a.nombre; valB = b.nombre; }
    else if (consConfig.sortCol === 'vertical') { valA = a.vertical || a.cargo || ''; valB = b.vertical || b.cargo || ''; }
    else if (consConfig.sortCol === 'ingreso') { valA = a.fechaIngreso || ''; valB = b.fechaIngreso || ''; }
    else if (consConfig.sortCol === 'diasHR') { valA = a.diasPendientesHR || 0; valB = b.diasPendientesHR || 0; }
    else if (consConfig.sortCol === 'disp') { valA = calcDiasDisponibles(a); valB = calcDiasDisponibles(b); }
    else { valA = a.nombre; valB = b.nombre; }
    
    if (valA < valB) return consConfig.sortAsc ? -1 : 1;
    if (valA > valB) return consConfig.sortAsc ? 1 : -1;
    return 0;
  });

  const getSortIcon = (col) => consConfig.sortCol === col ? (consConfig.sortAsc ? ' 🔼' : ' 🔽') : '';
  return `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>Base de Consultores</h1><p>Gestión del equipo de consultoría</p></div>
      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
        <input type="text" id="filterConsGlobal" class="form-control" placeholder="🔍 Buscar consultor..." value="${consConfig.filter}" onchange="setConsFilter()" style="max-width:250px; padding:8px 14px; font-size:0.8rem;">
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
    ${APP.consultores.length === 0 ? '<div class="card"><div class="empty-state"><div class="empty-icon">👥</div><h4>No hay consultores registrados</h4><p>Agrega consultores manualmente o importa desde un Excel de RRHH</p></div></div>' :
      `<div class="card"><div class="table-container"><table>
        <thead><tr>
          <th style="cursor:pointer" onclick="setConsSort('nombre')">Nombre${getSortIcon('nombre')}</th>
          <th style="cursor:pointer" onclick="setConsSort('vertical')">Vertical${getSortIcon('vertical')}</th>
          <th style="cursor:pointer" onclick="setConsSort('ingreso')">Ingreso${getSortIcon('ingreso')}</th>
          <th>Antigüedad</th>
          <th style="cursor:pointer" onclick="setConsSort('diasHR')">Días HR${getSortIcon('diasHR')}</th>
          <th style="cursor:pointer" onclick="setConsSort('disp')">Disponibles${getSortIcon('disp')}</th>
          <th>Alerta</th>
          <th style="text-align:right">Acciones</th>
        </tr></thead>
        <tbody>${cons.map(c => {
          const ant = calcAntiguedad(c.fechaIngreso, c.fechaCorteGabin);
          const disp = calcDiasDisponibles(c);
          const al = getAlertaLegal(c);
          const cls = al.nivel==='critical'?'red':al.nivel==='warning'?'yellow':'green';
          return `<tr style="${c.estado==='cesado'?'opacity:0.5':''}">
            <td><strong style="color:var(--bg-panel)">${esc(c.nombre)}</strong></td>
            <td><span style="color:var(--text-muted);font-size:0.85rem">${c.cargo || 'Consultor'}</span></td>
            <td>${esc(c.fechaIngreso)}</td>
            <td>${ant.years}a ${ant.months}m</td>
            <td>${c.diasPendientesHR || '—'}</td>
            <td><strong style="font-size:1.1rem">${Math.round(disp)}</strong></td>
            <td><span class="status ${cls}" style="padding:6px 12px; font-size:0.75rem">${al.nivel==='critical'?'Crítico':al.nivel==='warning'?'Atención':'OK'}</span></td>
            <td style="text-align:right">
              <div style="display:flex; gap:8px; justify-content:flex-end">
                <button class="btn btn-outline btn-sm btn-edit-soft" onclick="openModalConsultor('${c.id}')" title="Editar" aria-label="Editar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn btn-outline btn-sm btn-danger-soft" onclick="confirmarEliminar('${c.id}','${esc(c.nombre)}')" title="Eliminar" aria-label="Eliminar">
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
      <h1>📤 Importación de Datos</h1>
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
          <div style="font-size:2rem;margin-bottom:12px">⏱️</div>
          <h3 style="margin-bottom:8px; color:var(--bg-panel)">Gestión Real</h3>
          <p style="font-size:0.85rem;color:var(--bg-panel);opacity:0.7;margin-bottom:16px; font-weight:500">Historial de salidas reales procesadas por el equipo.</p>
        </div>
        <div class="upload-zone" style="padding:20px 10px; border-style:dashed; border-width:2px; border-color:var(--bg-panel-alt)">
          <input type="file" style="opacity:1;position:static;width:100%" onchange="handleFileUpload(this.files[0], 'real')">
        </div>
      </div>

      <!-- CUMPLEAÑOS -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between; border: 1px solid var(--bg-panel-alt)">
        <div>
          <div style="font-size:2rem;margin-bottom:12px">🎂</div>
          <h3 style="margin-bottom:8px; color:var(--bg-panel)">Calendario de Cumpleaños</h3>
          <p style="font-size:0.85rem;color:var(--bg-panel);opacity:0.7;margin-bottom:16px; font-weight:500">Base de datos de fechas de nacimiento del equipo.</p>
        </div>
        <div class="upload-zone" style="padding:20px 10px; border-style:dashed; border-width:2px; border-color:var(--bg-panel-alt)">
          <input type="file" style="opacity:1;position:static;width:100%" onchange="handleFileUpload(this.files[0], 'cumpleaños')">
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
    <div class="page-header"><h1>⚠️ Alertas de Cumplimiento Legal</h1><p>Monitoreo de riesgos según DL 713 · Triple Vacacional</p></div>
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
              <h4>${esc(c.nombre)} · ${esc(c.cargo)}</h4>
              <p>${al.msg}</p>
              <p class="legal-ref" style="margin-top:4px; opacity:0.6">Base legal: DL 713 Art. 23 · Indemnización por no goce de vacaciones</p>
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
    <div class="page-header"><h1>📈 Reportes y Datos</h1><p>Exportación de datos y backup</p></div>
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

  const ant = calcAntiguedad(c.fechaIngreso, c.fechaCorteGabin);
  const gozGabin = calcDiasGozadosGabin(c);
  const gozReal = calcDiasGozadosReales(c.id);
  const planificado = calcDiasPlanificadosReales(c.id);
  const realVacs = c.realVacations || [];
  
  const body = `
    <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:25px;margin-bottom:30px">
      <div class="card" style="padding:25px;background:var(--bg-panel-alt);border:none">
        <h4 style="margin-bottom:15px;color:var(--bg-panel);font-size:1.1rem;display:flex;align-items:center;gap:10px">📋 <span>Expediente Base</span></h4>
        <div style="display:grid;grid-template-columns:1fr;gap:15px;font-size:0.95rem">
          <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Nombre Completo</span><br><strong>${esc(c.nombre)}</strong></div>
          <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">ID RRHH (Gabin)</span><br><strong>${esc(c.idGabin) || '—'}</strong></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Fecha Ingreso</span><br><strong>${esc(c.fechaIngreso)}</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Antigüedad</span><br><strong>${ant.years}a ${ant.months}m</strong></div>
          </div>
          <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Vertical / Equipo</span><br><strong>${c.vertical || 'Sin asignar'}</strong></div>
          <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">Cargo Actual</span><br><strong>${esc(c.cargo)}</strong></div>
          <div><span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">🎂 Cumpleaños</span><br><strong>${esc(c.cumpleaños) || '—'}</strong></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;margin-top:20px;padding-top:15px;border-top:1px solid rgba(0,0,0,0.05)">
          <div><span style="color:var(--text-muted);font-size:0.75rem;font-weight:600;text-transform:uppercase">Pendientes (Gabin)</span><br><strong style="font-size:1.2rem;color:var(--bg-panel)">${c.diasPendientesHR || 0}</strong></div>
          <div><span style="color:var(--text-muted);font-size:0.75rem;font-weight:600;text-transform:uppercase">Truncos (Gabin)</span><br><strong style="font-size:1.2rem;color:var(--bg-panel)">${c.diasTruncos || 0}</strong></div>
          <div><span style="color:var(--text-muted);font-size:0.75rem;font-weight:600;text-transform:uppercase">Fecha Max (Gabin)</span><br><strong style="font-size:1.1rem;color:var(--accent)">${esc(c.fechaMaxGabin) || '—'}</strong></div>
        </div>
      </div>
      
      <div class="card" style="padding:25px;background:white;border:2px solid var(--bg-panel-alt)">
        <h4 style="margin-bottom:20px;color:var(--bg-panel);font-size:1.1rem;display:flex;align-items:center;gap:10px">⚖️ <span>Conciliación: Días Gozados</span></h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;text-align:center;margin-bottom:25px">
          <div style="padding:20px;border-radius:15px;background:var(--brand-tint-3);border:1px solid var(--brand-tint-10)">
            <span style="color:var(--text-muted);font-size:0.8rem;font-weight:600;text-transform:uppercase">Oficial (Gabin)</span><br>
            <strong style="font-size:2.4rem;color:var(--bg-panel)">${Math.round(gozGabin)}</strong> <span style="font-size:0.9rem">días</span>
          </div>
          <div style="padding:20px;border-radius:15px;background:var(--accent-tint-3);border:1px solid var(--accent-tint-10)">
            <span style="color:var(--text-muted);font-size:0.8rem;font-weight:600;text-transform:uppercase">Real (Gestión)</span><br>
            <strong style="font-size:2.4rem;color:var(--accent)">${Math.round(gozReal)}</strong> <span style="font-size:0.9rem">días</span>
            ${planificado > 0 ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted)">+ <strong style="color:var(--bg-panel)">${Math.round(planificado)} días planificados</strong> (no suman)</div>` : ''}
          </div>
        </div>
        
        <div class="callout ${gozGabin === gozReal ? 'callout-ok' : 'callout-debt'}" style="padding:15px;text-align:center">
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
          <tbody>${realVacs.map((v, idx) => {
            const planif = esVacacionPlanificada(v);
            return `
            <tr style="${planif ? 'background:var(--brand-tint-3)' : ''}">
              <td style="padding:15px"><strong>${esc(v.inicio)}</strong> ${planif ? '<span class="status yellow" style="margin-left:6px;padding:2px 8px;font-size:0.7rem">📅 Planificado</span>' : ''}</td>
              <td><strong>${esc(v.fin)}</strong></td>
              <td><span class="status ${planif ? 'yellow' : 'green'}" style="font-size:1rem;padding:5px 12px">${v.dias} días</span></td>
              <td><span style="color:var(--text-muted);font-size:0.8rem">${v.origen === 'Manual' ? 'Manual' : 'Importación Real'}</span></td>
              <td style="text-align:right; padding-right:15px">
                <div style="display:flex; gap:8px; justify-content:flex-end">
                  <button class="btn btn-outline btn-sm btn-edit-soft" onclick="editarVacacionReal('${c.id}', ${idx})" title="Editar" aria-label="Editar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button class="btn btn-outline btn-sm btn-danger-soft" onclick="eliminarVacacionReal('${c.id}', ${idx})" title="Eliminar" aria-label="Eliminar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>`}
    </div>

    <div style="margin-top:25px;padding:18px;background:var(--brand-tint-3);border-radius:12px;font-size:0.85rem;color:var(--text-on-light);line-height:1.6;border:1px solid var(--brand-tint-5)">
      <p><strong>🚨 Nota de Cumplimiento:</strong> El Saldo Oficial (Gabin) indica que la fecha límite legal para goce es el <strong>${c.fechaMaxGabin || 'Pendiente de cálculo'}</strong>. 
      Cualquier discrepancia positiva (Días Reales > Gabin) debe ser gestionada como deuda interna para evitar riesgos de clima laboral.</p>
    </div>
  `;

  openModal(`Auditoría de Consultor: ${esc(c.nombre)}`, body, `<button class="btn btn-primary" style="padding:12px 30px" onclick="closeModal()">Cerrar Auditoría</button>`, true);
}

// Global function for filtering the reconciliation table
window.filtrarConciliacion = function() {
  const input = document.getElementById('filterConciliacion');
  if (!input) return;
  const filter = input.value.toUpperCase();
  const table = document.querySelector('.table-container table tbody');
  if (!table) return;
  const trs = table.getElementsByTagName('tr');
  for (let i = 0; i < trs.length; i++) {
    const td = trs[i].getElementsByTagName('td')[0];
    if (td) {
      const txtValue = td.textContent || td.innerText;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        trs[i].style.display = '';
      } else {
        trs[i].style.display = 'none';
      }
    }
  }
};

// Global function to show consultants on vacation today
window.mostrarEnVacacionesHoy = function() {
  const hoy = new Date().toISOString().slice(0,10);
  const consFull = getActiveConsultores();
  const currentVerticals = getFiltroVertical();
  const cons = currentVerticals.includes('Todos')
    ? consFull
    : consFull.filter(c => currentVerticals.includes(c.vertical));

  const vacsHoy = [];
  cons.forEach(c => {
    if (c.realVacations) {
      c.realVacations.forEach(v => {
        if (v.inicio && v.fin && v.inicio <= hoy && v.fin >= hoy) {
          vacsHoy.push({ c, v });
        }
      });
    }
  });

  const body = vacsHoy.length === 0 ? 
    '<div class="empty-state"><div class="empty-icon">🏖️</div><h4>Nadie de vacaciones</h4><p>No hay consultores de vacaciones el día de hoy.</p></div>' :
    `<div class="table-container">
      <table style="width:100%">
        <thead style="background:var(--bg-panel-alt)"><tr><th style="padding:15px">Consultor</th><th>Vertical</th><th>Inicio</th><th>Fin</th><th>Días</th></tr></thead>
        <tbody>
          ${vacsHoy.map(item => `
            <tr>
              <td style="padding:15px"><strong>${esc(item.c.nombre)}</strong></td>
              <td><span style="color:var(--text-muted);font-size:0.85rem">${esc(item.c.vertical) || '—'}</span></td>
              <td><strong>${esc(item.v.inicio)}</strong></td>
              <td><strong>${esc(item.v.fin)}</strong></td>
              <td><span class="status green" style="padding:4px 10px">${item.v.dias} días</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  openModal('🏖️ En Vacaciones Hoy', body, '<button class="btn btn-outline" onclick="closeModal()">Cerrar</button>');
};

// ----- GESTIONES REALES VIEW -----
window.gestionesConfig = { sortCol: 'inicio', sortAsc: false, filter: '' };

window.setGestionesSort = function(col) {
  if (gestionesConfig.sortCol === col) gestionesConfig.sortAsc = !gestionesConfig.sortAsc;
  else { gestionesConfig.sortCol = col; gestionesConfig.sortAsc = true; }
  navigateTo('gestiones');
};

window.setGestionesFilter = function() {
  const input = document.getElementById('searchGestiones');
  if (input) {
    gestionesConfig.filter = input.value.toLowerCase().trim();
    navigateTo('gestiones');
  }
};

function renderGestiones() {
  const consFull = getActiveConsultores();
  const allVacs = [];
  let totalEjecutado = 0, totalPlanificado = 0;
  consFull.forEach(c => {
    if (c.realVacations) {
      c.realVacations.forEach((v, idx) => {
        const planificada = esVacacionPlanificada(v);
        // Filtro por nombre
        if (gestionesConfig.filter && !c.nombre.toLowerCase().includes(gestionesConfig.filter)) return;
        
        allVacs.push({ c, v, idx, planificada });
        if (planificada) totalPlanificado += (v.dias || 0);
        else totalEjecutado += (v.dias || 0);
      });
    }
  });

  allVacs.sort((a, b) => {
    let valA, valB;
    if (gestionesConfig.sortCol === 'inicio') { valA = a.v.inicio; valB = b.v.inicio; }
    else if (gestionesConfig.sortCol === 'fin') { valA = a.v.fin; valB = b.v.fin; }
    else if (gestionesConfig.sortCol === 'dias') { valA = a.v.dias; valB = b.v.dias; }
    else if (gestionesConfig.sortCol === 'nombre') { valA = a.c.nombre; valB = b.c.nombre; }
    else if (gestionesConfig.sortCol === 'estado') { valA = a.planificada ? 1 : 0; valB = b.planificada ? 1 : 0; }

    if (valA < valB) return gestionesConfig.sortAsc ? -1 : 1;
    if (valA > valB) return gestionesConfig.sortAsc ? 1 : -1;
    return 0;
  });

  const getSortIcon = (col) => gestionesConfig.sortCol === col ? (gestionesConfig.sortAsc ? ' 🔼' : ' 🔽') : '';

  return `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start">
      <div>
        <h1><span style="font-size:24px; vertical-align:middle; margin-right:8px">⏱️</span>Gestión Real</h1>
        <p>Listado general de salidas reales efectivas e importadas</p>
      </div>
      <div>
        <button class="btn btn-primary" onclick="openModalRegistroReal()" style="display:flex; align-items:center; gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Registrar Vacación
        </button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px">
      <div class="callout callout-ok" style="padding:18px">
        <span style="color:var(--text-muted);font-size:0.78rem;font-weight:600;text-transform:uppercase">Total Ejecutado</span><br>
        <strong style="font-size:1.8rem;color:var(--success)">${totalEjecutado}</strong> <span style="font-size:0.85rem;color:var(--text-muted)">días gozados (suman al gozReal)</span>
      </div>
      <div class="callout" style="padding:18px">
        <span style="color:var(--text-muted);font-size:0.78rem;font-weight:600;text-transform:uppercase">Total Planificado</span><br>
        <strong style="font-size:1.8rem;color:var(--bg-panel)">${totalPlanificado}</strong> <span style="font-size:0.85rem;color:var(--text-muted)">días futuros (no suman al total)</span>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px; padding:15px">
      <div style="position:relative">
        <span style="position:absolute; left:12px; top:11px; color:var(--text-muted)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </span>
        <input type="text" id="searchGestiones" 
          placeholder="Buscar consultor en gestión real..." 
          value="${esc(gestionesConfig.filter)}"
          oninput="setGestionesFilter()"
          style="width:100%; padding:10px 15px 10px 40px; border-radius:10px; border:1.5px solid var(--border); font-size:0.9rem">
      </div>
    </div>

    <div class="card">
      ${allVacs.length === 0 ? '<div class="empty-state"><div class="empty-icon">🏖️</div><h4>No hay salidas registradas</h4><p>Registra vacaciones manualmente o importa un archivo de Gestión Real.</p></div>' :
      `<div class="table-container" style="max-height:600px; overflow-y:auto">
        <table style="width:100%">
          <thead style="position:sticky; top:0; background:white; z-index:10; box-shadow:0 1px 2px rgba(0,0,0,0.05)">
            <tr>
              <th style="cursor:pointer" onclick="setGestionesSort('nombre')">Consultor${getSortIcon('nombre')}</th>
              <th>Vertical</th>
              <th style="cursor:pointer" onclick="setGestionesSort('inicio')">Inicio${getSortIcon('inicio')}</th>
              <th style="cursor:pointer" onclick="setGestionesSort('fin')">Fin${getSortIcon('fin')}</th>
              <th style="cursor:pointer" onclick="setGestionesSort('dias')">Días${getSortIcon('dias')}</th>
              <th style="cursor:pointer" onclick="setGestionesSort('estado')">Estado${getSortIcon('estado')}</th>
              <th>Origen</th>
              <th style="text-align:right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${allVacs.map(item => `
              <tr style="${item.planificada ? 'background:var(--brand-tint-3)' : ''}">
                <td><strong style="color:var(--bg-panel)">${esc(item.c.nombre)}</strong></td>
                <td><span style="color:var(--text-muted);font-size:0.85rem">${esc(item.c.vertical || item.c.cargo)}</span></td>
                <td><strong>${esc(item.v.inicio)}</strong></td>
                <td><strong>${esc(item.v.fin)}</strong></td>
                <td><span class="status ${item.planificada ? 'yellow' : 'green'}" style="padding:4px 10px">${item.v.dias} días</span></td>
                <td><span class="status ${item.planificada ? 'yellow' : 'green'}" style="padding:4px 10px;font-size:0.78rem">${item.planificada ? '📅 Planificado' : '✅ Ejecutado'}</span></td>
                <td><span style="color:var(--text-muted);font-size:0.8rem">${esc(item.v.origen)}</span></td>
                <td style="text-align:right">
                  <div style="display:flex; gap:8px; justify-content:flex-end">
                    <button class="btn btn-outline btn-sm btn-edit-soft" onclick="editarVacacionReal('${item.c.id}', ${item.idx})" title="Editar" aria-label="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn btn-outline btn-sm btn-danger-soft" onclick="eliminarVacacionReal('${item.c.id}', ${item.idx})" title="Eliminar" aria-label="Eliminar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
  `;
}

function renderConflictos() {
  const conflictos = findAllConflictos();
  const cobertura = findConflictosCobertura();
  const coberturaPendiente = cobertura.filter(w => !w.aprobado);
  const coberturaAprobada = cobertura.filter(w => w.aprobado);
  const totalPendientes = conflictos.length + coberturaPendiente.length;

  if (totalPendientes === 0 && coberturaAprobada.length === 0) {
    return `
      <div class="page-header">
        <h1><span style="font-size:24px; vertical-align:middle; margin-right:8px">⚠️</span>Conflictos de Vacaciones</h1>
        <p>Revisa registros superpuestos y alertas de cobertura de liderazgo</p>
      </div>
      <div class="card">
        <div class="empty-state" style="padding:60px 20px">
          <div class="empty-icon" style="font-size:4rem;margin-bottom:8px">✅</div>
          <h4 style="font-size:1.4rem;margin-bottom:6px">Sin conflictos pendientes</h4>
          <p style="color:var(--text-muted)">Ningún consultor tiene fechas superpuestas y la cobertura de Managers/Senior Managers está OK.</p>
        </div>
      </div>
    `;
  }

  // Agrupar por consultor para mostrar contiguos
  const porConsultor = new Map();
  conflictos.forEach(k => {
    const id = k.consultor.id;
    if (!porConsultor.has(id)) porConsultor.set(id, { consultor: k.consultor, items: [] });
    porConsultor.get(id).items.push(k);
  });

  const renderTarjeta = (label, side) => {
    const v = side.v;
    const planif = esVacacionPlanificada(v);
    const hoy = new Date().toISOString().slice(0,10);
    const finished = v.fin && v.fin < hoy;
    const tag = planif
      ? '<span class="status yellow" style="padding:3px 10px;font-size:0.7rem">📅 Planificada</span>'
      : finished
        ? '<span class="status green" style="padding:3px 10px;font-size:0.7rem">✅ Ejecutada</span>'
        : '<span class="status green" style="padding:3px 10px;font-size:0.7rem">▶ En curso</span>';
    return `
      <div style="flex:1;padding:18px;border-radius:12px;background:white;border:1.5px solid var(--bg-panel-alt)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px">
          <strong style="font-size:0.7rem;letter-spacing:0.1em;color:var(--text-muted);text-transform:uppercase">Opción ${label}</strong>
          ${tag}
        </div>
        <div style="font-size:1.05rem;margin-bottom:4px"><strong>${esc(v.inicio)}</strong> → <strong>${esc(v.fin)}</strong></div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:14px">${v.dias} día${v.dias === 1 ? '' : 's'} · ${esc(v.origen)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="resolverConflicto('${side.cid}', ${side.idx}, ${side.otherIdx})" style="flex:1;padding:8px 10px;font-size:0.78rem">Conservar esta</button>
          <button class="btn btn-outline btn-sm" onclick="editarVacacionReal('${side.cid}', ${side.idx})" title="Editar fechas" style="padding:8px 10px;font-size:0.78rem">✏️ Editar</button>
        </div>
      </div>`;
  };

  const tarjetas = [...porConsultor.values()].map(group => {
    const c = group.consultor;
    const inner = group.items.map((k, i) => {
      const a = { cid: c.id, idx: k.a.idx, otherIdx: k.b.idx, v: k.a.v };
      const b = { cid: c.id, idx: k.b.idx, otherIdx: k.a.idx, v: k.b.v };
      // Calcular días de superposición visible
      const overlapStart = k.a.v.inicio > k.b.v.inicio ? k.a.v.inicio : k.b.v.inicio;
      const overlapEnd = k.a.v.fin < k.b.v.fin ? k.a.v.fin : k.b.v.fin;
      return `
        <div style="padding:18px;border-radius:14px;background:var(--accent-tint-4);border:1px solid var(--accent-tint-20);${i > 0 ? 'margin-top:14px' : ''}">
          <div style="margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:0.7rem;font-weight:800;letter-spacing:0.08em;color:var(--accent);text-transform:uppercase">Conflicto ${i+1}</span>
            <span style="font-size:0.78rem;color:var(--text-muted)">→ se cruzan en <strong style="color:var(--bg-panel)">${overlapStart}</strong> a <strong style="color:var(--bg-panel)">${overlapEnd}</strong></span>
          </div>
          <div style="display:flex;gap:14px;align-items:stretch;flex-wrap:wrap">
            ${renderTarjeta('A', a)}
            <div style="display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--accent);font-size:0.9rem;letter-spacing:0.1em">VS</div>
            ${renderTarjeta('B', b)}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="card" style="margin-bottom:18px">
        <div style="padding:18px 22px 14px;border-bottom:1px solid var(--bg-panel-alt);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--bg-panel)">${esc(c.nombre)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${esc(c.vertical || c.cargo)}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="verDetalleConsultor('${c.id}')" style="padding:6px 14px;font-size:0.78rem">Ver perfil completo</button>
        </div>
        <div style="padding:18px 22px">
          ${inner}
        </div>
      </div>`;
  }).join('');

  // ===== SECCIÓN DE COBERTURA (3+ M/SM en misma vertical, fechas que se cruzan) =====
  const renderCobertura = (w) => {
    const dias = (() => {
      const a = new Date(w.inicio + 'T00:00:00');
      const b = new Date(w.fin + 'T00:00:00');
      return Math.round((b - a) / 86400000) + 1;
    })();
    return `
      <div class="callout ${w.aprobado ? 'callout-ok' : 'callout-warn'}" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-size:0.7rem;font-weight:800;letter-spacing:0.08em;color:var(${w.aprobado ? '--status-ok' : '--status-warn'});text-transform:uppercase">${w.aprobado ? '✓ Aprobado · Cobertura' : '⚠️ Cobertura de liderazgo'}</span>
              <span style="font-size:0.78rem;color:var(--text-muted)">${w.miembros.length} líderes en <strong style="color:var(--bg-panel)">${w.vertical}</strong></span>
            </div>
            <div style="font-size:1rem"><strong>${w.inicio}</strong> → <strong>${w.fin}</strong> <span style="color:var(--text-muted);font-size:0.85rem">(${dias} día${dias === 1 ? '' : 's'})</span></div>
          </div>
          <div style="display:flex;gap:8px">
            ${w.aprobado
              ? `<button class="btn btn-outline btn-sm" onclick="reabrirCobertura('${w.key}')" style="padding:7px 14px;font-size:0.78rem">Reabrir</button>`
              : `<button class="btn btn-primary btn-sm" onclick="aprobarCobertura('${w.key}')" style="padding:7px 14px;font-size:0.78rem">✓ Aprobar y silenciar</button>`}
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${w.miembros.map(m => `
            <div onclick="verDetalleConsultor('${m.c.id}')" style="cursor:pointer;padding:8px 14px;border-radius:10px;background:white;border:1px solid var(--bg-panel-alt);font-size:0.85rem">
              <strong style="color:var(--bg-panel)">${esc(shortenName(m.c.nombre))}</strong>
              <span style="color:var(--text-muted);margin-left:6px;font-size:0.78rem">${esc(m.c.cargo) || '—'}</span>
              ${m.v ? `<span style="color:var(--text-muted);margin-left:6px;font-size:0.75rem">· ${m.v.inicio}→${m.v.fin}</span>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  };

  const seccionCobertura = (coberturaPendiente.length > 0 || coberturaAprobada.length > 0) ? `
    <div class="section" style="margin-top:8px">
      <div class="section-title" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span>🎯 Cobertura de Liderazgo</span>
        ${coberturaPendiente.length > 0 ? `<span class="tag-pending">${coberturaPendiente.length} sin aprobar</span>` : ''}
      </div>
      <div style="padding:12px 16px;border-radius:10px;background:var(--brand-tint-4);border:1px solid var(--brand-tint-10);margin-bottom:14px;font-size:0.82rem;color:var(--text-on-light);line-height:1.5">
        Cuando 3 o más Managers o Senior Managers de la misma vertical están de vacaciones en días que se cruzan, aparece una alerta. <strong>No bloquea ni borra nada</strong> · sólo te avisa para que decides aprobarlo (si la cobertura está cubierta) o gestionarlo.
      </div>
      ${coberturaPendiente.map(renderCobertura).join('')}
      ${coberturaAprobada.length > 0 ? `
        <details style="margin-top:10px">
          <summary style="cursor:pointer;font-size:0.85rem;color:var(--text-muted);padding:8px 0">${coberturaAprobada.length} aprobado${coberturaAprobada.length === 1 ? '' : 's'} previamente (clic para ver)</summary>
          <div style="margin-top:10px">${coberturaAprobada.map(renderCobertura).join('')}</div>
        </details>` : ''}
    </div>
  ` : '';

  const seccionOverlap = conflictos.length > 0 ? `
    <div class="section" style="margin-top:24px">
      <div class="section-title" style="display:flex;align-items:center;gap:10px">
        <span>📅 Fechas Superpuestas</span>
        <span style="background:var(--accent);color:white;font-size:0.7rem;font-weight:800;padding:2px 9px;border-radius:10px">${conflictos.length}</span>
      </div>
      <div style="padding:12px 16px;border-radius:10px;background:var(--brand-tint-4);border:1px solid var(--brand-tint-12);margin-bottom:14px;font-size:0.82rem;color:var(--text-on-light);line-height:1.5">
        <strong>💡 Cómo resolver:</strong> usa <em>Conservar esta</em> para borrar el otro registro, o <em>✏️ Editar</em> para ajustar las fechas. La validación de superposición bloqueará el guardado si las nuevas fechas siguen chocando.
      </div>
      ${tarjetas}
    </div>
  ` : '';

  return `
    <div class="page-header">
      <h1><span style="font-size:24px; vertical-align:middle; margin-right:8px">⚠️</span>Conflictos de Vacaciones <span style="background:var(--accent);color:white;font-size:0.8rem;padding:3px 10px;border-radius:12px;margin-left:8px;vertical-align:middle">${totalPendientes}</span></h1>
      <p>Cobertura de liderazgo y registros con fechas superpuestas</p>
    </div>

    ${seccionCobertura}
    ${seccionOverlap}
  `;
}

function renderAuditoria() {
  const cons = getActiveConsultores();
  const outliers = [];
  
  cons.forEach(c => {
    const ant = calcAntiguedad(c.fechaIngreso, c.fechaCorteGabin);
    const disp = calcDiasGabin(c);
    const real = calcDiasGozadosReales(c.id);
    const hist = calcDiasGozadosGabin(c);
    const diff = Math.abs(real - hist);
    const issues = [];
    
    // 1. Error de Conciliación de Nombres (No hay datos de Gabin)
    if (!c.diasPendientesHR && ant.years > 0) {
      issues.push({ type: 'danger', msg: 'Sin vinculación con Gabin (Posible error de nombre)' });
    }
    
    // 2. Discrepancia Crítica (Real vs Gabin)
    if (diff > 15) {
      issues.push({ type: 'warning', msg: `Discrepancia alta: Real (${real}) vs Gabin (${hist}). Dif: ${diff} días.` });
    }
    
    // 3. Saldo Negativo
    if (calcDiasDisponibles(c) < 0) {
      issues.push({ type: 'danger', msg: 'Saldo negativo: Ha gozado más de lo que le corresponde legalmente.' });
    }
    
    // 4. Acumulación Excesiva
    if (disp >= 30) {
      issues.push({ type: 'info', msg: `Alerta de Acumulación: ${disp} días pendientes.` });
    }

    if (issues.length > 0) {
      outliers.push({ c, issues });
    }
  });

  return `
    <div class="page-header">
      <h1>🔍 Auditoría Senior QA</h1>
      <p>Detección automática de inconsistencias y riesgos de compensación.</p>
    </div>
    
    <div class="card" style="padding:0">
      <div class="table-container">
        <table style="width:100%">
          <thead style="background:var(--bg-panel-alt)">
            <tr>
              <th style="padding:15px">Consultor</th>
              <th>Hallazgos de Auditoría</th>
              <th style="text-align:right; padding-right:15px">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${outliers.length === 0 ? '<tr><td colspan="3" style="padding:40px; text-align:center">✅ No se detectaron inconsistencias críticas.</td></tr>' : 
              outliers.map(o => `
              <tr>
                <td style="padding:15px">
                  <strong>${o.c.nombre}</strong><br>
                  <span style="font-size:0.75rem; color:var(--text-muted)">Ingreso: ${o.c.fechaIngreso}</span>
                </td>
                <td>
                  ${o.issues.map(i => `<div style="margin-bottom:4px"><span class="status ${i.type === 'danger' ? 'red' : (i.type === 'warning' ? 'orange' : 'blue')}" style="padding:2px 8px; font-size:0.7rem">${i.msg}</span></div>`).join('')}
                </td>
                <td style="text-align:right; padding-right:15px">
                  <button class="btn secondary sm" onclick="verDetalleConsultor('${o.c.id}')">Revisar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCumpleaños() {
  const cons = getActiveConsultores().filter(c => c.cumpleaños);
  const d = new Date();
  const todayMMDD = String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  
  // Sort by month/day
  cons.sort((a, b) => {
    const da = new Date(a.cumpleaños + 'T00:00:00');
    const db = new Date(b.cumpleaños + 'T00:00:00');
    const ma = da.getMonth(), mb = db.getMonth();
    if (ma !== mb) return ma - mb;
    return da.getDate() - db.getDate();
  });

  const hoyCumplen = cons.filter(c => {
    const cDate = new Date(c.cumpleaños + 'T00:00:00');
    return String(cDate.getMonth()+1).padStart(2,'0') + '-' + String(cDate.getDate()).padStart(2,'0') === todayMMDD;
  });

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px">
      <div>
        <h1>🎂 Calendario de Cumpleaños</h1>
        <p>Fechas especiales de todo el equipo</p>
      </div>
      <div style="display:flex; gap:10px">
        <button class="btn btn-outline" onclick="navigateTo('importar')" style="display:flex; align-items:center; gap:8px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Importar Excel
        </button>
        <button class="btn btn-primary" onclick="enviarCorreoCumpleaños()" style="display:flex; align-items:center; gap:8px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>
          Enviar Recordatorio
        </button>
      </div>
    </div>

    ${cons.length === 0 ? `
      <div class="card" style="text-align:center; padding:60px 20px; border: 2px dashed var(--border)">
        <div style="font-size:4rem; margin-bottom:20px">🎂</div>
        <h2 style="color:var(--bg-panel); margin-bottom:10px">No hay cumpleaños registrados</h2>
        <p style="color:var(--text-muted); max-width:400px; margin:0 auto 24px">Carga el archivo Excel de cumpleaños para ver las fechas especiales de todo el equipo y recibir recordatorios.</p>
        <button class="btn btn-primary btn-lg" onclick="navigateTo('importar')">Ir a Importación de Datos</button>
      </div>
    ` : `
      ${hoyCumplen.length > 0 ? `
        <div class="card" style="background: var(--brand-tint-2); border: 2px solid var(--accent); margin-bottom: 25px">
          <div style="display:flex; align-items:center; gap:15px; margin-bottom:10px">
            <span style="font-size:2rem">🎉</span>
            <h3 style="color:var(--accent)">¡Hoy es el gran día!</h3>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:10px">
            ${hoyCumplen.map(c => `
              <div class="chip" style="background:white; border:1px solid var(--accent); color:var(--accent); font-weight:700; padding:8px 15px; border-radius:20px; cursor:pointer" onclick="verDetalleConsultor('${c.id}')">
                ${esc(c.nombre)}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="grid-3">
        ${[0,1,2,3,4,5,6,7,8,9,10,11].map(m => {
          const enEsteMes = cons.filter(c => new Date(c.cumpleaños + 'T00:00:00').getMonth() === m);
          return `
            <div class="card" style="${enEsteMes.length > 0 ? '' : 'opacity:0.6'}">
              <h4 style="border-bottom: 1px solid var(--border); padding-bottom:10px; margin-bottom:12px; color:var(--bg-panel)">
                ${meses[m]}
              </h4>
              <div style="display:flex; flex-direction:column; gap:8px">
                ${enEsteMes.length === 0 ? '<p style="font-size:0.8rem; color:var(--text-muted)">Sin cumpleaños</p>' : 
                  enEsteMes.map(c => {
                    const cDate = new Date(c.cumpleaños + 'T00:00:00');
                    const isToday = String(cDate.getMonth()+1).padStart(2,'0') + '-' + String(cDate.getDate()).padStart(2,'0') === todayMMDD;
                    return `
                      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-radius:8px; cursor:pointer; ${isToday ? 'background:var(--brand-tint-5); font-weight:700; border:1px solid var(--accent)' : 'border:1px solid transparent'}" 
                           onclick="verDetalleConsultor('${c.id}')"
                           onmouseover="this.style.background='var(--bg-panel-alt)'"
                           onmouseout="this.style.background='${isToday ? 'var(--brand-tint-5)' : 'transparent'}'">
                        <div style="display:flex; flex-direction:column">
                          <span style="font-size:0.85rem">${esc(shortenName(c.nombre))}</span>
                          ${c.vertical ? `<span style="font-size:0.65rem; color:var(--text-muted)">${esc(c.vertical)}</span>` : ''}
                        </div>
                        <span style="font-size:0.8rem; color:var(--bg-panel); font-weight:600">${cDate.getDate()}</span>
                      </div>
                    `;
                  }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

function enviarCorreoCumpleaños() {
  const d = new Date();
  const todayMMDD = String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  const cons = getActiveConsultores();
  const cumpleañeros = cons.filter(c => {
    if (!c.cumpleaños) return false;
    const cDate = new Date(c.cumpleaños + 'T00:00:00');
    return String(cDate.getMonth()+1).padStart(2,'0') + '-' + String(cDate.getDate()).padStart(2,'0') === todayMMDD;
  });

  if (cumpleañeros.length === 0) {
    showToast('No hay cumpleaños registrados para hoy.', 'info');
    return;
  }

  const nombres = cumpleañeros.map(c => c.nombre).join(', ');
  const subject = encodeURIComponent('🎂 Recordatorio: Cumpleaños de hoy en el equipo');
  const body = encodeURIComponent(`Hola equipo,\n\nHoy celebramos el cumpleaños de:\n\n${cumpleañeros.map(c => '• ' + c.nombre).join('\n')}\n\n¡No olviden saludarlos!\n\nAtte,\nSistema VacaPeru`);
  
  const mailto = `mailto:nebernal@minsait.com?subject=${subject}&body=${body}`;
  window.location.href = mailto;
}
