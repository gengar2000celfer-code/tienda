import { collection, doc, addDoc, getDocs, onSnapshot, query, where, orderBy, runTransaction, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, requerirRol, cerrarSesion } from "./firebase.js";

/* ---------- Sesión: solo entra un cobrador activo ---------- */
const { user, perfil } = await requerirRol("cobrador");
const miUid = user.uid, cajero = perfil.nombre || user.email;

const $ = id => document.getElementById(id), money = n => "$" + n.toFixed(2), r2 = n => Math.round(n * 100) / 100;
const q3 = n => Math.round(n * 1000) / 1000;
$("quien").textContent = cajero; $("aCajero").textContent = cajero;
$("salir").onclick = cerrarSesion;

/* ---------- Estado ---------- */
const P = Object.create(null);            // productos por código de barras (se actualizan en vivo)
let PROMOS = [], AVISOS = [];
let lines = [], sel = null, method = "Efectivo", confirma = null, promosSel = new Set(), repCtx = null, turno = null;
const cant = l => P[l.id].unit === "kg" ? l.n + " kg" : l.n;
const hint = (t, mal, ctx) => { $("hintTxt").textContent = t || ""; $("hint").className = "hint" + (mal ? " mal" : ""); repCtx = ctx || null; $("hintAct").hidden = !ctx; };
const linea = id => lines.find(l => l.id === id);
const libre = () => ![...document.querySelectorAll("dialog")].some(d => d.open);
const hhmm = d => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const aFecha = t => (t && t.toDate) ? t.toDate() : new Date();

/* ---------- Datos en vivo desde Firestore ---------- */
onSnapshot(collection(db, "productos"), snap => {
  for (const k in P) delete P[k];
  snap.forEach(d => {
    const x = d.data(); if (x.activo === false) return;
    P[d.id] = { id: d.id, bar: d.id, name: x.nombre, price: x.precio, cat: x.departamento, iva: x.iva, stock: x.stock, unit: x.unidad === "kg" ? "kg" : "pza" };
  });
  lines = lines.filter(l => P[l.id]);
  render(); if ($("dB").open) listarB();
}, err => hint("No se pudieron cargar los productos: " + err.message, 1));

onSnapshot(collection(db, "promociones"), snap => {
  PROMOS = snap.docs.map(d => { const x = d.data();
    return { id: d.id, nom: x.nombre, tipo: x.tipo, n: x.n, m: x.m, pct: x.pct, ids: x.productos || [], etiqueta: x.etiqueta, vigencia: x.vigencia, dias: x.dias || [], activa: x.activa !== false }; })
    .filter(p => p.activa);
  promosSel = new Set([...promosSel].filter(id => PROMOS.some(p => p.id === id)));
  render(); if ($("dPr").open) pintarPromos();
});

onSnapshot(query(collection(db, "avisos"), orderBy("creado", "desc")), snap => {
  AVISOS = snap.docs.map(d => { const x = d.data(), f = aFecha(x.creado);
    return { id: d.id, texto: x.texto, importante: !!x.importante, cuando: f.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) + ", " + hhmm(f) }; });
  pintarAvisos();
});

/* ---------- Promociones y totales ---------- */
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const vigente = pr => !pr.dias.length || pr.dias.includes(new Date().getDay());
const regla = pr => pr.tipo === "nxm" ? "Lleva " + pr.n + " y paga " + pr.m : pr.pct + "% de descuento";
const nombreProd = id => P[id] ? P[id].name : id;

function sums(ls = lines, ps = promosSel){
  const d = {}, usados = new Set();
  PROMOS.forEach(pr => {
    if (!vigente(pr) || !ps.has(pr.id)) return;
    const act = ls.filter(l => P[l.id] && pr.ids.includes(l.id) && !usados.has(l.id)); if (!act.length) return;
    if (pr.tipo === "nxm"){
      const un = []; act.forEach(l => { for (let i = 0; i < Math.floor(l.n); i++) un.push({ id: l.id, p: P[l.id].price }); });
      const libres = Math.floor(un.length / pr.n) * (pr.n - pr.m);
      un.sort((x, y) => x.p - y.p).slice(0, libres).forEach(u => d[u.id] = r2((d[u.id] || 0) + u.p));
      if (libres) act.forEach(l => usados.add(l.id));
    } else act.forEach(l => { d[l.id] = r2(P[l.id].price * l.n * pr.pct / 100); usados.add(l.id); });
  });
  let t = 0, iva = 0, n = 0, desc = 0;
  ls.forEach(l => { const p = P[l.id]; if (!p) return; const neto = r2(p.price * l.n - (d[l.id] || 0)); t += neto; iva += neto - neto / (1 + p.iva); n += p.unit === "kg" ? 1 : l.n; desc += d[l.id] || 0; });
  return { t: r2(t), iva: r2(iva), n, desc: r2(desc), d };
}

