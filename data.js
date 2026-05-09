// ===== FIREBASE CONFIGURATION =====
const DB_KEY = 'vacaperu_data';
// Reemplaza los valores de abajo con tu firebaseConfig real
const firebaseConfig = {
  apiKey: "AIzaSyDReBul-ERlycVnC12_WRsL2jbPFdnNUG0",
  authDomain: "mbc-vacations.firebaseapp.com",
  databaseURL: "https://mbc-vacations-default-rtdb.firebaseio.com",
  projectId: "mbc-vacations",
  storageBucket: "mbc-vacations.firebasestorage.app",
  messagingSenderId: "191163768219",
  appId: "1:191163768219:web:edf77a7805d04915dd153e"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

const APP_INITIAL = { 
  consultores: [], 
  solicitudes: [], 
  ventaVacaciones: [], 
  importaciones: [],
  config: {
    empresa: "Indra / Minsait",
    normativa: "DL 713 & DL 1405"
  }
};

// Filtro de Vertical: vive en localStorage (por usuario), NO se sincroniza en la nube
const FILTRO_VERTICAL_KEY = 'vacaperu_filtro_vertical';
function getFiltroVertical() {
  try {
    const raw = localStorage.getItem(FILTRO_VERTICAL_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v) && v.length) return v;
    }
  } catch(e) {}
  return ['Todos'];
}
function setFiltroVertical(arr) {
  const safe = (Array.isArray(arr) && arr.length) ? arr : ['Todos'];
  localStorage.setItem(FILTRO_VERTICAL_KEY, JSON.stringify(safe));
}

let APP = APP_INITIAL;
let isFirstLoad = true;
let isCloudConnected = false; // Nueva bandera de estado
let dataLoadedCallback = null;

// Escuchar cambios en la base de datos (Realtime)
database.ref('vacaperu_data').on('value', (snapshot) => {
  isCloudConnected = true; // Si llega un valor, estamos conectados
  const cloudData = snapshot.val();
  if (cloudData) {
    APP = cloudData;
    // Migración interna para asegurar que existan los arrays
    if (!APP.consultores) APP.consultores = [];
    if (!APP.solicitudes) APP.solicitudes = [];
    if (!APP.ventaVacaciones) APP.ventaVacaciones = [];
    if (!APP.importaciones) APP.importaciones = [];
    if (!APP.config) APP.config = APP_INITIAL.config;
    // filtroVertical migró a localStorage (por usuario), ya no se persiste en la nube
    if (APP.config.filtroVertical !== undefined) delete APP.config.filtroVertical;
  } else {
    // Si la base está vacía, intentamos cargar de localStorage por si acaso
    const local = localStorage.getItem(DB_KEY);
    if (local) {
      APP = JSON.parse(local);
      saveData(APP); // Subir local a nube
    } else {
      APP = JSON.parse(JSON.stringify(APP_INITIAL));
      saveData(APP);
    }
  }
  
  if (isFirstLoad) {
    isFirstLoad = false;
    if (dataLoadedCallback) dataLoadedCallback();
  } else {
    // Si ya cargó la primera vez y algo cambia, refrescar vista actual
    if (typeof navigateTo === 'function') navigateTo(currentView);
  }
}, (error) => {
  console.error("Firebase Error:", error);
  // Fallback a local si falla Firebase
  const local = localStorage.getItem(DB_KEY);
  if (local) APP = JSON.parse(local);
  
  // Mostrar error en la UI si existe showToast
  if (typeof showToast === 'function') {
    if (error.message.includes('permission_denied')) {
      showToast('Error de Nube: Acceso denegado. Revisa las reglas de seguridad en Firebase.', 'error');
    } else {
      showToast('Error de Nube: No se pudo conectar. Verifica la URL de la base de datos.', 'error');
    }
  }

  if (isFirstLoad) {
    isFirstLoad = false;
    if (dataLoadedCallback) dataLoadedCallback();
  }
});

function saveData(data) {
  // Solo intentamos guardar en nube si la base de datos está inicializada correctamente
  try {
    database.ref('vacaperu_data').set(data).catch(err => {
      console.error("Error al guardar en nube:", err);
      if (typeof showToast === 'function' && err.message.includes('permission_denied')) {
        showToast('Error: No tienes permiso para guardar datos en la nube.', 'error');
      }
    });
  } catch(e) {
    console.error("Database ref failed:", e);
  }
  
  // Siempre mantenemos el local como respaldo crítico
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}


