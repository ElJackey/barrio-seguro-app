// === CONFIGURACIÓN ===
const DEFAULT_USERS = [
  { dni: '76478089', pass: 'admin123', name: 'Oficial Mendivil', role: 'policia' },
  { dni: '12345678', pass: '1234', name: 'Juan Vecino', role: 'vecino' }
];

let usersDB = JSON.parse(localStorage.getItem('bs_users_v4')) || DEFAULT_USERS;
let incidentsDB = JSON.parse(localStorage.getItem('bs_incidents_v4')) || [];

const state = {
  user: null,
  zoom: 1,
  center: { lat: -12.121, lng: -77.031 }
};

// === AUTENTICACIÓN ===
function switchAuth(view) {
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-register').classList.add('hidden');
  document.getElementById(`view-${view}`).classList.remove('hidden');
}

function registerSubmit() {
  const name = document.getElementById('reg-name').value;
  const dni = document.getElementById('reg-dni').value;
  const pass = document.getElementById('reg-pass').value;

  if (usersDB.find(u => u.dni === dni)) return alert('DNI ya registrado');

  const newUser = { dni, pass, name, role: 'vecino' };
  usersDB.push(newUser);
  localStorage.setItem('bs_users_v4', JSON.stringify(usersDB));

  alert('¡Registro exitoso!');
  switchAuth('login');
  document.getElementById('login-dni').value = dni;
}

function loginSubmit() {
  const dni = document.getElementById('login-dni').value;
  const pass = document.getElementById('login-pass').value;
  const user = usersDB.find(u => u.dni === dni && u.pass === pass);

  if (user) startApp(user);
  else alert('Credenciales incorrectas');
}

function startApp(user) {
  state.user = user;
  document.getElementById('auth-layer').style.display = 'none';
  document.getElementById('app-layer').classList.remove('hidden');
  
  // Llenar datos básicos UI
  document.getElementById('ui-user-name').textContent = user.name;
  document.getElementById('ui-user-role').textContent = user.role === 'policia' ? 'Fuerza Policial' : 'Residente';
  
  // Llenar Datos del Panel de Perfil
  document.getElementById('profile-name-display').textContent = user.name;
  document.getElementById('profile-role-display').textContent = user.role === 'policia' ? 'Comandante' : 'Vecino Verificado';
  document.getElementById('profile-dni-display').textContent = `DNI: ${user.dni}`;
  
  // Contar reportes hechos por este usuario
  const userReports = incidentsDB.filter(inc => inc.reporter === user.name).length;
  document.getElementById('stat-reports-count').textContent = userReports;

  if(user.role === 'policia') {
    document.querySelector('.floating-header').style.background = '#1e293b';
    document.querySelector('.floating-header').style.color = 'white';
    document.getElementById('dock-sos-btn').style.display = 'none';
    document.getElementById('header-avatar').innerHTML = '👮‍♂️';
    document.querySelector('.profile-avatar-large').innerHTML = '👮‍♂️';
  } else {
    document.getElementById('header-avatar').innerHTML = '👤';
    document.querySelector('.profile-avatar-large').innerHTML = '👤';
  }

  setTimeout(() => { initMap(); }, 300);
}

function logout() { location.reload(); }

// === MAPA ===
function initMap() {
  renderPins();
  renderList();
}

function zoomMap(delta) {
  state.zoom += delta;
  if (state.zoom < 0.8) state.zoom = 0.8; if (state.zoom > 3) state.zoom = 3;
  const map = document.getElementById('map-inner');
  map.style.transform = `scale(${state.zoom})`;
  document.documentElement.style.setProperty('--zoom', state.zoom);
}

function renderPins() {
  const container = document.getElementById('map-inner');
  const viewport = document.getElementById('map-viewport');
  if (viewport.clientWidth === 0) return;

  container.innerHTML = '';
  const centerX = viewport.clientWidth / 2;
  const centerY = viewport.clientHeight / 2;
  const scaleFactor = 50000;

  incidentsDB.forEach(inc => {
    const el = document.createElement('div');
    const statusClass = inc.status === 'active' ? 'active' : inc.level;
    el.className = `map-pin ${statusClass}`;
    
    const x = centerX + (inc.lngOffset * scaleFactor);
    const y = centerY - (inc.latOffset * scaleFactor);
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    
    let icon = 'ph-warning';
    if(inc.type === 'Robo') icon = 'ph-hand-grabbing';
    if(inc.type === 'S.O.S') icon = 'ph-siren';
    if(inc.type === 'Accidente') icon = 'ph-ambulance';
    if(inc.status === 'active') icon = 'ph-police-car';

    el.innerHTML = `
      <div class="pin-circle"><i class="ph-fill ${icon}"></i></div>
      ${inc.type === 'S.O.S' && inc.status !== 'active' ? '<div class="pin-pulse"></div>' : ''}
    `;
    el.onclick = () => openActionModal(inc);
    container.appendChild(el);
  });
}