/* ---------- Ticket en pantalla ---------- */
function render(){
  const { t, iva, n, desc, d } = sums();
  $("rows").innerHTML = lines.length ? lines.map(l => { const p = P[l.id];
    return `<div class="row${l.id === sel ? " sel" : ""}" data-id="${l.id}"><span class="qty"><button data-d="-1" aria-label="Quitar uno">−</button><button class="qn" aria-label="Editar cantidad">${cant(l)}</button><button data-d="1" aria-label="Agregar uno">+</button></span><span>${p.name}<small>${p.bar}${p.iva ? "" : " · IVA 0%"}</small>${d[l.id] ? `<small class="promo">Promoción: −${money(d[l.id])}</small>` : ""}</span><span class="r u">${money(p.price)}${p.unit === "kg" ? "/kg" : ""}</span><span class="r">${money(r2(p.price * l.n - (d[l.id] || 0)))}</span></div>`; }).join("")
    : '<p class="empty">Escanea o escribe un código para empezar.</p>';
  $("art").textContent = n; $("iva").textContent = money(iva); $("tot").textContent = money(t);
  $("rowDesc").hidden = !desc; $("desc").textContent = "−" + money(desc);
  $("bCobrar").disabled = !lines.length; $("bCancel").disabled = !lines.length; $("bBorrar").disabled = sel === null; $("bCant").disabled = sel === null; actualizarEspera();
  $("bPromo").firstChild.textContent = "Promociones" + (promosSel.size ? " (" + promosSel.size + ")" : "");
  const f = $("rows").querySelector(".sel"); if (f) f.scrollIntoView({ block: "nearest" });
}
function promoTip(id){
  const pr = PROMOS.find(x => vigente(x) && x.ids.includes(id)); if (!pr) return "";
  if (!promosSel.has(pr.id)) return " Hay promoción " + pr.etiqueta + " disponible: ábrela con F3.";
  if (pr.tipo === "pct") return " Promo " + pr.etiqueta + " aplicada.";
  const u = lines.filter(l => pr.ids.includes(l.id)).reduce((a, l) => a + l.n, 0), falta = (pr.n - u % pr.n) % pr.n;
  return falta ? " Promo " + pr.etiqueta + ": agrega " + falta + " más para activarla." : " Promo " + pr.etiqueta + " aplicada.";
}
function agregar(id, n = 1){
  const p = P[id]; if (!p) return;
  const l = linea(id), ya = l ? l.n : 0, u = p.unit === "kg" ? " kg" : "";
  if (p.stock <= 0) return hint(p.name + ": agotado.", 1, { tipo: "Hay producto, pero el sistema dice agotado", prod: p.name + " (" + p.bar + ")" });
  if (q3(ya + n) > p.stock) return hint("Solo quedan " + p.stock + u + " de " + p.name + ".", 1);
  if (l) l.n = q3(l.n + n); else lines.push({ id, n });
  sel = id; hint(n + u + " × " + p.name + " agregado." + promoTip(id)); render();
}

/* ---------- Código de barras ---------- */
$("scan").onsubmit = e => {
  e.preventDefault();
  let t = $("code").value.trim(); if (!t) return;
  let n = 1; const m = t.match(/^(\d+(?:\.\d+)?)\*(.+)$/); if (m && +m[1] > 0){ n = +m[1]; t = m[2]; }
  const p = P[t];
  if (p){ agregar(p.id, n); $("code").value = ""; }
  else if (/^\d+$/.test(t)) hint("El código " + t + " no existe.", 1, { tipo: "Código no encontrado", prod: t });
  else abrirBuscar(t);
};

/* ---------- Buscar por nombre ---------- */
function listarB(){
  const t = $("bq").value.trim().toLowerCase();
  const r = Object.values(P).filter(p => !t || p.name.toLowerCase().includes(t) || p.bar.startsWith(t)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);
  $("res").innerHTML = r.map(p => `<button data-id="${p.id}" ${p.stock <= 0 ? "disabled" : ""}><span>${p.name}<small>${p.bar} · ${p.stock <= 0 ? "Agotado" : p.stock <= 5 ? "Últimas " + p.stock : "En existencia"}${PROMOS.some(x => vigente(x) && x.ids.includes(p.id)) ? " · Promo" : ""}</small></span><strong>${money(p.price)}${p.unit === "kg" ? "/kg" : ""}</strong></button>`).join("") || '<p class="empty" style="padding:24px 0">Sin resultados.</p>';
}
function abrirBuscar(txt){ $("bq").value = txt || ""; listarB(); $("dB").showModal(); $("bq").focus(); $("bq").select(); }
$("bBuscar").onclick = () => abrirBuscar($("code").value.trim());
$("bq").oninput = listarB;
$("bq").onkeydown = e => { if (e.key === "Enter"){ const b = $("res").querySelector("button:not(:disabled)"); if (b) b.click(); } };
$("res").onclick = e => { const b = e.target.closest("[data-id]"); if (b){ agregar(b.dataset.id); $("code").value = ""; $("dB").close(); } };
$("bCerrarB").onclick = () => $("dB").close();

