// --- UTILIDADES ---
const $ = id => document.getElementById(id);
const money = n => "$" + parseFloat(n).toFixed(2);
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
const dateStr = d => d.toLocaleString('es-MX', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });

// --- BASES DE DATOS SIMULADAS (Estilo Firestore) ---
let DB = {
  usuarios: [
    { id: 'u1', nombre: 'Admin', correo: 'admin@tienda.com', rol: 'admin', activo: true },
    { id: 'u2', nombre: 'Juan Pérez', correo: 'cobrador@tienda.com', rol: 'cobrador', activo: true }
  ],
  productos: [
    { id: 'p1', bar: '750102050001', sku: 'LALA-1L', name: 'Leche Lala Entera 1 L', dep: 'Abarrotes', unit: 'pza', price: 27.5, iva: 0, stock: 40, min: 20, activo: true },
    { id: 'p2', bar: '750100011120', sku: 'BIMBO-BL', name: 'Pan Bimbo Blanco', dep: 'Abarrotes', unit: 'pza', price: 46, iva: 0, stock: 5, min: 10, activo: true },
    { id: 'p3', bar: '3', sku: 'AZU-KG', name: 'Azúcar estándar suelta', dep: 'Abarrotes', unit: 'kg', price: 34, iva: 0, stock: 2.5, min: 10, activo: true }
  ],
  privado: { // Separado por seguridad (simulando backend real)
    'p1': { cost: 22, prov: 'Lala' }, 'p2': { cost: 35, prov: 'Bimbo' }, 'p3': { cost: 28, prov: 'Central Abastos' }
  },
  movimientos: [], // Kardex
  reportesCaja: [ // Simula reportes enviados por el cobrador
    { id: 'r1', fecha: new Date(Date.now()-3600000), cajero: 'Juan Pérez', tipo: 'Precio incorrecto', prod: 'Coca Cola', nota: 'Marca $19 pero el anaquel dice $17' }
  ],
  avisos: []
};

// Inicialización de Kardex simulado (Inv. Inicial)
if(DB.movimientos.length === 0) {
  DB.productos.forEach(p => logMovimiento(p.id, 'Inv. Inicial', p.stock, 0, p.stock, 'Carga inicial del sistema', 'Admin'));
}

// --- DASHBOARD (Carga inicial) ---
function initDash() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  $("fechaActual").textContent = new Date().toLocaleDateString('es-MX', options);
  
  // Resumen simulado
  $("sumTk").textContent = "14";
  $("sumProd").textContent = "42";
  $("sumCob").textContent = DB.usuarios.filter(u => u.rol === 'cobrador' && u.activo).length;
  $("sumIva").textContent = "$45.60";
  $("sumTot").textContent = "$1,850.00";
  
  updateBadges();
}

function updateBadges() {
  const resurtirCount = DB.productos.filter(p => p.stock <= p.min && p.activo).length;
  $("badgeResurtir").textContent = resurtirCount > 0 ? resurtirCount : "";
  
  const repCount = DB.reportesCaja.length;
  $("badgeAv").textContent = repCount;
  $("badgeAv").hidden = repCount === 0;
}

// --- NAVEGACIÓN ---
$("goPOS").onclick = () => alert("Redirigiendo a la pantalla de Caja (POS)...");
$("goCorte").onclick = () => alert("Abriendo asistente de Corte General...");
$("goRep").onclick = () => alert("Abriendo módulo completo de Gráficas y Reportes...");
$("salir").onclick = () => alert("Cerrando sesión...");

// Manejo de Pestañas genérico
document.querySelectorAll('.d-tabs button').forEach(btn => {
  btn.onclick = (e) => {
    const parent = e.target.closest('.d-head').parentElement;
    parent.querySelectorAll('.d-tabs button').forEach(b => b.classList.remove('active'));
    parent.querySelectorAll('.tab-content').forEach(c => c.hidden = true);
    e.target.classList.add('active');
    parent.querySelector(`#tab-${e.target.dataset.tab}`).hidden = false;
    
    // Acciones específicas al cambiar pestaña
    if(e.target.dataset.tab === 'resurtir') renderProductos(true);
    if(e.target.dataset.tab === 'cat') renderProductos(false);
    if(e.target.dataset.tab === 'kardex') renderKardex();
  }
});

// --- MÓDULO PRODUCTOS ---
$("goProd").onclick = () => { renderProductos(false); $("dProd").showModal(); };