// === ACCIONES Y ESTADOS ===
function openActionModal(inc) {
  const isPolice = state.user.role === 'policia';
  let msg = `📌 ${inc.type}\n👤 ${inc.reporter}\n📝 ${inc.desc}\n\nESTADO: ${inc.status === 'active' ? '🟢 EN CAMINO' : '⚪ PENDIENTE'}`;

  if (isPolice) {
    if (inc.status !== 'active') {
      if(confirm(`${msg}\n\n¿Desea INICIAR DESPLAZAMIENTO a este incidente?`)) {
        updateStatus(inc.id, 'active');
      }
    } else {
      alert("✅ Ya hay unidades asignadas a este caso.");
    }
  } else {
    alert(msg + (inc.status === 'active' ? "\n\n👮‍♂️ ¡LA POLICÍA ESTÁ EN CAMINO!" : "\n\nEsperando asignación..."));
  }
}

function updateStatus(id, status) {
  const index = incidentsDB.findIndex(i => i.id === id);
  if(index !== -1) {
    incidentsDB[index].status = status;
    localStorage.setItem('bs_incidents_v4', JSON.stringify(incidentsDB));
    renderPins();
    renderList();
    alert("🚨 Estado Actualizado: Unidad en Camino.\nEl vecino ha sido notificado.");
  }
}

// === REPORTES ===
function triggerPanic() {
  const btn = document.querySelector('.panic-slider');
  const original = btn.innerHTML;
  btn.innerHTML = '📡 GPS Localizando...';
  btn.style.background = '#334155'; btn.style.color = 'white';

  setTimeout(() => {
    createIncident('S.O.S', 'high', '🚨 ALERTA DE PÁNICO SILENCIOSA');
    closeModal('sos');
    alert('🚨 TU UBICACIÓN HA SIDO ENVIADA A LA POLICÍA');
    btn.innerHTML = original; btn.style.background = ''; btn.style.color = '';
    showTab('map');
  }, 1500);
}

function sendReport(type) {
  const detail = prompt(`Detalle del ${type} (Opcional):`, "");
  createIncident(type, (type==='Robo'||type==='Violencia')?'high':'med', detail || `Reporte de ${type}`);
  closeModal('sos');
  showTab('alerts');
}

function createIncident(type, level, desc) {
  const newInc = {
    id: Date.now(),
    type, level, desc, status: 'pending',
    latOffset: (Math.random() - 0.5) * 0.003,
    lngOffset: (Math.random() - 0.5) * 0.003,
    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    reporter: state.user.name
  };
  incidentsDB.unshift(newInc);
  localStorage.setItem('bs_incidents_v4', JSON.stringify(incidentsDB));
  renderPins();
  renderList();
}

// === PANELES ===
function renderList() {
  const list = document.getElementById('feed-list');
  list.innerHTML = '';
  document.getElementById('alert-count').textContent = incidentsDB.length;

  incidentsDB.forEach(inc => {
    const item = document.createElement('div');
    item.className = 'feed-item';
    const isSOS = inc.type === 'S.O.S';
    const statusBadge = inc.status === 'active' 
      ? '<span class="status-tag st-active">En Camino 👮‍♂️</span>' 
      : '<span class="status-tag st-pending">Pendiente</span>';

    item.innerHTML = `
      <div class="feed-icon" style="background: ${isSOS ? 'var(--danger)' : '#e2e8f0'}; color: ${isSOS ? 'white' : 'var(--text)'}">
        <i class="ph-fill ${isSOS ? 'ph-siren' : 'ph-warning'}"></i>
      </div>
      <div class="feed-content">
        <div class="feed-top"><strong>${inc.type}</strong>${statusBadge}</div>
        <p>${inc.desc}</p>
        <div class="feed-meta"><span>${inc.time}</span><small style="color:var(--accent)">${inc.reporter}</small></div>
      </div>
    `;
    item.onclick = () => { showTab('map'); openActionModal(inc); };
    list.appendChild(item);
  });
}

function showTab(tabId) {
  document.querySelectorAll('.bottom-drawer').forEach(d => d.classList.add('hidden'));
  document.querySelectorAll('.dock-item').forEach(i => i.classList.remove('active'));
  
  if (tabId === 'map') {
    document.querySelector('[onclick="showTab(\'map\')"]').classList.add('active');
    renderPins();
    return;
  }
  document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');
  
  if (tabId === 'alerts') {
    document.getElementById('drawer-alerts').classList.remove('hidden');
    renderList();
  }
  if (tabId === 'directory') {
    document.getElementById('drawer-directory').classList.remove('hidden');
  }
  if (tabId === 'profile') { // LOGICA PARA ABRIR PERFIL
    document.getElementById('drawer-profile').classList.remove('hidden');
  }
}

function makeCall(name) { if(confirm(`¿Llamar a ${name}?`)) alert(`📞 Conectando...`); }
function openModal(id) { document.getElementById(`modal-${id}`).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(`modal-${id}`).classList.add('hidden'); }
function geolocate() { alert("📍 GPS Calibrado"); }

if(state.user) startApp(state.user);