/* ---------- Ticket: seleccionar, + / − ---------- */
$("rows").onclick = e => {
  const r = e.target.closest(".row"); if (!r) return;
  const id = r.dataset.id, b = e.target.closest("[data-d]");
  if (e.target.closest(".qn")){ sel = id; return abrirCant(id); }
  if (b){
    const d = +b.dataset.d, l = linea(id), paso = P[id].unit === "kg" ? .25 : 1;
    if (d > 0) return agregar(id, paso);
    if (q3(l.n - paso) <= 0){ sel = id; render(); return pedirEliminar(id); }
    l.n = q3(l.n - paso);
  } else sel = id;
  render();
};

let porEliminar = null;
function pedirEliminar(id){ porEliminar = id; $("eNom").textContent = nombreProd(id); $("dE").showModal(); $("eSi").focus(); }
$("eNo").onclick = () => { $("dE").close(); $("code").focus(); };
$("eSi").onclick = () => { lines = lines.filter(x => x.id !== porEliminar); sel = null; hint(nombreProd(porEliminar) + " eliminado del ticket."); $("dE").close(); render(); $("code").focus(); };

/* ---------- Opciones ---------- */
$("bBorrar").onclick = () => borrar();
function borrar(){
  if (sel === null) return hint("Toca un artículo del ticket para seleccionarlo.", 1);
  const nom = nombreProd(sel); lines = lines.filter(l => l.id !== sel); sel = null;
  hint(nom + " borrado del ticket."); render(); $("code").focus();
}
$("bCancel").onclick = () => cancelar();
function cancelar(){
  if (!lines.length) return;
  if (!confirma){ $("bCancel").firstChild.textContent = "¿Seguro? Toca otra vez"; confirma = setTimeout(restablecer, 3000); return; }
  lines = []; sel = null; promosSel = new Set(); hint("Venta cancelada."); restablecer(); render(); $("code").focus();
}
function restablecer(){ clearTimeout(confirma); confirma = null; $("bCancel").firstChild.textContent = "Cancelar venta"; }

/* ---------- Cantidad editable ---------- */
let cantId = null;
function abrirCant(id){
  if (id === null || id === undefined) return hint("Toca un artículo del ticket para cambiar su cantidad.", 1);
  const p = P[id], l = linea(id); cantId = id; sel = id; render();
  $("qNom").textContent = p.name + " · " + (p.unit === "kg" ? "kilos" : "piezas") + " (disponibles: " + p.stock + ")";
  $("qIn").step = p.unit === "kg" ? "0.001" : "1"; $("qIn").value = l.n; $("qErr").textContent = "";
  $("dQ").showModal(); $("qIn").focus(); $("qIn").select();
}
function aplicarCant(){
  const p = P[cantId], v = parseFloat($("qIn").value);
  if (!(v >= 0)) return ($("qErr").textContent = "Escribe una cantidad válida.");
  if (p.unit !== "kg" && !Number.isInteger(v)) return ($("qErr").textContent = "Este producto se vende por pieza: usa un número entero.");
  if (q3(v) > p.stock) return ($("qErr").textContent = "Solo hay " + p.stock + (p.unit === "kg" ? " kg" : " piezas") + " en existencia.");
  $("dQ").close();
  if (v === 0) return pedirEliminar(cantId);
  linea(cantId).n = q3(v); hint("Cantidad actualizada."); render(); $("code").focus();
}
$("bCant").onclick = () => abrirCant(sel);
$("qOk").onclick = aplicarCant;
$("qNo").onclick = () => { $("dQ").close(); $("code").focus(); };
$("qIn").onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); aplicarCant(); } };