function renderProductos(soloResurtir = false) {
  const query = $("busqProd").value.toLowerCase();
  let html = '';
  DB.productos.filter(p => p.activo).forEach(p => {
    if (soloResurtir && p.stock > p.min) return;
    if (query && !p.name.toLowerCase().includes(query) && !p.bar.includes(query)) return;
    
    const isLow = p.stock <= p.min;
    const stockClass = isLow ? 'style="color:var(--bad);font-weight:700"' : '';
    
    html += `<tr>
      <td><small>${p.sku || '-'}</small><br>${p.bar}</td>
      <td>${p.name}</td>
      <td ${stockClass}>${p.stock} ${p.unit} ${isLow ? '⚠️' : ''}</td>
      <td>${money(p.price)}</td>
      <td>
        <button class="action-btn" onclick="openAjuste('${p.id}')">📦 Ajustar Inv.</button>
        <button class="action-btn" onclick="openFormProd('${p.id}')">✏️ Editar</button>
        <button class="action-btn del" onclick="bajaProd('${p.id}')">🗑️ Baja</button>
      </td>
    </tr>`;
  });
  $("listaProd").innerHTML = html || '<tr><td colspan="5" style="text-align:center;padding:20px">No hay productos.</td></tr>';
  updateBadges();
}

$("busqProd").oninput = () => renderProductos(document.querySelector('.d-tabs button[data-tab="resurtir"]').classList.contains('active'));

let editProdId = null;
$("bNuevoProd").onclick = () => openFormProd(null);

function openFormProd(id) {
  editProdId = id;
  const f = $("formProd"); f.reset();
  if(id) {
    const p = DB.productos.find(x => x.id === id);
    const priv = DB.privado[id] || {};
    $("fpTitle").textContent = "Editar Producto";
    $("fpCode").value = p.bar; $("fpSku").value = p.sku; $("fpName").value = p.name;
    $("fpDep").value = p.dep; $("fpUnit").value = p.unit; $("fpPrice").value = p.price;
    $("fpIva").value = p.iva; $("fpStock").value = p.stock; $("fpMin").value = p.min;
    $("fpCost").value = priv.cost \vert{}\vert{} 0; $("fpProv").value = priv.prov || '';
  } else {
    $("fpTitle").textContent = "Nuevo Producto";
    $("fpStock").value = 0;
  }
  $("dFormProd").showModal();
}

$("formProd").onsubmit = e => {
  e.preventDefault();
  const id = editProdId || generateId();
  const prodData = {
    id, bar: $("fpCode").value, sku: $("fpSku").value, name: $("fpName").value,
    dep: $("fpDep").value, unit: $("fpUnit").value, price: parseFloat($("fpPrice").value),
    iva: parseFloat($("fpIva").value), min: parseFloat($("fpMin").value), activo: true
  };
  
  if(!editProdId) { prodData.stock = 0; DB.productos.push(prodData); } 
  else { Object.assign(DB.productos.find(x => x.id === id), prodData); }
  
  DB.privado[id] = { cost: parseFloat($("fpCost").value), prov: $("fpProv").value };
  
  $("dFormProd").close();
  renderProductos();
};

function bajaProd(id) {
  if(!confirm("¿Dar de baja este producto? Ya no saldrá en la caja, pero sus ventas pasadas se mantienen.")) return;
  DB.productos.find(x => x.id === id).activo = false;
  renderProductos();
}

// --- INVENTARIO (KARDEX) ---
let ajusteProdId = null;
function openAjuste(id) {
  ajusteProdId = id;
  const p = DB.productos.find(x => x.id === id);
  $("ajName").textContent = `${p.name} (Stock actual: ${p.stock} ${p.unit})`;
  $("formAjuste").reset();
  $("dAjuste").showModal();
}

$("formAjuste").onsubmit = e => {
  e.preventDefault();
  const p = DB.productos.find(x => x.id === ajusteProdId);
  let qty = parseFloat($("ajCant").value);
  const tipo = $("ajTipo").value;
  const motivo = $("ajMotivo").value;
  const stockAnt = p.stock;
  
  if(tipo === 'merma') qty = -Math.abs(qty); // Forzar negativo
  if(tipo === 'conteo') qty = qty - stockAnt; // Diferencia para llegar al nuevo stock
  
  p.stock += qty;
  logMovimiento(p.id, tipo.toUpperCase(), qty, stockAnt, p.stock, motivo, 'Admin');
  
  $("dAjuste").close();
  renderProductos(document.querySelector('.d-tabs button[data-tab="resurtir"]').classList.contains('active'));
  if(document.querySelector('.d-tabs button[data-tab="kardex"]').classList.contains('active')) renderKardex();
};