// ===== CÁLCULOS LEGALES PERÚ =====
function calcAntiguedad(fechaIngreso, fechaCorte) {
  if (!fechaIngreso) return { years: 0, months: 0, totalMonths: 0 };
  const toISO = (val) => {
    if (typeof val !== 'string') return val;
    const parts = val.split(/[\/-]/);
    if (parts.length === 3 && parts[0].length !== 4) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    return val;
  };
  const isoStr = toISO(fechaIngreso);
  const ing = new Date(isoStr.replace(/-/g, '\/'));
  const ref = fechaCorte
    ? new Date(toISO(fechaCorte).replace(/-/g, '\/'))
    : new Date();
  let years = ref.getFullYear() - ing.getFullYear();
  let months = ref.getMonth() - ing.getMonth();
  if (ref.getDate() < ing.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years < 0) { years = 0; months = 0; }
  return { years, months, totalMonths: years * 12 + months };
}

function calcDiffDias(f1, f2) {
  if (!f1 || !f2) return 0;
  const toISO = (val) => {
    if (typeof val !== 'string') return val;
    const parts = val.split(/[\/-]/);
    if (parts.length === 3 && parts[0].length !== 4) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    return val;
  };
  const d1 = new Date(toISO(f1));
  const d2 = new Date(toISO(f2));
  d1.setHours(0,0,0,0); d2.setHours(0,0,0,0);
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// ===== CONSULTOR CRUD =====
function addConsultor(c) {
  c.id = uid();
  c.estado = 'activo';
  c.diasPendientesHR = c.diasPendientesHR || 0;
  c.fechaCreacion = new Date().toISOString();
  APP.consultores.push(c);
  saveData(APP);
  return c;
}

function updateConsultor(id, updates) {
  const i = APP.consultores.findIndex(c => c.id === id);
  if (i >= 0) { Object.assign(APP.consultores[i], updates); saveData(APP); }
}

function deleteConsultor(id) {
  APP.consultores = APP.consultores.filter(c => c.id !== id);
  APP.solicitudes = APP.solicitudes.filter(s => s.consultorId !== id);
  saveData(APP);
}

function getConsultor(id) { return APP.consultores.find(c => c.id === id); }
function getActiveConsultores() { return APP.consultores.filter(c => c.estado === 'activo'); }

// ===== SOLICITUDES CRUD =====
function addSolicitud(s) {
  s.id = uid();
  s.fechaSolicitud = new Date().toISOString();
  s.estado = s.estado || 'solicitado';
  APP.solicitudes.push(s);
  saveData(APP);
  return s;
}

function updateSolicitud(id, updates) {
  const i = APP.solicitudes.findIndex(s => s.id === id);
  if (i >= 0) { Object.assign(APP.solicitudes[i], updates); saveData(APP); }
}

function deleteSolicitud(id) {
  APP.solicitudes = APP.solicitudes.filter(s => s.id !== id);
  saveData(APP);
}

function getSolicitudesConsultor(cid) {
  return APP.solicitudes.filter(s => s.consultorId === cid);
}

// ===== VENTA VACACIONES =====
function addVenta(v) {
  v.id = uid();
  v.fecha = new Date().toISOString();
  APP.ventaVacaciones.push(v);
  saveData(APP);
  return v;
}

function calcTotalHistorico(consultor) {
  const ant = calcAntiguedad(consultor.fechaIngreso, consultor.fechaCorteGabin);
  // Según ley: 30 días por cada año completo de servicios (a la fecha de corte del reporte)
  return ant.years * 30;
}

function calcDiasGozadosGabin(c) {
  const ant = calcAntiguedad(c.fechaIngreso, c.fechaCorteGabin);
  const pendiente = c.diasPendientesHR || 0;
  
  if (ant.years === 0) {
    return 0; // Menos de 1 año, no ha ganado su primer bloque de 30 días
  }
  
  // Días gozados históricamente = (Total de días ganados por años cumplidos) - (Días que aún tiene pendientes)
  // Ejemplo: 2 años = 60 ganados. Si le quedan 30 pendientes, entonces gozó 30.
  const gozados = (ant.years * 30) - pendiente;
  
  // Safety check: no puede ser negativo
  return gozados < 0 ? 0 : gozados;
}

// Una vacación está "planificada" si su fecha de inicio es posterior a hoy
// (aún no ha empezado). Si ya empezó (o no tiene fecha de inicio), cuenta como ejecutada.
function esVacacionPlanificada(v) {
  if (!v || !v.inicio) return false;
  const hoyISO = new Date().toISOString().slice(0, 10);
  return v.inicio > hoyISO;
}

function calcDiasGozadosReales(consultorId) {
  const c = getConsultor(consultorId);
  if (!c || !c.realVacations) return 0;
  // Solo suma vacaciones ejecutadas o en curso; las planificadas (futuras) se excluyen
  return c.realVacations
    .filter(v => !esVacacionPlanificada(v))
    .reduce((sum, v) => sum + (v.dias || 0), 0);
}

// Recorre todos los consultores y devuelve la lista de pares de vacaciones
// que se superponen (cada par aparece una sola vez).
// Estructura: [{ consultor, a:{idx,v}, b:{idx,v} }, ...]
function findAllConflictos() {
  const conflictos = [];
  (APP.consultores || []).forEach(c => {
    const rv = c.realVacations || [];
    for (let i = 0; i < rv.length; i++) {
      for (let j = i + 1; j < rv.length; j++) {
        const a = rv[i], b = rv[j];
        if (!a || !b || !a.inicio || !a.fin || !b.inicio || !b.fin) continue;
        if (!(a.fin < b.inicio || a.inicio > b.fin)) {
          conflictos.push({ consultor: c, a: { idx: i, v: a }, b: { idx: j, v: b } });
        }
      }
    }
  });
  return conflictos;
}

// Detecta si un rango [inicio, fin] se cruza con alguna vacación existente
// del mismo consultor. Devuelve la vacación conflictiva (con su índice) o null.
// excludeIdx evita comparar contra el propio registro al editar.
function findVacacionSuperpuesta(realVacations, inicio, fin, excludeIdx) {
  if (!Array.isArray(realVacations) || !inicio || !fin) return null;
  for (let i = 0; i < realVacations.length; i++) {
    if (i === excludeIdx) continue;
    const v = realVacations[i];
    if (!v || !v.inicio || !v.fin) continue;
    // Dos rangos se solapan si NO (fin < otroInicio OR inicio > otroFin)
    if (!(fin < v.inicio || inicio > v.fin)) {
      return { v, idx: i };
    }
  }
  return null;
}

function calcDiasPlanificadosReales(consultorId) {
  const c = getConsultor(consultorId);
  if (!c || !c.realVacations) return 0;
  return c.realVacations
    .filter(v => esVacacionPlanificada(v))
    .reduce((sum, v) => sum + (v.dias || 0), 0);
}

function calcDiasDisponibles(consultor) {
  const totalPool = calcTotalHistorico(consultor);
  const gozadosHist = calcDiasGozadosReales(consultor.id);
  const vendidos = calcDiasVendidos(consultor.id);
  return totalPool - gozadosHist - vendidos;
}

function calcDiasVendidos(consultorId) {
  return APP.ventaVacaciones
    .filter(v => v.consultorId === consultorId)
    .reduce((sum, v) => sum + (v.dias || 0), 0);
}

function calcDiasGabin(consultor) {
  // Balance oficial según RRHH
  return consultor.diasPendientesHR || 0;
}

function calcDiasGozadosDesdeMesHR(consultor) {
  if (!consultor.fechaUltimaImportacion) return 0;
  const desde = new Date(consultor.fechaUltimaImportacion);
  return APP.solicitudes
    .filter(s => s.consultorId === consultor.id && s.tipo === 'descanso'
      && ['aprobado','en_curso','completado'].includes(s.estado)
      && new Date(s.fechaSolicitud) >= desde)
    .reduce((sum, s) => sum + (s.diasCalendario || 0), 0);
}

function getAlertaLegal(consultor) {
  const disponibles = calcDiasGabin(consultor);
  
  // Lógica Senior: Alerta por ACUMULACIÓN (Independiente de la fecha)
  if (disponibles >= 60) {
    return { nivel: 'critical', msg: `CRÍTICO: Acumulación excesiva (${Math.round(disponibles)} días). Riesgo de indemnización triple.` };
  }
  
  if (!consultor.fechaMaxGabin || disponibles <= 0) {
    if (disponibles > 30) {
      return { nivel: 'warning', msg: `ATENCIÓN: Saldo elevado (${Math.round(disponibles)} días) sin fecha de caducidad registrada.` };
    }
    return { nivel: 'ok', msg: `Sin urgencia (${disponibles} días pendientes)` };
  }
  
  const fMax = new Date(consultor.fechaMaxGabin);
  const hoy = new Date();
  const diffTime = fMax - hoy;
  const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.416);
  const mesesAprox = Math.max(0, Math.ceil(diffMonths));

  // Crítico por CADUCIDAD: <=3 meses con días OR >3 a <=6 meses con >14 días
  if ((diffMonths <= 3 && disponibles > 0) || (diffMonths > 3 && diffMonths <= 6 && disponibles > 14)) {
    return { nivel: 'critical', msg: `CRÍTICO: ${Math.round(disponibles)} días por caducar en ${mesesAprox} meses.` };
  }
  
  // Medio por CADUCIDAD: >3 a <=6 meses con días (implícito <=14) OR >6 a <=9 meses con >=15 días
  if ((diffMonths > 3 && diffMonths <= 6 && disponibles > 0) || (diffMonths > 6 && diffMonths <= 9 && disponibles >= 15)) {
    return { nivel: 'warning', msg: `ATENCIÓN: ${Math.round(disponibles)} días por caducar en ${mesesAprox} meses.` };
  }
  
  // Si tiene saldo pero la caducidad es lejana
  if (disponibles > 30) {
    return { nivel: 'warning', msg: `ATENCIÓN: Saldo elevado (${Math.round(disponibles)} días).` };
  }
  
  return { nivel: 'ok', msg: `Sin riesgo inmediato. Límite en ${mesesAprox} meses.` };
}