/* ---------- Venta en espera ---------- */
let espera = [], nEspera = 0;
function actualizarEspera(){
  $("bRec").firstChild.textContent = "Recuperar" + (espera.length ? " (" + espera.length + ")" : "");
  $("bRec").disabled = !espera.length; $("bEsp").disabled = !lines.length;
}
function ponerEspera(){
  if (!lines.length) return hint("No hay nada que poner en espera.", 1);
  espera.push({ n: ++nEspera, hora: new Date(), lines: lines.map(l => ({ ...l })), promos: new Set(promosSel) });
  lines = []; sel = null; promosSel = new Set(); hint("Venta puesta en espera. Puedes atender al siguiente cliente."); render(); $("code").focus();
}
function abrirEspera(){
  if (!espera.length) return;
  $("wList").innerHTML = espera.map((w, i) => {
    const { t: tot, n: art } = sums(w.lines.filter(l => P[l.id]), w.promos);
    return `<div><span>Espera #${w.n}<small>${hhmm(w.hora)} · ${art} artículos · ${money(tot)}</small></span><button data-r="${i}">Recuperar</button><button data-q="${i}">Descartar</button></div>`; }).join("");
  if (!$("dW").open) $("dW").showModal();
}
function recuperar(i){
  const w = espera[i]; espera.splice(i, 1);
  if (lines.length) espera.push({ n: ++nEspera, hora: new Date(), lines, promos: new Set(promosSel) });
  let ajustado = false;
  lines = w.lines.filter(l => P[l.id]).map(l => { const mx = P[l.id].stock; if (l.n > mx){ ajustado = true; l.n = mx; } return l; }).filter(l => l.n > 0);
  sel = null; promosSel = new Set(w.promos); $("dW").close();
  hint("Venta en espera #" + w.n + " recuperada." + (ajustado ? " Se ajustaron cantidades por existencias." : ""), ajustado);
  render(); $("code").focus();
}
$("bEsp").onclick = ponerEspera;
$("bRec").onclick = abrirEspera;
$("wCerrar").onclick = () => $("dW").close();
$("wList").onclick = e => {
  const r = e.target.closest("[data-r]"), q = e.target.closest("[data-q]");
  if (r) return recuperar(+r.dataset.r);
  if (!q) return;
  if (q.dataset.sure){ espera.splice(+q.dataset.q, 1); render(); if (espera.length) abrirEspera(); else $("dW").close(); }
  else { q.dataset.sure = 1; q.textContent = "¿Seguro?"; }
};

/* ---------- Promociones (las crea el dueño; aquí se eligen) ---------- */
function pintarPromos(){
  const card = pr => {
    const act = vigente(pr), on = promosSel.has(pr.id), ahorro = sums(lines, new Set([pr.id])).desc;
    const u = lines.filter(l => pr.ids.includes(l.id)).reduce((a, l) => a + l.n, 0);
    const estado = !act ? "Disponible: " + pr.dias.map(x => DIAS[x]).join(", ")
      : !on ? "Toca para aplicarla"
      : ahorro > 0 ? "✓ Aplicada · ahorras " + money(ahorro)
      : pr.tipo === "nxm" && u ? "✓ Seleccionada · agrega " + (pr.n - u) + " más para activarla" : "✓ Seleccionada · agrega productos de la promoción";
    return `<button class="pr${act ? "" : " off"}" data-id="${pr.id}" aria-pressed="${on}" ${act ? "" : "disabled"}><b>${pr.etiqueta}</b><span>${pr.nom}<small>${regla(pr)} · ${pr.ids.map(nombreProd).join(" / ")}</small><small>${pr.vigencia || ""}</small><small class="${on ? "ok" : ""}">${estado}</small></span></button>`;
  };
  $("prList").innerHTML = PROMOS.length ? [...PROMOS].sort((x, y) => vigente(y) - vigente(x)).map(card).join("") : '<p class="empty" style="padding:24px 0">No hay promociones por ahora.</p>';
}
function abrirPromos(){ pintarPromos(); if (!$("dPr").open) $("dPr").showModal(); }
$("bPromo").onclick = abrirPromos;
$("prList").onclick = e => {
  const b = e.target.closest("[data-id]"); if (!b || b.disabled) return;
  const id = b.dataset.id; if (promosSel.has(id)) promosSel.delete(id); else promosSel.add(id);
  render(); pintarPromos();
};
$("prCerrar").onclick = () => { $("dPr").close(); $("code").focus(); };

