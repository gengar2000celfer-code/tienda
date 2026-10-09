import { collection, doc, getDocs, onSnapshot, query, where, orderBy, limit, runTransaction, writeBatch, addDoc, updateDoc, setDoc, deleteDoc, arrayRemove, serverTimestamp, Timestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, db, requerirRol, cerrarSesion } from "./firebase.js";

/* ---------- Sesión: solo entra el dueño ---------- */
const { user, perfil } = await requerirRol("admin");
const miUid = user.uid, yo = perfil.nombre || user.email;

const $ = id => document.getElementById(id), money = n => "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = n => Math.round(n * 100) / 100, r3 = n => Math.round(n * 1000) / 1000;
const aF = t => (t && t.toDate) ? t.toDate() : new Date();
const fh = d => d.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const falla = (m, e) => { $("gErr").textContent = m + (e ? ": " + e.message : ""); };
$("quien").textContent = user.email; $("salir").onclick = cerrarSesion;

/* ---------- Estado ---------- */
let PB = [], PC = {}, P = [], MOV = [], T = [], PROMOS = [], AVISOS = [], REPS = [], USERS = [], HOY = null;
const RES = {};
let sec = "inicio", dep = "Todos", prodSel = null, tipo = "entrada", edit = null, cor = null, elim = null, promoEd = null, promoProds = [];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const etq = p => p.tipo === "nxm" ? p.n + "x" + p.m : "−" + p.pct + "%", regla = p => p.tipo === "nxm" ? "Lleva " + p.n + " y paga " + p.m : p.pct + "% de descuento";
const prod = c => P.find(p => p.cod === c), deps = () => [...new Set(P.map(p => p.depto))];
const u = p => p && p.unidad === "kg" ? " kg" : "";
const datos = t => t.estado === "abierto" ? RES[t.id] : t.resumen;
const esperado = t => { const d = datos(t); return r2(t.fondo + d.ef - d.ret.reduce((a, r) => a + r.m, 0)); };