function logMovimiento(prodId, tipo, cant, antes, despues, motivo, usuario) {
  DB.movimientos.unshift({ fecha: new Date(), prodId, tipo, cant, antes, despues, motivo, usuario });
}

function renderKardex() {
  let html = '';
  DB.movimientos.forEach(m => {
    const p = DB.productos.find(x => x.id === m.prodId);
    const cColor = m.cant > 0 ? 'var(--ok)' : m.cant < 0 ? 'var(--bad)' : 'var(--mute)';
    html += `<tr>
      <td><small>${dateStr(m.fecha)}</small></td>
      <td>${p ? p.name : 'Desc.'}</td>
      <td><b>${m.tipo}</b></td>
      <td style="color:${cColor}">${m.cant > 0 ? '+'+m.cant : m.cant}</td>
      <td>${m.despues}</td>
      <td><small>${m.motivo}<br><i>Por: ${m.usuario}</i></small></td>
    </tr>`;
  });
  $("listaKardex").innerHTML = html || '<tr><td colspan="6">No hay movimientos.</td></tr>';
}

// --- MÓDULO USUARIOS ---
$("goUsers").onclick = () => { renderUsers(); $("dUsers").showModal(); };

function renderUsers() {
  let html = '';
  DB.usuarios.forEach(u => {
    html += `<tr>
      <td>${u.nombre}</td><td>${u.correo}</td>
      <td><span class="rol ${u.rol === 'admin'?'admin':''}">${u.rol}</span></td>
      <td>${u.activo ? '✅ Activo' : '❌ Inactivo'}</td>
      <td><button class="action-btn" onclick="openFormUser('${u.id}')">✏️ Editar</button></td>
    </tr>`;
  });
  $("listaUsers").innerHTML = html;
}

let editUserId = null;
$("bNuevoUser").onclick = () => openFormUser(null);
function openFormUser(id) {
  editUserId = id;
  const f = $("formUser"); f.reset();
  if(id) {
    const u = DB.usuarios.find(x => x.id === id);
    $("fuTitle").textContent = "Editar Usuario";
    $("fuName").value = u.nombre; $("fuEmail").value = u.correo;
    $("fuRol").value = u.rol; $("fuActivo").checked = u.activo;
  } else {
    $("fuTitle").textContent = "Nuevo Usuario";
  }
  $("dFormUser").showModal();
}

$("formUser").onsubmit = e => {
  e.preventDefault();
  const id = editUserId || generateId();
  const uData = { id, nombre: $("fuName").value, correo: $("fuEmail").value, rol: $("fuRol").value, activo: $("fuActivo").checked };
  // Simulando guardado de pass en backend (auth) si fpPass tiene valor
  if(!editUserId) DB.usuarios.push(uData); else Object.assign(DB.usuarios.find(x => x.id === id), uData);
  $("dFormUser").close(); renderUsers();
};

// --- MÓDULO AVISOS Y REPORTES ---
$("goAv").onclick = () => { renderAvisos(); renderReportesCaja(); $("dAvList").showModal(); };

$("formAviso").onsubmit = e => {
  e.preventDefault();
  DB.avisos.unshift({ id: generateId(), fecha: new Date(), texto: $("avTxt").value, imp: $("avImp").checked });
  $("formAviso").reset(); renderAvisos(); alert("Aviso enviado a las cajas.");
};

function renderAvisos() {
  $("listaAvisos").innerHTML = DB.avisos.map(a => 
    `<div class="${a.imp ? 'imp' : ''}"><small>${dateStr(a.fecha)} ${a.imp ? '· URGENTE' : ''}</small>${a.texto}</div>`
  ).join('') || '<p style="padding:10px;color:var(--mute)">No hay avisos recientes.</p>';
}

function renderReportesCaja() {
  $("listaReportesCaja").innerHTML = DB.reportesCaja.map(r => 
    `<div>
      <small>${dateStr(r.fecha)} · De: ${r.cajero}</small>
      <b>⚠️ ${r.tipo}</b>: ${r.prod}
      <p style="margin-top:4px">${r.nota}</p>
      <button class="action-btn" style="margin-top:8px" onclick="resolverReporte('${r.id}')">✅ Marcar resuelto</button>
    </div>`
  ).join('') || '<p style="padding:10px;color:var(--ok)">Todo en orden, no hay reportes de caja.</p>';
}

function resolverReporte(id) {
  DB.reportesCaja = DB.reportesCaja.filter(r => r.id !== id);
  renderReportesCaja(); updateBadges();
}

// Arranque
initDash();