/* ---------- Cobrar: ventana de pago (pago mixto) ---------- */
let pagos = [], ventaUid = null, enCurso = false;
const sumaPagos = () => r2(pagos.reduce((a, p) => a + p.monto, 0));
const restoPago = () => r2(sums().t - sumaPagos());
function estadoPago(){
  const t = sums().t, pend = parseFloat($("rec").value) || 0;
  const todos = pend > 0 ? pagos.concat([{ m: method, monto: r2(pend) }]) : pagos;
  const noEf = r2(todos.filter(p => p.m !== "Efectivo").reduce((a, p) => a + p.monto, 0));
  const ef = r2(todos.filter(p => p.m === "Efectivo").reduce((a, p) => a + p.monto, 0));
  const needed = r2(t - noEf);
  return { t, pend, todos, noEf, ef, ok: todos.length > 0 && noEf <= t && ef >= needed,
           cambio: r2(Math.max(0, ef - Math.max(needed, 0))), falta: r2(Math.max(0, needed - ef)) };
}
function cobrar(){
  if (!lines.length || !turno) return;
  restablecer(); pagos = []; method = "Efectivo"; enCurso = false; $("bCerrar").textContent = "Cerrar compra";
  ventaUid = doc(collection(db, "ventas")).id;     // id único de la venta: evita registrarla dos veces
  [...$("pay").children].forEach((x, i) => x.setAttribute("aria-pressed", i === 0));
  $("rec").value = sums().t; pago();
  $("dP").showModal(); $("rec").focus(); $("rec").select();
}
function pago(){
  const e = estadoPago(), resto = restoPago();
  $("pTot").textContent = money(e.t);
  $("pList").innerHTML = pagos.length ? '<div class="plist">' + pagos.map((p, i) => `<div><span>${p.m}</span><span>${money(p.monto)} <button data-x="${i}" aria-label="Quitar pago">×</button></span></div>`).join("") + "</div>" : "";
  const set = new Set([resto]); [20, 50, 100, 200, 500, 1000].forEach(b => { if (b >= resto) set.add(b); });
  $("quick").innerHTML = method === "Efectivo" && resto > 0 ? [...set].slice(0, 5).map(v => `<button data-v="${v}">${v === resto ? "Exacto" : "$" + v}</button>`).join("") : "";
  $("chg").textContent = !e.todos.length ? "" : e.ok ? (e.cambio > 0 ? "Cambio: " + money(e.cambio) : "Pago completo")
    : e.noEf > e.t ? "Tarjeta o transferencia no puede pasar del total." : "Faltan " + money(e.falta);
  $("chg").style.color = e.ok ? "var(--ok)" : "var(--bad)";
  $("bAdd").disabled = !(e.pend > 0 && !e.ok && e.noEf <= e.t);
  $("bCerrar").disabled = !e.ok || enCurso;
}
function sugerirResto(){ const r = restoPago(); $("rec").value = r > 0 ? r : ""; pago(); $("rec").focus(); $("rec").select(); }
$("bCobrar").onclick = cobrar;
$("pay").onclick = e => { const b = e.target.closest("[data-m]"); if (!b) return; method = b.dataset.m; [...$("pay").children].forEach(x => x.setAttribute("aria-pressed", x === b)); sugerirResto(); };
$("quick").onclick = e => { const b = e.target.closest("[data-v]"); if (b){ $("rec").value = b.dataset.v; pago(); $("bCerrar").focus(); } };
$("pList").onclick = e => { const b = e.target.closest("[data-x]"); if (b){ pagos.splice(+b.dataset.x, 1); sugerirResto(); } };
$("bAdd").onclick = () => { const e = estadoPago(); if (!(e.pend > 0) || e.noEf > e.t) return; pagos.push({ m: method, monto: r2(e.pend) }); sugerirResto(); };
$("rec").oninput = pago;
$("rec").onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); if (!$("bCerrar").disabled) $("bCerrar").click(); else if (!$("bAdd").disabled) $("bAdd").click(); } };
$("bVolver").onclick = () => { if (enCurso) return; $("dP").close(); $("code").focus(); };