function validarSolicitud(consultor, fechaInicio, fechaFin, tipo) {
  const dias = calcDiffDias(fechaInicio, fechaFin);
  const disponibles = calcDiasDisponibles(consultor);
  const errors = [];
  if (dias <= 0) errors.push('Las fechas son inválidas.');
  if (dias > disponibles) errors.push('Solo tiene ' + disponibles + ' días disponibles.');
  if (tipo === 'venta') {
    const yaVendidos = calcDiasVendidos(consultor.id);
    if (yaVendidos + dias > 15) errors.push('Máximo 15 días de venta por periodo (DL 713 Art. 19). Ya vendió ' + yaVendidos + '.');
  }
  return errors;
}

// ===== FERIADOS PERÚ 2025/2026 =====
const FERIADOS_PERU = [
  '01-01','03-28','03-29','05-01','06-07','06-29','07-23','07-28','07-29',
  '08-06','08-30','10-08','10-31','11-01','12-08','12-09','12-25'
];

function esFeriado(dateStr) {
  const d = new Date(dateStr);
  const mmdd = String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  return FERIADOS_PERU.includes(mmdd);
}

// ===== EXPORT/IMPORT =====
function exportarJSON() {
  const blob = new Blob([JSON.stringify(APP, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'recreo_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(url);
}

function importarJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.consultores && data.solicitudes) {
          APP = data;
          saveData(APP);
          resolve(data);
        } else reject('Formato inválido');
      } catch { reject('Error al leer archivo'); }
    };
    reader.readAsText(file);
  });
}

function exportarCSV() {
  let csv = 'Nombre,Cargo,Fecha Ingreso,Días Pendientes HR,Días Gozados,Días Vendidos,Días Disponibles,Alerta\n';
  getActiveConsultores().forEach(c => {
    const al = getAlertaLegal(c);
    csv += `"${c.nombre}","${c.cargo}","${c.fechaIngreso}",${c.diasPendientesHR},${calcDiasGozados(c.id)},${calcDiasVendidos(c.id)},${calcDiasDisponibles(c)},${al.nivel}\n`;
  });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vacaciones_reporte_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
}
