import { db, auth, requerirRol, cerrarSesion } from "./firebase.js";
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, addDoc, query, orderBy, serverTimestamp, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- UTILIDADES ---
const $ = id => document.getElementById(id);
const money = n => "$" + parseFloat(n).toFixed(2);
// Formatear fechas de Firestore
const dateStr = d => d?.toDate ? d.toDate().toLocaleString('es-MX', { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

let sesionGlobal = null;

// --- PROTECCIÓN DE SESIÓN Y ARRANQUE ---
// Exige que el usuario activo tenga el rol de "admin"
requerirRol("admin").then(s => {
  if (!s) return;
  sesionGlobal = s;
  console.log("Sesión de Admin iniciada:", s.perfil.nombre);
  
  // Actualiza nombre y correo en la barra superior
  document.querySelector(".who span:nth-child(2)").textContent = s.user.email;
  document.querySelector(".who .rol").textContent = s.perfil.nombre;
  
  initDash();
});

// Botón de salir
$("salir").onclick = cerrarSesion;

// --- DASHBOARD ---
function initDash() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  $("fechaActual").textContent = new Date().toLocaleDateString('es-MX', options);
  
  // Para el resumen, se pueden hacer consultas reales después. Por ahora calcularemos reportes y resurtir:
  updateBadges();
}

async function updateBadges() {
  // Contar productos por resurtir
  const snapProd = await getDocs(collection(db, "productos"));
  let resurtirCount = 0;
  snapProd.forEach(d => {
    const p = d.data();
    if (p.activo && p.stock <= (p.stockMinimo || 5)) resurtirCount++;
  });
  $("badgeResurtir").textContent = resurtirCount > 0 ? resurtirCount : "";
  
  // Contar reportes sin resolver
  const snapRep = await getDocs(collection(db, "reportes"));
  let repCount = 0;
  snapRep.forEach(d => { if (!d.data().resuelto) repCount++; });
  $("badgeAv").textContent = repCount;
  $("badgeAv").hidden = repCount === 0;
}

// --- NAVEGACIÓN ---
$("goPOS").onclick = () => window.location.href = "ventas.html"; // Ajustado al nombre real de tu caja
$("goCorte").onclick = () => alert("Abriendo asistente de Corte General... (Próximo módulo)");
$("goRep").onclick = () => alert("Abriendo Gráficas y Reportes... (Próximo módulo)");

// Manejo de Pestañas genérico
document.querySelectorAll('.d-tabs button').forEach(btn => {
  btn.onclick = (e) => {
    const parent = e.target.closest('.d-head').parentElement;
    parent.querySelectorAll('.d-tabs button').forEach(b => b.classList.remove('active'));
    parent.querySelectorAll('.tab-content').forEach(c => c.hidden = true);
    e.target.classList.add('active');
    parent.querySelector(`#tab-${e.target.dataset.tab}`).hidden = false;
    
    // Disparar lectura de BD según la pestaña
    if(e.target.dataset.tab === 'resurtir') renderProductos(true);
    if(e.target.dataset.tab === 'cat') renderProductos(false);
    if(e.target.dataset.tab === 'kardex') renderKardex();
    if(e.target.dataset.tab === 'enviar') renderAvisos();
    if(e.target.dataset.tab === 'recibidos') renderReportesCaja();
  }
});

// --- MÓDULO PRODUCTOS Y KARDEX REAL ---
$("goProd").onclick = () => { renderProductos(false); $("dProd").showModal(); };

async function renderProductos(soloResurtir = false) {
  const queryTxt = $("busqProd").value.toLowerCase();
  $("listaProd").innerHTML = '<tr><td colspan="6" style="text-align:center">Cargando productos...</td></tr>';
  
  const snap = await getDocs(collection(db, "productos"));
  let html = '';
  
  snap.forEach(docSnap => {
    const p = docSnap.data();
    p.id = docSnap.id;
    if (!p.activo) return;
    
    const min = p.stockMinimo || 5;
    if (soloResurtir && p.stock > min) return;
    if (queryTxt && !p.nombre.toLowerCase().includes(queryTxt) && !p.id.includes(queryTxt)) return;
    
    const isLow = p.stock <= min;
    const stockClass = isLow ? 'style="color:var(--bad);font-weight:700"' : '';
    
    html += `<tr>
      <td><small>${p.sku || 'S/N'}</small><br>${p.id}</td>
      <td>${p.nombre}</td>
      <td ${stockClass}>${p.stock} ${p.unidad} ${isLow ? '⚠️' : ''}</td>
      <td>${money(p.precio)}</td>
      <td>
        <button class="action-btn" onclick="openAjuste('${p.id}', '${p.nombre}', ${p.stock}, '${p.unidad}')">📦 Ajustar Inv.</button>
        <button class="action-btn" onclick="openFormProd('${p.id}')">✏️ Editar</button>
        <button class="action-btn del" onclick="bajaProd('${p.id}')">🗑️ Baja</button>
      </td>
    </tr>`;
  });
  $("listaProd").innerHTML = html || '<tr><td colspan="6" style="text-align:center;padding:20px">No hay productos.</td></tr>';
  updateBadges();
}

$("busqProd").oninput = () => renderProductos(document.querySelector('.d-tabs button[data-tab="resurtir"]').classList.contains('active'));

let editProdId = null;
$("bNuevoProd").onclick = () => openFormProd(null);
window.openFormProd = async (id) => {
  editProdId = id;
  const f = $("formProd"); f.reset();
  
  if(id) {
    $("fpTitle").textContent = "Cargando...";
    $("dFormProd").showModal();
    
    const pDoc = await getDoc(doc(db, "productos", id));
    const privDoc = await getDoc(doc(db, "productosPrivado", id));
    const p = pDoc.data();
    const priv = privDoc.exists() ? privDoc.data() : {};

    $("fpTitle").textContent = "Editar Producto";
    $("fpCode").value = id; $("fpCode").disabled = true; // El código no se edita
    $("fpSku").value = p.sku \vert{}\vert{} ''; $("fpName").value = p.nombre;
    $("fpDep").value = p.departamento \vert{}\vert{} 'Abarrotes'; $("fpUnit").value = p.unidad || 'pza'; 
    $("fpPrice").value = p.precio; $("fpIva").value = p.iva; 
    $("fpStock").value = p.stock; $("fpMin").value = p.stockMinimo || 5;
    $("fpCost").value = priv.costo \vert{}\vert{} 0; $("fpProv").value = priv.proveedor || '';
  } else {
    $("fpTitle").textContent = "Nuevo Producto";
    $("fpCode").disabled = false;
    $("fpStock").value = 0;
    $("dFormProd").showModal();
  }
}

$("formProd").onsubmit = async e => {
  e.preventDefault();
  const id = $("fpCode").value.trim();
  const batch = writeBatch(db);

  const prodData = {
    nombre: $("fpName").value, sku: $("fpSku").value, departamento: $("fpDep").value,
    unidad: $("fpUnit").value, precio: parseFloat($("fpPrice").value),
    iva: parseFloat($("fpIva").value), stockMinimo: parseFloat($("fpMin").value),
    activo: true, actualizado: serverTimestamp()
  };

  if(!editProdId) {
    prodData.stock = 0;
    prodData.creado = serverTimestamp();
  }

  // Guardamos datos públicos y privados separados
  batch.set(doc(db, "productos", id), prodData, { merge: true });
  batch.set(doc(db, "productosPrivado", id), {
    costo: parseFloat($("fpCost").value), proveedor: $("fpProv").value
  }, { merge: true });

  $("dFormProd").close();
  await batch.commit();
  renderProductos();
};

window.bajaProd = async (id) => {
  if(!confirm("¿Dar de baja este producto? Ya no saldrá en la caja, pero sus ventas pasadas se mantienen.")) return;
  await updateDoc(doc(db, "productos", id), { activo: false });
  renderProductos();
}

// --- AJUSTES Y KARDEX ---
let ajProdId = null; let ajStockAnt = 0;
window.openAjuste = (id, nombre, stock, unidad) => {
  ajProdId = id; ajStockAnt = stock;
  $("ajName").textContent = `${nombre} (Stock actual: ${stock} ${unidad})`;
  $("formAjuste").reset();
  $("dAjuste").showModal();
}

$("formAjuste").onsubmit = async e => {
  e.preventDefault();
  let qty = parseFloat($("ajCant").value);
  const tipo = $("ajTipo").value;
  const motivo = $("ajMotivo").value;
  
  if(tipo === 'merma') qty = -Math.abs(qty); 
  if(tipo === 'conteo') qty = qty - ajStockAnt; 
  
  const batch = writeBatch(db);
  
  // 1. Afectar el stock del producto
  batch.update(doc(db, "productos", ajProdId), { 
    stock: increment(qty), actualizado: serverTimestamp() 
  });
  
  // 2. Registrar el movimiento inborrable en el Kardex
  const movRef = doc(collection(db, "movimientos"));
  batch.set(movRef, {
    fecha: serverTimestamp(), prodId: ajProdId,
    tipo: tipo.toUpperCase(), cant: qty, antes: ajStockAnt, despues: ajStockAnt + qty,
    motivo: motivo, usuarioId: sesionGlobal.user.uid, usuarioNombre: sesionGlobal.perfil.nombre
  });
  
  $("dAjuste").close();
  await batch.commit();
  renderProductos(document.querySelector('.d-tabs button[data-tab="resurtir"]').classList.contains('active'));
  if(document.querySelector('.d-tabs button[data-tab="kardex"]').classList.contains('active')) renderKardex();
};

async function renderKardex() {
  $("listaKardex").innerHTML = '<tr><td colspan="6" style="text-align:center">Cargando kardex...</td></tr>';
  const snap = await getDocs(query(collection(db, "movimientos"), orderBy("fecha", "desc")));
  let html = '';
  snap.forEach(docSnap => {
    const m = docSnap.data();
    const cColor = m.cant > 0 ? 'var(--ok)' : m.cant < 0 ? 'var(--bad)' : 'var(--mute)';
    html += `<tr>
      <td><small>${dateStr(m.fecha)}</small></td>
      <td><small>${m.prodId}</small></td>
      <td><b>${m.tipo}</b></td>
      <td style="color:${cColor}">${m.cant > 0 ? '+'+m.cant : m.cant}</td>
      <td>${m.despues}</td>
      <td><small>${m.motivo}<br><i>Por: ${m.usuarioNombre}</i></small></td>
    </tr>`;
  });
  $("listaKardex").innerHTML = html || '<tr><td colspan="6">No hay movimientos registrados.</td></tr>';
}

// --- MÓDULO USUARIOS REAL ---
$("goUsers").onclick = () => { renderUsers(); $("dUsers").showModal(); };

async function renderUsers() {
  $("listaUsers").innerHTML = '<tr><td colspan="5" style="text-align:center">Cargando...</td></tr>';
  const snap = await getDocs(collection(db, "usuarios"));
  let html = '';
  snap.forEach(docSnap => {
    const u = docSnap.data();
    html += `<tr>
      <td>${u.nombre}</td><td>${u.correo}</td>
      <td><span class="rol ${u.rol === 'admin'?'admin':''}">${u.rol}</span></td>
      <td>${u.activo ? '✅ Activo' : '❌ Inactivo'}</td>
      <td><button class="action-btn" onclick="openFormUser('${docSnap.id}', '${u.nombre}', '${u.correo}', '${u.rol}', ${u.activo})">✏️ Editar</button></td>
    </tr>`;
  });
  $("listaUsers").innerHTML = html;
}

window.openFormUser = (id, nombre, correo, rol, activo) => {
  $("formUser").reset();
  $("fuTitle").textContent = "Editar Usuario";
  $("formUser").dataset.uid = id;
  $("fuName").value = nombre; $("fuEmail").value = correo;
  $("fuEmail").disabled = true; // El correo se rige por Authentication, mejor no editarlo aquí
  $("fuRol").value = rol; $("fuActivo").checked = activo;
  $("dFormUser").showModal();
}

$("bNuevoUser").onclick = () => alert("Para seguridad, los usuarios nuevos deben registrarse en la consola de Firebase Authentication primero, y luego asignarles su documento en Firestore.");

$("formUser").onsubmit = async e => {
  e.preventDefault();
  const id = $("formUser").dataset.uid;
  await updateDoc(doc(db, "usuarios", id), {
    nombre: $("fuName").value, rol: $("fuRol").value, activo: $("fuActivo").checked
  });
  $("dFormUser").close(); 
  renderUsers();
};

// --- AVISOS Y REPORTES ---
$("goAv").onclick = () => { renderAvisos(); renderReportesCaja(); $("dAvList").showModal(); };

$("formAviso").onsubmit = async e => {
  e.preventDefault();
  await addDoc(collection(db, "avisos"), {
    texto: $("avTxt").value, importante: $("avImp").checked, creado: serverTimestamp()
  });
  $("formAviso").reset(); renderAvisos();
  alert("Aviso transmitido a las cajas.");
};

async function renderAvisos() {
  const snap = await getDocs(query(collection(db, "avisos"), orderBy("creado", "desc")));
  let html = '';
  snap.forEach(docSnap => {
    const a = docSnap.data();
    html += `<div class="${a.importante ? 'imp' : ''}"><small>${dateStr(a.creado)} ${a.importante ? '· URGENTE' : ''}</small>${a.texto}</div>`;
  });
  $("listaAvisos").innerHTML = html || '<p style="padding:10px;color:var(--mute)">No hay avisos.</p>';
}

async function renderReportesCaja() {
  const snap = await getDocs(collection(db, "reportes"));
  let html = ''; let count = 0;
  snap.forEach(docSnap => {
    const r = docSnap.data();
    if(r.resuelto) return;
    count++;
    html += `<div>
      <small>${dateStr(r.creado)} · De: ${r.cobradorNombre || 'Cajero'}</small>
      <b>⚠️ ${r.tipo}</b>: ${r.prod}
      <p style="margin-top:4px">${r.nota}</p>
      <button class="action-btn" style="margin-top:8px" onclick="resolverReporte('${docSnap.id}')">✅ Marcar resuelto</button>
    </div>`;
  });
  $("listaReportesCaja").innerHTML = html || '<p style="padding:10px;color:var(--ok)">Todo en orden, sin reportes.</p>';
  $("badgeAv").textContent = count; $("badgeAv").hidden = count === 0;
}

window.resolverReporte = async (id) => {
  await updateDoc(doc(db, "reportes", id), { resuelto: true, fechaResuelto: serverTimestamp() });
  renderReportesCaja();
  }
  