/* ---------- Cerrar compra: todo en una transacción ---------- */
$("bCerrar").onclick = async () => {
  if (enCurso) return;                                   // un segundo clic o Enter no registra otra venta
  const e = estadoPago(); if (!e.ok) return;
  enCurso = true; $("bCerrar").disabled = true; $("bCerrar").textContent = "Guardando…";
  const tot = sums();
  const items = lines.map(l => ({ id: l.id, n: l.n, p: { ...P[l.id] } }));   // foto del ticket tal como se cobra
  try {
    const res = await runTransaction(db, async tx => {
      const vref = doc(db, "ventas", ventaUid), cref = doc(db, "contadores", "folio");
      const prev = await tx.get(vref);
      if (prev.exists()) return { folio: prev.data().folio };                 // ya se había registrado
      const cs = await tx.get(cref);
      const refs = items.map(l => doc(db, "productos", l.id));
      const snaps = await Promise.all(refs.map(r => tx.get(r)));
      const folio = (cs.exists() ? cs.data().folio : 0) + 1;
      const lineas = snaps.map((sn, i) => {
        const l = items[i], x = sn.exists() ? sn.data() : null;
        if (!x || x.activo === false) throw new Error(l.p.name + " ya no está disponible.");
        if (x.precio !== l.p.price) throw new Error("El precio de " + x.nombre + " cambió. Revisa el ticket.");
        if (q3(x.stock - l.n) < 0) throw new Error("Solo quedan " + x.stock + " de " + x.nombre + ".");
        return { l, x, antes: x.stock, despues: q3(x.stock - l.n) };
      });
      lineas.forEach(({ l, x, antes, despues }, i) => {
        tx.update(refs[i], { stock: despues, actualizado: serverTimestamp() });
        tx.set(doc(collection(db, "movimientos")), { productoId: l.id, nombre: x.nombre, tipo: "salida_venta", cantidad: -l.n, stockAntes: antes, stockDespues: despues, ventaId: ventaUid, folio, usuarioId: miUid, fecha: serverTimestamp() });
      });
      tx.set(cref, { folio });
      tx.set(vref, {
        folio, fecha: serverTimestamp(), cobradorId: miUid, cobradorNombre: cajero, turnoId: turno.id, caja: turno.caja,
        items: items.map(l => ({ codigo: l.id, nombre: l.p.name, cantidad: l.n, unidad: l.p.unit, precio: l.p.price, iva: l.p.iva, descuento: tot.d[l.id] || 0 })),
        promociones: [...promosSel], articulos: tot.n, descuento: tot.desc, ivaIncluido: tot.iva, total: tot.t,
        pagos: e.todos.map(p => ({ metodo: p.m, monto: p.monto })), recibido: e.ef, cambio: e.cambio, efectivoNeto: r2(e.ef - e.cambio), estado: "completada"
      });
      return { folio };
    });
    turno.tickets++; turno.articulos += tot.n; turno.venta = r2(turno.venta + tot.t); turno.efectivo = r2(turno.efectivo + e.ef - e.cambio); revisarAviso();
    let tk = `TIENDA\nTicket #${String(res.folio).padStart(4, "0")}\n${new Date().toLocaleString("es-MX")}\nAtendió: ${cajero}\nCaja ${turno.caja} · Turno ${hhmm(turno.inicio)}\n--------------------------\n`;
    items.forEach(l => { tk += `${l.p.unit === "kg" ? l.n + " kg" : l.n} x ${l.p.name}\n   ${money(r2(l.p.price * l.n))}\n`; if (tot.d[l.id]) tk += `   Promoción: -${money(tot.d[l.id])}\n`; });
    tk += `--------------------------\nArtículos: ${tot.n}\n${tot.desc ? "Ahorro por promociones: " + money(tot.desc) + "\n" : ""}IVA incluido: ${money(tot.iva)}\nTOTAL: ${money(tot.t)}\n`;
    e.todos.forEach(p => tk += `${p.m}: ${money(p.monto)}\n`);
    if (e.cambio > 0) tk += `Cambio: ${money(e.cambio)}\n`;
    $("tk").textContent = tk + "\n¡Gracias por su compra!";
    $("dP").close(); $("dT").showModal(); $("bNueva").focus();
  } catch (err) {
    enCurso = false; $("bCerrar").textContent = "Cerrar compra"; pago();
    $("chg").style.color = "var(--bad)";
    $("chg").textContent = "No se pudo cerrar la compra: " + (err.code === "unavailable" ? "sin conexión." : (err.message || err));
  }
};
$("bNueva").onclick = () => { enCurso = false; pagos = []; $("dT").close(); lines = []; sel = null; promosSel = new Set(); hint("Venta cerrada. Lista para la siguiente."); render(); $("code").focus(); };
$("dT").addEventListener("cancel", e => e.preventDefault());   // el ticket se cierra solo con «Nueva venta»