/* ---------- Datos en vivo desde Firestore ---------- */
const DEP = { inicio: ["productos", "turnos", "reportes"], productos: ["productos"], inventario: ["productos", "mov"], corte: ["turnos", "res"], promos: ["promos", "productos"], avisos: ["avisos"], reportes: ["reportes", "productos"], usuarios: ["usuarios"] };
function refrescar(src){
  badge();
  if (!DEP[sec].includes(src)) return;
  if (sec === "productos"){ chips(); listar(); }
  else if (sec === "inventario"){ kardex(); const p = prodSel && prod(prodSel); if (p && $("selStock")) $("selStock").textContent = p.stock + u(p); }
  else render();
}
const escuchar = (q, fn, src) => onSnapshot(q, s => { fn(s); refrescar(src); }, e => falla("No se pudo leer «" + src + "»", e));
function armarP(){
  P = PB.map(x => ({ cod: x.cod, nombre: x.nombre, depto: x.departamento, precio: x.precio, iva: x.iva, stock: x.stock, min: x.stockMinimo || 0, unidad: x.unidad === "kg" ? "kg" : "pza", activo: x.activo !== false, costo: PC[x.cod] || 0 }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
escuchar(collection(db, "productos"), s => { PB = s.docs.map(d => ({ cod: d.id, ...d.data() })); armarP(); }, "productos");
escuchar(collection(db, "productosPrivado"), s => { PC = {}; s.forEach(d => PC[d.id] = d.data().costo); armarP(); }, "productos");
escuchar(query(collection(db, "movimientos"), orderBy("fecha", "desc"), limit(100)), s => {
  MOV = s.docs.map(d => { const x = d.data(); return { f: aF(x.fecha), cod: x.productoId, nom: x.nombre, tipo: x.tipo === "salida_venta" ? "Venta" : x.tipo, cant: x.cantidad, antes: x.stockAntes, desp: x.stockDespues, motivo: x.motivo || (x.folio ? "Ticket #" + x.folio : "") }; });
}, "mov");
escuchar(collection(db, "promociones"), s => {
  PROMOS = s.docs.map(d => { const x = d.data(); return { id: d.id, nom: x.nombre, tipo: x.tipo, n: x.n || 0, m: x.m || 0, pct: x.pct || 0, prods: x.productos || [], vig: x.vigencia || "", dias: x.dias || [], activa: x.activa !== false }; });
}, "promos");
escuchar(query(collection(db, "avisos"), orderBy("creado", "desc")), s => {
  AVISOS = s.docs.map(d => { const x = d.data(); return { id: d.id, f: aF(x.creado), txt: x.texto, imp: !!x.importante }; });
}, "avisos");
escuchar(query(collection(db, "reportes"), orderBy("fecha", "desc"), limit(60)), s => {
  REPS = s.docs.map(d => { const x = d.data(), t = x.producto || "";
    let cod = (t.match(/\((\d+)\)\s*$/) || [])[1] || (/^\d+$/.test(t) ? t : null); if (!prod(cod)) cod = null;
    return { id: d.id, f: aF(x.fecha), cajero: x.cobradorNombre || "Cobrador", tipo: x.tipo, prod: t, cod, nota: x.nota || "", estado: x.estado || "nuevo" }; });
}, "reportes");
escuchar(query(collection(db, "turnos"), orderBy("inicio", "desc"), limit(20)), s => {
  T = s.docs.map(d => { const x = d.data();
    return { id: d.id, cajero: x.cobradorNombre || "Cobrador", caja: x.caja || "1", inicio: aF(x.inicio), fin: x.fin ? aF(x.fin) : null, fondo: x.fondo, estado: x.estado, contado: x.contado, dif: x.diferencia, nota: x.nota || "",
      resumen: x.resumen ? { ...x.resumen, ret: (x.resumen.ret || []).map(r => ({ h: aF(r.h), m: r.m, mot: r.mot })) } : null }; });
  T.filter(t => t.estado === "abierto" && !RES[t.id]).forEach(cargarRes);
}, "turnos");
escuchar(collection(db, "usuarios"), s => {
  USERS = s.docs.map(d => { const x = d.data(); return { id: d.id, nombre: x.nombre, correo: x.correo, rol: x.rol, activo: x.activo === true }; });
}, "usuarios");

async function cargarRes(t){          // ventas y retiros de un turno (efectivo, tarjeta, transferencia)
  try {
    const [v, r] = await Promise.all([getDocs(query(collection(db, "ventas"), where("turnoId", "==", t.id))), getDocs(query(collection(db, "retiros"), where("turnoId", "==", t.id)))]);
    const x = { ef: 0, tj: 0, tr: 0, tk: 0, ret: [] };
    v.forEach(s => { const y = s.data(); if (y.estado === "cancelada") return; x.tk++; x.ef = r2(x.ef + (y.efectivoNeto || 0));
      (y.pagos || []).forEach(p => { if (p.metodo === "Tarjeta") x.tj = r2(x.tj + p.monto); if (p.metodo === "Transferencia") x.tr = r2(x.tr + p.monto); }); });
    r.forEach(s => { const y = s.data(); x.ret.push({ h: aF(y.hora), m: y.monto, mot: y.motivo }); });
    RES[t.id] = x; refrescar("res");
  } catch (e) { falla("No se pudo calcular el turno", e); }
}
async function cargarHoy(){
  try {
    const ini = new Date(); ini.setHours(0, 0, 0, 0);
    const s = await getDocs(query(collection(db, "ventas"), where("fecha", ">=", Timestamp.fromDate(ini))));
    let v = 0, tk = 0; s.forEach(d => { const x = d.data(); if (x.estado === "cancelada") return; v += x.total || 0; tk++; });
    HOY = { v: r2(v), tk };
    if ($("kV")){ $("kV").textContent = money(HOY.v); $("kT").textContent = tk + " tickets"; }
  } catch (e) { falla("No se pudieron leer las ventas de hoy", e); }
}
function badge(){ $("nRep").textContent = REPS.filter(r => r.estado === "nuevo").length || ""; }

/* ---------- Vistas ---------- */
const VISTAS = {
  inicio(){
    const bajo = P.filter(p => p.activo && p.stock <= p.min);
    return `<h1>Buenos días, ${yo}</h1><p class="sub">${new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
    <div class="kpis"><div class="kpi" style="background:var(--c1)"><b id="kV">${HOY ? money(HOY.v) : "…"}</b>Ventas de hoy<small id="kT">${HOY ? HOY.tk + " tickets" : "calculando"}</small></div>
    <div class="kpi" style="background:var(--c3)"><b>${bajo.length}</b>Por resurtir<small>bajo el stock mínimo</small></div>
    <div class="kpi" style="background:var(--c2)"><b>${T.filter(t => t.estado === "abierto").length}</b>Turnos abiertos<small>pendientes de corte</small></div>
    <div class="kpi" style="background:var(--c4)"><b>${P.filter(p => p.activo).length}</b>Productos activos<small>en catálogo</small></div>
    <div class="kpi" style="background:var(--c5)"><b>${REPS.filter(r => r.estado === "nuevo").length}</b>Reportes nuevos<small>de los cobradores</small></div></div>
    <h2>Por resurtir</h2>` + (bajo.map(p => `<div class="r" style="grid-template-columns:1fr auto auto"><span><b>${p.nombre}</b><small>${p.cod}</small></span><span class="${p.stock ? "" : "bad"}">${p.stock ? p.stock + u(p) + " (mín. " + p.min + ")" : "Agotado"}</span><span class="ac"><button class="sec" data-aj="${p.cod}">Ajustar</button></span></div>`).join("") || '<div class="card">Todo está por encima del mínimo.</div>');
  },
  productos(){
    return `<h1>Productos</h1><p class="sub">Catálogo, precios y costos. El stock se cambia en Inventario.</p>
    <div class="bar"><input id="q" placeholder="Buscar por nombre o código de barras" autocomplete="off"><button class="go" id="nuevo">+ Nuevo producto</button></div>
    <div class="chips" id="chips"></div><div id="plist"></div>`;
  },
  inventario(){
    const p = prodSel ? prod(prodSel) : null;
    return `<h1>Inventario</h1><p class="sub">Cada cambio de stock queda registrado en el kardex.</p>
    <div class="grid2"><div class="card"><label class="lbl" for="iprod" style="margin-top:0">Producto</label>
    <input id="iprod" list="dlp" placeholder="Código de barras o nombre" value="${p ? p.cod : ""}" autocomplete="off"><datalist id="dlp">${P.map(x => `<option value="${x.cod}">${x.nombre}</option>`).join("")}</datalist>
    ${p ? `<div class="sel"><b>${p.nombre}</b><small style="color:#10292d">Stock actual: <strong id="selStock">${p.stock}${u(p)}</strong> · mínimo ${p.min}</small></div>` : ""}
    <div class="seg" id="seg"><button data-t="entrada" aria-pressed="${tipo === "entrada"}">Entrada</button><button data-t="merma" aria-pressed="${tipo === "merma"}">Merma</button><button data-t="conteo" aria-pressed="${tipo === "conteo"}">Conteo</button></div>
    <label class="lbl" for="cant">${tipo === "entrada" ? "Cantidad que entró" : tipo === "merma" ? "Cantidad que sale" : "Cantidad contada físicamente"}</label>
    <input id="cant" type="number" min="0" step="${p && p.unidad === "kg" ? "0.001" : "1"}" inputmode="decimal">
    ${tipo === "merma" ? `<label class="lbl" for="mot">Motivo</label><select id="mot"><option>Caducado</option><option>Dañado</option><option>Robo o extravío</option><option>Consumo interno</option><option>Otro</option></select>` : ""}
    <label class="lbl" for="nota">${tipo === "entrada" ? "Proveedor (opcional)" : "Nota"}</label><input id="nota" maxlength="80" autocomplete="off">
    <p class="hint" id="prev"></p><p class="err" id="err"></p><button class="go" id="reg" style="width:100%">Registrar movimiento</button></div>
    <div class="paper"><div class="tabs"><i></i><i></i><i></i><i></i></div><h2>Kardex${p ? " · " + p.nombre : ""}</h2><div id="kdx"></div></div></div>`;
  },
  corte(){
    return `<h1>Corte de caja</h1><p class="sub">Compara lo que debería haber en caja contra lo que cuentas.</p>` + (T.map(t => {
      const d = datos(t), cab = `<div class="paper"><div class="tabs"><i></i><i></i><i></i><i></i></div>`;
      if (!d) return cab + `<b>${t.cajero} · Caja ${t.caja}</b><small>Calculando…</small></div>`;
      const esp = esperado(t), tr = d.ret.reduce((a, r) => a + r.m, 0);
      return cab + `<div class="k"><span><b>${t.cajero} · Caja ${t.caja}</b><small>${fh(t.inicio)}${t.fin ? " → " + fh(t.fin) : " · en curso"}</small></span><span class="chipe" style="background:${t.estado === "abierto" ? "var(--c1)" : "var(--c4)"}">${t.estado === "abierto" ? "Abierto" : "Cerrado"}</span></div>
      <div class="l"><span>Fondo de caja</span><span>${money(t.fondo)}</span></div><div class="l"><span>Ventas en efectivo</span><span>${money(d.ef)}</span></div>
      <div class="l"><span>Retiros</span><span>−${money(tr)}</span></div>${d.ret.map(r => `<div class="l"><small>${fh(r.h)} · ${r.mot}</small><small>−${money(r.m)}</small></div>`).join("")}
      <div class="l t"><span>Efectivo esperado</span><span>${money(esp)}</span></div>
      <div class="l"><span>Tarjeta</span><span>${money(d.tj)}</span></div><div class="l"><span>Transferencia</span><span>${money(d.tr)}</span></div><div class="l"><span>Tickets</span><span>${d.tk}</span></div>
      ${t.estado === "cerrado" ? `<div class="l"><span>Efectivo contado</span><span>${money(t.contado)}</span></div><div class="l t"><span>Diferencia</span><span class="${t.dif < 0 ? "bad" : t.dif > 0 ? "ok" : ""}">${t.dif === 0 ? "Cuadra" : (t.dif > 0 ? "Sobrante " : "Faltante ") + money(Math.abs(t.dif))}</span></div>${t.nota ? `<small>${t.nota}</small>` : ""}` : `<button class="go" data-c="${t.id}" style="width:100%;margin-top:12px">Hacer corte</button>`}</div>`; }).join("") || '<div class="card">Aún no hay turnos.</div>');
  },
  promos(){
    return `<h1>Promociones</h1><p class="sub">Las que estén activas aparecen en la caja; el cobrador decide cuál aplicar.</p><div class="bar"><button class="go" id="nPromo">+ Nueva promoción</button></div>`
    + (PROMOS.map(p => `<div class="r${p.activa ? "" : " off"}" style="grid-template-columns:64px 1fr auto"><b class="eti">${etq(p)}</b><span><b>${p.nom}</b><small>${regla(p)} · ${p.prods.map(c => (prod(c) || { nombre: c }).nombre).join(" / ")}</small><small>${p.vig || "Sin fecha"}${p.dias.length ? " · " + p.dias.map(d => DIAS[d]).join(", ") : ""}${p.activa ? "" : " · En pausa"}</small></span><span class="ac"><button data-pe="${p.id}">Editar</button><button data-pa="${p.id}">${p.activa ? "Pausar" : "Activar"}</button><button class="del" data-pd="${p.id}">Eliminar</button></span></div>`).join("") || '<div class="card">Aún no hay promociones.</div>');
  },
  avisos(){
    return `<h1>Avisos</h1><p class="sub">Mensajes para tus cobradores. Los importantes salen destacados al abrir la caja.</p>
    <div class="card"><label class="lbl" for="avT" style="margin-top:0">Nuevo aviso</label><input id="avT" maxlength="140" autocomplete="off" placeholder="Ej.: Hoy llega el camión de refrescos a las 10">
    <label class="lbl" style="display:flex;gap:8px;align-items:center;font-weight:400"><input id="avI" type="checkbox" style="width:auto;padding:0"> Marcar como importante</label><p class="err" id="avE"></p><button class="go" id="avP">Publicar aviso</button></div>`
    + (AVISOS.map(a => `<div class="r" style="grid-template-columns:1fr auto"><span><b>${a.txt}</b><small>${fh(a.f)}${a.imp ? " · Importante" : ""}</small></span><span class="ac"><button class="del" data-ad="${a.id}">Eliminar</button></span></div>`).join("") || '<div class="card">No hay avisos publicados.</div>');
  },
  reportes(){
    const nuevos = REPS.filter(r => r.estado === "nuevo").length;
    return `<h1>Reportes de los cobradores</h1><p class="sub">${nuevos ? nuevos + " sin revisar" : "Todo revisado"}</p>` + (REPS.map(r => {
      const p = r.cod && prod(r.cod);
      const acc = r.tipo === "Código no encontrado" ? `<button data-rn="${r.id}">Crear producto</button>` : r.tipo === "Precio incorrecto" && p ? `<button data-e="${p.cod}">Editar precio</button>` : r.tipo.startsWith("Hay producto") && p ? `<button data-aj="${p.cod}">Ajustar stock</button>` : "";
      return `<div class="r${r.estado === "resuelto" ? " off" : ""}" style="grid-template-columns:1fr auto"><span><b>${r.tipo}</b><small>${r.prod}${r.nota ? " · " + r.nota : ""}</small><small>${r.cajero} · ${fh(r.f)} · ${r.estado === "nuevo" ? "Nuevo" : "Resuelto"}</small></span><span class="ac">${acc}${r.estado === "nuevo" ? `<button data-rr="${r.id}">Marcar resuelto</button>` : ""}</span></div>`; }).join("") || '<div class="card">Sin reportes.</div>');
  },
  usuarios(){
    return `<h1>Usuarios</h1><p class="sub">Quién puede entrar al sistema y con qué rol.</p><div class="bar"><button class="go" id="nUser">+ Nuevo usuario</button></div>`
    + USERS.map(us => `<div class="r${us.activo ? "" : " off"}" style="grid-template-columns:1fr auto auto"><span><b>${us.nombre}</b><small>${us.correo}${us.activo ? "" : " · Desactivado"}</small></span><span class="chipe" style="background:${us.rol === "admin" ? "var(--c3)" : "var(--c4)"}">${us.rol === "admin" ? "Dueño" : "Cobrador"}</span><span class="ac">${us.id === miUid ? "<small>Tú</small>" : `<button data-ua="${us.id}">${us.activo ? "Desactivar" : "Activar"}</button>`}</span></div>`).join("")
    + '<p class="hint">Un usuario desactivado ya no puede iniciar sesión, pero conserva su historial de ventas.</p>';
  }
};

function render(){
  document.querySelectorAll("#nav [data-s]").forEach(b => b.dataset.s === sec ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  badge(); $("main").innerHTML = VISTAS[sec]();
  if (sec === "productos"){ chips(); listar(); }
  if (sec === "inventario"){ kardex(); vista(); }
  if (sec === "inicio") cargarHoy();
}
function chips(){ $("chips").innerHTML = ["Todos", ...deps()].map(d => `<button class="chip" data-d="${d}" aria-pressed="${d === dep}">${d}</button>`).join(""); }
function listar(){
  const t = ($("q").value || "").trim().toLowerCase();
  const r = P.filter(p => (dep === "Todos" || p.depto === dep) && (!t || p.nombre.toLowerCase().includes(t) || p.cod.startsWith(t)));
  $("plist").innerHTML = r.map(p => { const base = p.precio / (1 + p.iva), mg = base ? Math.round((base - p.costo) / base * 100) : 0;
    return `<div class="r${p.activo ? "" : " off"}"><span><b>${p.nombre}</b><small>${p.cod} · ${p.depto} · ${p.unidad === "kg" ? "por kilo" : "por pieza"}${p.iva ? "" : " · IVA 0%"}${p.activo ? "" : " · De baja"}</small></span>
    <span class="pr">${money(p.precio)}</span><span class="hm">${money(p.costo)}<small>margen ${mg}%</small></span>
    <span class="${p.stock <= p.min ? "bad" : ""}">${p.stock}${u(p)}<small>mín. ${p.min}</small></span>
    <span class="ac"><button data-e="${p.cod}">Editar</button><button data-b="${p.cod}">${p.activo ? "Dar de baja" : "Reactivar"}</button><button class="del" data-x="${p.cod}">Eliminar</button></span></div>`; }).join("") || '<div class="card">Sin resultados.</div>';
}
function kardex(){
  const r = MOV.filter(m => !prodSel || m.cod === prodSel).slice(0, 25);
  $("kdx").innerHTML = r.map(m => `<div class="k"><span>${m.nom}<small>${fh(m.f)} · ${m.tipo} · ${m.motivo}</small></span><span class="${m.cant > 0 ? "ok" : "bad"}">${m.cant > 0 ? "+" : ""}${m.cant}<small>${m.antes} → ${m.desp}</small></span></div>`).join("") || "Sin movimientos.";
}

/* ---------- Inventario (transacción: stock + movimiento) ---------- */
function vista(){
  const p = prodSel ? prod(prodSel) : null, c = parseFloat(($("cant") || {}).value);
  if (!p || isNaN(c)) return ($("prev").textContent = "");
  const n = tipo === "entrada" ? p.stock + c : tipo === "merma" ? p.stock - c : c;
  $("prev").textContent = "El stock quedará en " + r3(n) + u(p) + "."; $("prev").style.color = "";
}
async function registrar(){
  const p = prodSel ? prod(prodSel) : null, c = parseFloat($("cant").value), nota = $("nota").value.trim(), err = m => ($("err").textContent = m);
  if (!p) return err("Elige un producto.");
  if (isNaN(c) || c < 0 || (tipo !== "conteo" && c === 0)) return err("Escribe una cantidad válida.");
  if (p.unidad !== "kg" && !Number.isInteger(c)) return err("Este producto se cuenta por pieza: usa un número entero.");
  if (tipo === "merma" && $("mot").value === "Otro" && nota.length < 5) return err("Explica el motivo en la nota (mínimo 5 letras).");
  $("reg").disabled = true; $("err").textContent = "";
  try {
    const nuevo = await runTransaction(db, async tx => {
      const ref = doc(db, "productos", p.cod), sn = await tx.get(ref);
      if (!sn.exists()) throw new Error("El producto ya no existe.");
      const antes = sn.data().stock; let n, t, m;
      if (tipo === "entrada"){ n = r3(antes + c); t = "Entrada por compra"; m = nota ? "Proveedor: " + nota : "Compra"; }
      else if (tipo === "merma"){
        if (c > antes) throw new Error("No puedes sacar más de lo que hay (" + antes + ").");
        const mo = $("mot").value; n = r3(antes - c); t = "Merma"; m = mo === "Otro" ? "Otro: " + nota : mo + (nota ? " · " + nota : "");
      } else {
        if (c === antes) throw new Error("El conteo coincide con el sistema: no hace falta ajustar.");
        n = c; t = "Conteo físico"; m = "Conteo: había " + antes + ", se contó " + c + (nota ? " · " + nota : "");
      }
      tx.update(ref, { stock: n, actualizado: serverTimestamp() });
      tx.set(doc(collection(db, "movimientos")), { productoId: p.cod, nombre: p.nombre, tipo: t, cantidad: r3(n - antes), stockAntes: antes, stockDespues: n, motivo: m, usuarioId: miUid, usuarioNombre: yo, fecha: serverTimestamp() });
      return n;
    });
    $("cant").value = ""; $("nota").value = ""; $("prev").textContent = "Movimiento registrado. Stock actual: " + nuevo + u(p) + "."; $("prev").style.color = "var(--ok)";
  } catch (e) { err(e.message); }
  $("reg").disabled = false;
}

/* ---------- Productos: alta, edición, baja y eliminación ---------- */
function abrirProd(cod){
  const p = cod ? prod(cod) : null; edit = p ? p.cod : null;
  $("dpT").textContent = p ? "Editar producto" : "Nuevo producto";
  $("pCod").value = p ? p.cod : ""; $("pCod").disabled = !!p; $("pSig").hidden = !!p;
  $("pNom").value = p ? p.nombre : ""; $("pDep").value = p ? p.depto : ""; $("pUni").value = p ? p.unidad : "pza";
  $("pPre").value = p ? p.precio : ""; $("pCos").value = p ? p.costo : ""; $("pIva").value = p ? String(p.iva) : "0.16";
  $("pMin").value = p ? p.min : 5; $("pStk").value = p ? p.stock : 0; $("pStk").disabled = !!p;
  $("pDl").innerHTML = deps().map(d => `<option value="${d}">`).join(""); $("pErr").textContent = "";
  $("dProd").showModal(); (p ? $("pNom") : $("pCod")).focus();
}
$("pSig").onclick = () => { let n = 1; while (P.some(p => p.cod === String(n))) n++; $("pCod").value = n; $("pNom").focus(); };
$("pNo").onclick = () => $("dProd").close();
$("pOk").onclick = async () => {
  const cod = $("pCod").value.trim(), nombre = $("pNom").value.trim(), depto = $("pDep").value.trim(), unidad = $("pUni").value;
  const precio = parseFloat($("pPre").value), costo = parseFloat($("pCos").value), iva = parseFloat($("pIva").value), min = parseFloat($("pMin").value) || 0, stock = parseFloat($("pStk").value) || 0;
  const e = m => ($("pErr").textContent = m);
  if (!/^\d+$/.test(cod)) return e("El código de barras solo lleva números.");
  if (!edit && prod(cod)) return e("Ese código ya existe: " + prod(cod).nombre + ".");
  if (nombre.length < 3) return e("Escribe el nombre del producto.");
  if (!depto) return e("Elige o escribe un departamento.");
  if (!(precio > 0)) return e("El precio debe ser mayor a cero.");
  if (isNaN(costo) || costo < 0) return e("Escribe el costo (puede ser 0).");
  if (!edit && unidad === "pza" && !Number.isInteger(stock)) return e("Las existencias por pieza deben ser un número entero.");
  $("pOk").disabled = true; $("pErr").textContent = "";
  try {
    if (edit){
      const b = writeBatch(db);
      b.update(doc(db, "productos", edit), { nombre, departamento: depto, unidad, precio, iva, stockMinimo: min, actualizado: serverTimestamp() });
      b.set(doc(db, "productosPrivado", edit), { costo });
      await b.commit();
    } else {
      await runTransaction(db, async tx => {
        const ref = doc(db, "productos", cod);
        if ((await tx.get(ref)).exists()) throw new Error("Ese código ya existe.");
        tx.set(ref, { nombre, departamento: depto, unidad, precio, iva, stock, stockMinimo: min, activo: true, creado: serverTimestamp(), actualizado: serverTimestamp() });
        tx.set(doc(db, "productosPrivado", cod), { costo });
        if (stock > 0) tx.set(doc(collection(db, "movimientos")), { productoId: cod, nombre, tipo: "Inventario inicial", cantidad: stock, stockAntes: 0, stockDespues: stock, motivo: "Alta del producto", usuarioId: miUid, usuarioNombre: yo, fecha: serverTimestamp() });
      });
    }
    $("dProd").close();
  } catch (err) { e("No se pudo guardar: " + err.message); }
  $("pOk").disabled = false;
};

function confirmar(titulo, texto, fn){ elim = fn; $("elT").textContent = titulo; $("elP").innerHTML = texto; $("dEl").showModal(); }
$("elNo").onclick = () => $("dEl").close();
$("elSi").onclick = async () => { $("dEl").close(); const f = elim; elim = null; if (f) try { await f(); } catch (e) { falla("No se pudo completar la acción", e); } };
function eliminarProd(cod){
  const p = prod(cod);
  confirmar("¿Seguro que quieres eliminar este producto?", `<b>${p.nombre}</b><br>${p.stock > 0 ? `<span class="bad">Todavía tiene ${p.stock}${u(p)} en existencia; ese inventario se perderá.</span><br>` : ""}Esta acción no se puede deshacer. Las ventas anteriores conservan su nombre y precio. Si solo quieres dejar de venderlo, mejor usa «Dar de baja».`,
    async () => {
      const b = writeBatch(db);
      b.delete(doc(db, "productos", cod)); b.delete(doc(db, "productosPrivado", cod));
      PROMOS.filter(x => x.prods.includes(cod)).forEach(x => b.update(doc(db, "promociones", x.id), { productos: arrayRemove(cod) }));
      await b.commit(); if (prodSel === cod) prodSel = null;
    });
}

/* ---------- Corte de caja ---------- */
async function abrirCorte(id){
  cor = T.find(t => t.id === id); await cargarRes(cor);
  const d = RES[cor.id]; if (!d) return;
  const tr = d.ret.reduce((a, r) => a + r.m, 0);
  $("cInfo").innerHTML = `<small>${cor.cajero} · Caja ${cor.caja} · desde ${fh(cor.inicio)}</small><div class="l"><span>Fondo + ventas en efectivo</span><span>${money(cor.fondo + d.ef)}</span></div><div class="l"><span>Retiros</span><span>−${money(tr)}</span></div><div class="l t"><span>Efectivo esperado</span><span>${money(esperado(cor))}</span></div>`;
  $("cCont").value = ""; $("cNota").value = ""; $("cDif").textContent = ""; $("cErr").textContent = ""; $("dCorte").showModal(); $("cCont").focus();
}
function difCorte(){
  const v = parseFloat($("cCont").value); if (isNaN(v)) return ($("cDif").textContent = "");
  const d = r2(v - esperado(cor)); $("cDif").textContent = d === 0 ? "Cuadra exacto." : (d > 0 ? "Sobrante " : "Faltante ") + money(Math.abs(d)); $("cDif").style.color = d === 0 ? "var(--ok)" : "var(--bad)";
}
$("cCont").oninput = difCorte; $("cNo").onclick = () => $("dCorte").close();
$("cOk").onclick = async () => {
  const v = parseFloat($("cCont").value), nota = $("cNota").value.trim();
  if (isNaN(v) || v < 0) return ($("cErr").textContent = "Escribe el efectivo que contaste.");
  const esp = esperado(cor), d = r2(v - esp); if (d !== 0 && nota.length < 5) return ($("cErr").textContent = "Hay diferencia: explica qué pasó en la nota.");
  $("cOk").disabled = true;
  try {
    const x = RES[cor.id];
    await updateDoc(doc(db, "turnos", cor.id), { estado: "cerrado", fin: serverTimestamp(), esperado: esp, contado: v, diferencia: d, nota, cerradoPor: yo,
      resumen: { ef: x.ef, tj: x.tj, tr: x.tr, tk: x.tk, ret: x.ret.map(r => ({ h: r.h, m: r.m, mot: r.mot })) } });
    $("dCorte").close();
  } catch (e) { $("cErr").textContent = "No se pudo cerrar el turno: " + e.message; }
  $("cOk").disabled = false;
};

/* ---------- Promociones ---------- */
$("prDias").innerHTML = DIAS.map((d, i) => `<label><input type="checkbox" value="${i}">${d.slice(0, 3)}</label>`).join("");
function tipoPromo(){ const n = $("prTipo").value === "nxm"; $("prNx").hidden = !n; $("prPc").hidden = n; }
function pintarPT(){ $("prTags").innerHTML = promoProds.map(c => `<span>${(prod(c) || { nombre: c }).nombre}<button type="button" data-pq="${c}" aria-label="Quitar">×</button></span>`).join("") || "<small>Agrega al menos un producto.</small>"; }
function abrirPromo(id){
  const p = id ? PROMOS.find(x => x.id === id) : null; promoEd = p ? p.id : null; promoProds = p ? [...p.prods] : [];
  $("prT").textContent = p ? "Editar promoción" : "Nueva promoción";
  $("prNom").value = p ? p.nom : ""; $("prTipo").value = p ? p.tipo : "nxm"; $("prN").value = p && p.n ? p.n : 2; $("prM").value = p && p.m ? p.m : 1; $("prPct").value = p && p.pct ? p.pct : 10; $("prVig").value = p ? p.vig : "";
  document.querySelectorAll("#prDias input").forEach(i => i.checked = p ? p.dias.includes(+i.value) : false);
  $("prDl").innerHTML = P.map(x => `<option value="${x.cod}">${x.nombre}</option>`).join(""); $("prIn").value = ""; $("prErr").textContent = "";
  pintarPT(); tipoPromo(); $("dPromo").showModal(); $("prNom").focus();
}
$("prTipo").onchange = tipoPromo;
$("prAdd").onclick = () => {
  const t = $("prIn").value.trim().toLowerCase(), p = P.find(x => x.cod === t || x.nombre.toLowerCase() === t) || (t ? P.find(x => x.nombre.toLowerCase().includes(t)) : null);
  if (!p) return ($("prErr").textContent = "No encontré ese producto.");
  if (!promoProds.includes(p.cod)) promoProds.push(p.cod);
  $("prIn").value = ""; $("prErr").textContent = ""; pintarPT();
};
$("prTags").onclick = e => { const b = e.target.closest("[data-pq]"); if (b){ promoProds = promoProds.filter(c => c !== b.dataset.pq); pintarPT(); } };
$("prNo").onclick = () => $("dPromo").close();
$("prOk").onclick = async () => {
  const nom = $("prNom").value.trim(), tp = $("prTipo").value, n = parseInt($("prN").value), m = parseInt($("prM").value), pct = parseFloat($("prPct").value), e = x => ($("prErr").textContent = x);
  if (nom.length < 3) return e("Ponle un nombre a la promoción.");
  if (!promoProds.length) return e("Agrega al menos un producto.");
  if (tp === "nxm" && !(n >= 2 && m >= 1 && m < n)) return e("«Lleva» debe ser mayor que «Paga» (por ejemplo lleva 2, paga 1).");
  if (tp === "pct" && !(pct > 0 && pct <= 90)) return e("El descuento debe estar entre 1 y 90 %.");
  const dat = { nombre: nom, tipo: tp, n: tp === "nxm" ? n : 0, m: tp === "nxm" ? m : 0, pct: tp === "pct" ? pct : 0, productos: [...promoProds],
    etiqueta: tp === "nxm" ? n + "x" + m : "−" + pct + "%", vigencia: $("prVig").value.trim(), dias: [...document.querySelectorAll("#prDias input:checked")].map(i => +i.value) };
  $("prOk").disabled = true;
  try { if (promoEd) await updateDoc(doc(db, "promociones", promoEd), dat); else await addDoc(collection(db, "promociones"), { ...dat, activa: true, creado: serverTimestamp() }); $("dPromo").close(); }
  catch (err) { e("No se pudo guardar: " + err.message); }
  $("prOk").disabled = false;
};

/* ---------- Avisos ---------- */
async function publicar(){
  const t = $("avT").value.trim(); if (t.length < 5) return ($("avE").textContent = "Escribe el aviso (mínimo 5 letras).");
  $("avP").disabled = true;
  try { await addDoc(collection(db, "avisos"), { texto: t, importante: $("avI").checked, creado: serverTimestamp(), autor: yo }); $("avT").value = ""; $("avI").checked = false; $("avE").textContent = ""; }
  catch (e) { $("avE").textContent = "No se pudo publicar: " + e.message; }
  $("avP").disabled = false;
}

/* ---------- Usuarios (crear con una app secundaria para no cerrar tu sesión) ---------- */
$("uNo").onclick = () => $("dUser").close();
$("uOk").onclick = async () => {
  const nombre = $("uNom").value.trim(), correo = $("uCor").value.trim().toLowerCase(), rol = $("uRol").value, pas = $("uPas").value, e = x => ($("uErr").textContent = x);
  if (nombre.length < 2) return e("Escribe el nombre.");
  if (!/^\S+@\S+\.\S+$/.test(correo)) return e("Escribe un correo válido.");
  if (pas.length < 6) return e("La contraseña temporal necesita mínimo 6 caracteres.");
  $("uOk").disabled = true; $("uErr").textContent = "";
  const sec2 = initializeApp(app.options, "alta" + Date.now());
  try {
    const a = getAuth(sec2), cred = await createUserWithEmailAndPassword(a, correo, pas);
    await signOut(a);
    await setDoc(doc(db, "usuarios", cred.user.uid), { nombre, correo, rol, activo: true, creado: serverTimestamp() });
    $("dUser").close();
  } catch (err) {
    e(err.code === "auth/email-already-in-use" ? "Ese correo ya tiene una cuenta." : err.code === "auth/weak-password" ? "La contraseña es muy débil." : "No se pudo crear el usuario: " + err.message);
  }
  try { await deleteApp(sec2); } catch (x) {}
  $("uOk").disabled = false;
};

/* ---------- Eventos ---------- */
document.addEventListener("click", e => {
  const g = s => e.target.closest(s);
  if (g("[data-s]")){ sec = g("[data-s]").dataset.s; render(); if (sec === "corte") T.filter(t => t.estado === "abierto").forEach(cargarRes); }
  else if (g("[data-aj]")){ prodSel = g("[data-aj]").dataset.aj; sec = "inventario"; tipo = "entrada"; render(); }
  else if (g("#nuevo")) abrirProd();
  else if (g("[data-e]")) abrirProd(g("[data-e]").dataset.e);
  else if (g("[data-b]")){ const p = prod(g("[data-b]").dataset.b); updateDoc(doc(db, "productos", p.cod), { activo: !p.activo, actualizado: serverTimestamp() }).catch(x => falla("No se pudo cambiar el estado", x)); }
  else if (g("[data-d]")){ dep = g("[data-d]").dataset.d; chips(); listar(); }
  else if (g("[data-t]")){ tipo = g("[data-t]").dataset.t; render(); }
  else if (g("#reg")) registrar();
  else if (g("[data-c]")) abrirCorte(g("[data-c]").dataset.c);
  else if (g("[data-x]")) eliminarProd(g("[data-x]").dataset.x);
  else if (g("#nPromo")) abrirPromo();
  else if (g("[data-pe]")) abrirPromo(g("[data-pe]").dataset.pe);
  else if (g("[data-pa]")){ const p = PROMOS.find(x => x.id === g("[data-pa]").dataset.pa); updateDoc(doc(db, "promociones", p.id), { activa: !p.activa }).catch(x => falla("No se pudo cambiar la promoción", x)); }
  else if (g("[data-pd]")){ const p = PROMOS.find(x => x.id === g("[data-pd]").dataset.pd); confirmar("¿Seguro que quieres eliminar esta promoción?", `<b>${p.nom}</b><br>Dejará de aparecer en la caja. Si solo quieres detenerla un tiempo, mejor usa «Pausar».`, () => deleteDoc(doc(db, "promociones", p.id))); }
  else if (g("#avP")) publicar();
  else if (g("[data-ad]")){ const a = AVISOS.find(x => x.id === g("[data-ad]").dataset.ad); confirmar("¿Seguro que quieres eliminar este aviso?", `<b>${a.txt}</b>`, () => deleteDoc(doc(db, "avisos", a.id))); }
  else if (g("[data-rr]")){ updateDoc(doc(db, "reportes", g("[data-rr]").dataset.rr), { estado: "resuelto", resueltoPor: yo, resueltoEn: serverTimestamp() }).catch(x => falla("No se pudo marcar el reporte", x)); }
  else if (g("[data-rn]")){ const r = REPS.find(x => x.id === g("[data-rn]").dataset.rn); abrirProd(); $("pCod").value = r.prod; }
  else if (g("#nUser")){ ["uNom", "uCor", "uPas"].forEach(i => $(i).value = ""); $("uErr").textContent = ""; $("uRol").value = "cobrador"; $("dUser").showModal(); $("uNom").focus(); }
  else if (g("[data-ua]")){ const x = USERS.find(y => y.id === g("[data-ua]").dataset.ua); updateDoc(doc(db, "usuarios", x.id), { activo: !x.activo }).catch(z => falla("No se pudo cambiar el usuario", z)); }
});
document.addEventListener("input", e => { if (e.target.id === "q") listar(); if (e.target.id === "cant") vista(); });
document.addEventListener("change", e => {
  if (e.target.id !== "iprod") return;
  const t = e.target.value.trim().toLowerCase(), p = P.find(x => x.cod === t || x.nombre.toLowerCase() === t) || (t ? P.filter(x => x.nombre.toLowerCase().includes(t))[0] : null);
  prodSel = p ? p.cod : null; render();
});
render();