/* ---------- Turno: apertura, fondo de caja, retiros ---------- */
const LIMITE_CAJA = 3000;                       // el dueño lo podrá configurar
const DENOM = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
const duracion = d => { const m = Math.max(0, Math.floor((Date.now() - d) / 60000)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") + " h"; };
const efectivoCaja = () => r2(turno.fondo + turno.efectivo - turno.retiros.reduce((a, r) => a + r.monto, 0));
function chipTurno(){ $("bTurno").textContent = turno ? "Caja " + turno.caja + " · Turno desde " + hhmm(turno.inicio) + " · " + duracion(turno.inicio) : "Turno sin abrir"; }
function revisarAviso(){ $("aviso").hidden = !(turno && efectivoCaja() >= LIMITE_CAJA); }
function validarA(){ $("aOk").disabled = !(parseFloat($("aMonto").value) >= 0); }
function abrirApertura(){
  $("aHora").textContent = new Date().toLocaleString("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  $("aErr").textContent = ""; $("dA").showModal(); $("aMonto").focus();
}
$("den").innerHTML = DENOM.map(v => `<label><span>${v >= 1 ? "$" + v : "50¢"}</span><input type="number" min="0" step="1" inputmode="numeric" data-v="${v}" placeholder="0"></label>`).join("");
$("den").oninput = () => { const tot = [...$("den").querySelectorAll("input")].reduce((a, i) => a + (parseInt(i.value) || 0) * +i.dataset.v, 0); $("aMonto").value = tot || ""; validarA(); };
$("aMonto").oninput = () => { $("den").querySelectorAll("input").forEach(i => i.value = ""); validarA(); };
$("aMonto").onkeydown = e => { if (e.key === "Enter" && !$("aOk").disabled){ e.preventDefault(); $("aOk").click(); } };
$("aOk").onclick = async () => {
  $("aOk").disabled = true; $("aErr").textContent = "";
  const fondo = r2(parseFloat($("aMonto").value));
  try {
    const ref = await addDoc(collection(db, "turnos"), { cobradorId: miUid, cobradorNombre: cajero, caja: "1", fondo, inicio: serverTimestamp(), estado: "abierto" });
    turno = { id: ref.id, inicio: new Date(), fondo, caja: "1", retiros: [], reportes: [], tickets: 0, articulos: 0, venta: 0, efectivo: 0 };
    $("dA").close(); chipTurno(); revisarAviso(); pintarAvisos();
    hint("Turno abierto a las " + hhmm(turno.inicio) + " con fondo de " + money(turno.fondo) + "."); $("code").focus();
  } catch (err) { $("aErr").textContent = "No se pudo abrir el turno: " + err.message; $("aOk").disabled = false; }
};
$("dA").addEventListener("cancel", e => e.preventDefault());   // no se puede vender sin abrir turno
setInterval(chipTurno, 30000);

// Al entrar: si ya tenía un turno abierto (por ejemplo recargó la página), lo retoma con sus números
async function restaurarTurno(){
  const r = await getDocs(query(collection(db, "turnos"), where("cobradorId", "==", miUid), where("estado", "==", "abierto")));
  if (r.empty) return false;
  const d = r.docs[0], x = d.data();
  turno = { id: d.id, inicio: aFecha(x.inicio), fondo: x.fondo, caja: x.caja || "1", retiros: [], reportes: [], tickets: 0, articulos: 0, venta: 0, efectivo: 0 };
  const base = c => getDocs(query(collection(db, c), where("turnoId", "==", d.id), where("cobradorId", "==", miUid)));
  const [v, ret, rep] = await Promise.all([base("ventas"), base("retiros"), base("reportes")]);
  v.forEach(s => { const y = s.data(); if (y.estado === "cancelada") return; turno.tickets++; turno.articulos += y.articulos; turno.venta = r2(turno.venta + y.total); turno.efectivo = r2(turno.efectivo + y.efectivoNeto); });
  ret.forEach(s => { const y = s.data(); turno.retiros.push({ hora: aFecha(y.hora), monto: y.monto, motivo: y.motivo }); });
  rep.forEach(s => { const y = s.data(); turno.reportes.push({ hora: aFecha(y.fecha), tipo: y.tipo, prod: y.producto, nota: y.nota }); });
  return true;
}

$("bTurno").onclick = () => {
  if (!turno) return;
  const fila = (x, y) => `<div><span>${x}</span><span>${y}</span></div>`, tr = turno.retiros.reduce((a, r) => a + r.monto, 0);
  $("mBody").innerHTML = fila("Cajero", cajero) + fila("Caja", turno.caja)
    + fila("Inicio", turno.inicio.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) + ", " + hhmm(turno.inicio)) + fila("Duración", duracion(turno.inicio))
    + fila("Fondo de caja", money(turno.fondo)) + fila("Tickets", turno.tickets) + fila("Artículos vendidos", turno.articulos) + fila("Ventas del turno", money(turno.venta))
    + fila("Retiros", turno.retiros.length ? turno.retiros.length + " · " + money(tr) : "Ninguno")
    + turno.retiros.map(r => `<div class="sub"><span>${hhmm(r.hora)} · ${r.motivo}</span><span>−${money(r.monto)}</span></div>`).join("")
    + fila("Reportes al dueño", turno.reportes.length || "Ninguno")
    + turno.reportes.map(r => `<div class="sub"><span>${hhmm(r.hora)} · ${r.tipo}: ${r.prod}</span><span></span></div>`).join("");
  $("dM").showModal();
};
$("mCerrar").onclick = () => { $("dM").close(); $("code").focus(); };

function abrirRetiro(){ if (!turno) return; $("rMonto").value = ""; $("rErr").textContent = ""; $("rMot").selectedIndex = 0; $("rOtroBox").hidden = true; $("rOtro").value = ""; $("dR").showModal(); $("rMonto").focus(); }
$("bRet").onclick = abrirRetiro; $("bAvisoRet").onclick = abrirRetiro;
$("rNo").onclick = () => { $("dR").close(); $("code").focus(); };
$("rMot").onchange = () => { $("rOtroBox").hidden = $("rMot").value !== "Otro"; $("rErr").textContent = ""; if (!$("rOtroBox").hidden) $("rOtro").focus(); };
$("rOk").onclick = async () => {
  const v = r2(parseFloat($("rMonto").value)), otro = $("rMot").value === "Otro", txt = $("rOtro").value.trim();
  if (!(v > 0)) return ($("rErr").textContent = "Escribe un monto mayor a cero.");
  if (otro && txt.length < 5){ $("rOtro").focus(); return ($("rErr").textContent = "Escribe por qué retiras el efectivo (mínimo 5 letras)."); }
  if (v > efectivoCaja()) return ($("rErr").textContent = "El monto es mayor al efectivo registrado en caja.");
  const motivo = otro ? "Otro: " + txt : $("rMot").value;
  $("rOk").disabled = true;
  try {
    await addDoc(collection(db, "retiros"), { turnoId: turno.id, cobradorId: miUid, monto: v, motivo, hora: serverTimestamp() });
    turno.retiros.push({ hora: new Date(), monto: v, motivo });
    $("dR").close(); hint("Retiro de " + money(v) + " registrado. Motivo: " + motivo.toLowerCase() + "."); revisarAviso(); $("code").focus();
  } catch (err) { $("rErr").textContent = "No se pudo registrar el retiro: " + err.message; }
  $("rOk").disabled = false;
};
$("rMonto").onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); $("rOk").click(); } };
$("rOtro").onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); $("rOk").click(); } };

/* ---------- Reportar al dueño ---------- */
function abrirReporte(ctx){
  if (!turno) return; ctx = ctx || {};
  $("repTipo").value = ctx.tipo || "Código no encontrado"; $("repProd").value = ctx.prod || ""; $("repNota").value = ""; $("repErr").textContent = "";
  $("dRep").showModal(); ($("repProd").value ? $("repNota") : $("repProd")).focus();
}
$("bRep").onclick = () => abrirReporte();
$("hintAct").onclick = () => abrirReporte(repCtx);
$("repNo").onclick = () => { $("dRep").close(); $("code").focus(); };
$("repOk").onclick = async () => {
  const prod = $("repProd").value.trim(), nota = $("repNota").value.trim(), tipo = $("repTipo").value;
  if (!prod){ $("repProd").focus(); return ($("repErr").textContent = "Indica el código o el nombre del producto."); }
  if (tipo === "Otro" && nota.length < 5){ $("repNota").focus(); return ($("repErr").textContent = "Cuéntale al dueño qué pasó (mínimo 5 letras)."); }
  $("repOk").disabled = true;
  try {
    await addDoc(collection(db, "reportes"), { turnoId: turno.id, cobradorId: miUid, cobradorNombre: cajero, tipo, producto: prod, nota, estado: "nuevo", fecha: serverTimestamp() });
    turno.reportes.push({ hora: new Date(), tipo, prod, nota });
    $("dRep").close(); hint("Reporte enviado al dueño. Gracias."); $("code").focus();
  } catch (err) { $("repErr").textContent = "No se pudo enviar el reporte: " + err.message; }
  $("repOk").disabled = false;
};

/* ---------- Avisos del dueño ---------- */
const LK = "pdv_leidos_" + miUid, leidos = new Set(); let avId = null;
try { JSON.parse(localStorage.getItem(LK) || "[]").forEach(i => leidos.add(i)); } catch (e) {}
const guardarLeidos = () => { try { localStorage.setItem(LK, JSON.stringify([...leidos])); } catch (e) {} };
function pintarAvisos(){
  const nuevos = AVISOS.filter(a => !leidos.has(a.id)), imp = nuevos.filter(a => a.importante)[0];
  $("bAv").firstChild.textContent = "Avisos" + (nuevos.length ? " (" + nuevos.length + ")" : "");
  avId = imp ? imp.id : null; $("avDueno").hidden = !imp; if (imp) $("avTxt").textContent = "Aviso del dueño: " + imp.texto;
}
$("avOk").onclick = () => { if (avId) leidos.add(avId); guardarLeidos(); pintarAvisos(); $("code").focus(); };
$("bAv").onclick = () => {
  $("avList").innerHTML = AVISOS.length ? AVISOS.map(a => `<div class="${a.importante ? "imp" : ""}"><small>${a.cuando}${a.importante ? " · Importante" : ""}</small>${a.texto}</div>`).join("") : "<div>No hay avisos.</div>";
  $("dAv").showModal(); AVISOS.forEach(a => leidos.add(a.id)); guardarLeidos(); pintarAvisos();
};
$("avCerrar").onclick = () => { $("dAv").close(); $("code").focus(); };

/* ---------- Atajos de teclado ---------- */
document.addEventListener("keydown", e => {
  if (e.key === "F2"){ e.preventDefault(); if (libre()) abrirBuscar($("code").value.trim()); }
  else if (e.key === "F3"){ e.preventDefault(); if (libre()) abrirPromos(); }
  else if (e.key === "F4"){ e.preventDefault(); if (libre()) abrirCant(sel); }
  else if (e.key === "F7"){ e.preventDefault(); if (libre()) ponerEspera(); }
  else if (e.key === "F8"){ e.preventDefault(); if (libre()) abrirEspera(); }
  else if (e.key === "F9"){ e.preventDefault(); if (libre()) cobrar(); }
  else if (e.key === "Delete" && libre() && !$("code").value) borrar();
  else if (e.key === "Escape" && libre() && lines.length) cancelar();
});

/* ---------- Arranque ---------- */
render();
try {
  if (await restaurarTurno()){ chipTurno(); revisarAviso(); hint("Turno retomado: abierto a las " + hhmm(turno.inicio) + "."); }
  else abrirApertura();
} catch (err) { hint("No se pudo revisar tu turno. Recarga la página. (" + err.message + ")", 1); }
