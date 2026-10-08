const $ = id => document.getElementById(id), money = n => "$" + n.toFixed(2), r2 = n => Math.round(n * 100) / 100;
// [nombre, precio con IVA, departamento, tasa IVA, código, stock, unidad]
// código de 12 dígitos = base de un EAN-13 (se calcula el verificador); código corto (1, 2, 3...) = producto suelto
const ean = b => { let s = 0; for (let i = 0; i < 12; i++) s += +b[i] * (i % 2 ? 3 : 1); return b + (10 - s % 10) % 10; };
const P = [
["Leche Lala Entera 1 L",27.5,"Abarrotes",0,"750102050001",40],
["Pan Bimbo Blanco Grande 680 g",46,"Abarrotes",0,"750100011120",25],
["Huevo San Juan Blanco 12 pzas",52,"Abarrotes",0,"750105530007",3],
["Arroz Verde Valle 1 kg",32,"Abarrotes",0,"750104009002",30],
["Frijol Negro La Sierra 900 g",38,"Abarrotes",0,"750104001136",26],
["Aceite 1-2-3 Vegetal 900 ml",44,"Abarrotes",0,"750102100094",20],
["Atún Dolores en Agua 140 g",24,"Abarrotes",0,"750107200451",48],
["Coca-Cola 600 ml",19,"Bebidas",0.16,"750105536305",60],
["Agua Bonafont 1 L",13,"Bebidas",0,"750103131130",80],
["Jugo del Valle Naranja 1 L",31,"Bebidas",0.16,"750101312704",18],
["Nescafé Clásico 100 g",74,"Bebidas",0.16,"750105927315",0],
["Sabritas Original 45 g",21,"Botanas",0.16,"750101111212",50],
["Galletas Marías Gamesa 170 g",18,"Botanas",0.16,"750100061371",45],
["Chocolate Carlos V 18 g",10,"Botanas",0.16,"750100013101",70],
["Takis Fuego 56 g",20,"Botanas",0.16,"750101130506",42],
["Jabón Zote Rosa 400 g",22,"Limpieza",0.16,"750102602001",36],
["Detergente Ariel 850 g",52,"Limpieza",0.16,"750102540706",22],
["Papel Higiénico Regio 4 rollos",44,"Limpieza",0.16,"750110881101",30],
["Cloralex 1 L",21,"Limpieza",0.16,"750102210052",24],
["Fibra Scotch-Brite Verde",11,"Limpieza",0.16,"750100330820",4],
["Pasta Dental Colgate Triple Acción 75 ml",36,"Higiene",0.16,"750103640008",33],
["Cigarros Marlboro Rojo cajetilla 20 pzas",96,"Tabaco",0.16,"750100222233",40],
["Huevo suelto (pieza)",5.5,"Abarrotes",0,"1",120],
["Cigarro Marlboro Rojo suelto",9,"Tabaco",0.16,"2",200],
["Azúcar estándar suelta (kg)",34,"Abarrotes",0,"3",25,"kg"],
["Cerveza Corona Extra 355 ml",22,"Cervezas",.16,"750100551122",96],
["Cerveza Victoria 355 ml",20,"Cervezas",.16,"750100551245",72]
].map((a,i)=>({id:i,name:a[0],price:a[1],cat:a[2],iva:a[3],bar:a[4].length === 12 ? ean(a[4]) : a[4],stock:a[5],unit:a[6]||"pza"}));

let lines = [], sel = null, method = "Efectivo", folio = 1, confirma = null, promosSel = new Set();
let repCtx = null;
const hint = (t, mal, ctx) => { $("hintTxt").textContent = t || ""; $("hint").className = "hint" + (mal ? " mal" : ""); repCtx = ctx || null; $("hintAct").hidden = !ctx; };
const linea = id => lines.find(l => l.id === id);
const libre = () => ![...document.querySelectorAll("dialog")].some(d => d.open);

function sums(ls = lines, ps = promosSel){
  const d = {}, usados = new Set();
  PROMOS.forEach((pr, ix) => {
    if (!vigente(pr) || !ps.has(ix)) return;
    const act = ls.filter(l => pr.ids.includes(l.id) && !usados.has(l.id)); if (!act.length) return;
    if (pr.tipo === "nxm"){
      const un = []; act.forEach(l => { for (let i = 0; i < Math.floor(l.n); i++) un.push({ id: l.id, p: P[l.id].price }); });
      const libres = Math.floor(un.length / pr.n) * (pr.n - pr.m);
      un.sort((x, y) => x.p - y.p).slice(0, libres).forEach(u => d[u.id] = r2((d[u.id] || 0) + u.p));
      if (libres) act.forEach(l => usados.add(l.id));
    } else act.forEach(l => { d[l.id] = r2(P[l.id].price * l.n * pr.pct / 100); usados.add(l.id); });
  });
  let t = 0, iva = 0, n = 0, desc = 0;
  ls.forEach(l => { const p = P[l.id], neto = r2(p.price * l.n - (d[l.id] || 0)); t += neto; iva += neto - neto / (1 + p.iva); n += p.unit === "kg" ? 1 : l.n; desc += d[l.id] || 0; });
  return { t: r2(t), iva: r2(iva), n, desc: r2(desc), d };
}
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
const q3 = n => Math.round(n * 1000) / 1000, cant = l => P[l.id].unit === "kg" ? l.n + " kg" : l.n;
function agregar(id, n = 1){
  const p = P[id], l = linea(id), ya = l ? l.n : 0, u = p.unit === "kg" ? " kg" : "";
  if (p.stock <= 0) return hint(p.name + ": agotado.", 1, { tipo: "Hay producto, pero el sistema dice agotado", prod: p.name + " (" + p.bar + ")" });
  if (q3(ya + n) > p.stock) return hint("Solo quedan " + p.stock + u + " de " + p.name + ".", 1);
  if (l) l.n = q3(l.n + n); else lines.push({ id, n });
  sel = id; hint(n + u + " × " + p.name + " agregado." + promoTip(id)); render();
}

/* Código de barras / SKU */
$("scan").onsubmit = e => {
  e.preventDefault();
  let t = $("code").value.trim(); if (!t) return;
  let n = 1; const m = t.match(/^(\d+(?:\.\d+)?)\*(.+)$/); if (m && +m[1] > 0){ n = +m[1]; t = m[2]; }
  const p = P.find(p => p.bar === t);
  if (p){ agregar(p.id, n); $("code").value = ""; }
  else if (/^\d+$/.test(t)) hint("El código " + t + " no existe.", 1, { tipo: "Código no encontrado", prod: t });
  else abrirBuscar(t);
};

/* Buscar por nombre */
function listarB(){
  const t = $("bq").value.trim().toLowerCase();
  const r = P.filter(p => !t || p.name.toLowerCase().includes(t) || p.bar.startsWith(t));
  $("res").innerHTML = r.map(p => `<button data-id="${p.id}" ${p.stock <= 0 ? "disabled" : ""}><span>${p.name}<small>${p.bar} · ${p.stock <= 0 ? "Agotado" : p.stock <= 5 ? "Últimas " + p.stock : "En existencia"}${PROMOS.some(x => vigente(x) && x.ids.includes(p.id)) ? " · Promo" : ""}</small></span><strong>${money(p.price)}${p.unit === "kg" ? "/kg" : ""}</strong></button>`).join("") || '<p class="empty" style="padding:24px 0">Sin resultados.</p>';
}
function abrirBuscar(txt){ $("bq").value = txt \vert{}\vert{} ""; listarB(); $("dB").showModal(); $("bq").focus(); $("bq").select(); }
$("bBuscar").onclick = () => abrirBuscar($("code").value.trim());
$("bq").oninput = listarB;
$("bq").onkeydown = e => { if (e.key === "Enter"){ const b = $("res").querySelector("button:not(:disabled)"); if (b) b.click(); } };
$("res").onclick = e => { const b = e.target.closest("[data-id]"); if (b){ agregar(+b.dataset.id); $("code").value = ""; $("dB").close(); } };
$("bCerrarB").onclick = () => $("dB").close();

/* Ticket: seleccionar, + / − */
$("rows").onclick = e => {
  const r = e.target.closest(".row"); if (!r) return;
  const id = +r.dataset.id, b = e.target.closest("[data-d]");
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
function pedirEliminar(id){ porEliminar = id; $("eNom").textContent = P[id].name; $("dE").showModal(); $("eSi").focus(); }
$("eNo").onclick = () => { $("dE").close(); $("code").focus(); };
$("eSi").onclick = () => { lines = lines.filter(x => x.id !== porEliminar); sel = null; hint(P[porEliminar].name + " eliminado del ticket."); $("dE").close(); render(); $("code").focus(); };

/* Opciones */
$("bBorrar").onclick = () => borrar();
function borrar(){
  if (sel === null) return hint("Toca un artículo del ticket para seleccionarlo.", 1);
  const p = P[sel]; lines = lines.filter(l => l.id !== sel); sel = null;
  hint(p.name + " borrado del ticket."); render(); $("code").focus();
}
$("bCancel").onclick = () => cancelar();
function cancelar(){
  if (!lines.length) return;
  if (!confirma){
    $("bCancel").firstChild.textContent = "¿Seguro? Toca otra vez";
    confirma = setTimeout(restablecer, 3000); return;
  }
  lines = []; sel = null; promosSel = new Set(); hint("Venta cancelada."); restablecer(); render(); $("code").focus();
}
function restablecer(){ clearTimeout(confirma); confirma = null; $("bCancel").firstChild.textContent = "Cancelar venta"; }

/* Cantidad editable */
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

/* Venta en espera */
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
    const { t: tot, n: art } = sums(w.lines, w.promos);
    return `<div><span>Espera #${w.n}<small>${w.hora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · ${art} artículos · ${money(tot)}</small></span><button data-r="${i}">Recuperar</button><button data-q="${i}">Descartar</button></div>`; }).join("");
  if (!$("dW").open) $("dW").showModal();
}
function recuperar(i){
  const w = espera[i]; espera.splice(i, 1);
  if (lines.length) espera.push({ n: ++nEspera, hora: new Date(), lines, promos: new Set(promosSel) });
  let ajustado = false;
  lines = w.lines.map(l => { const mx = P[l.id].stock; if (l.n > mx){ ajustado = true; l.n = mx; } return l; }).filter(l => l.n > 0);
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

/* Cobrar: ventana de pago (pago mixto) */
let pagos = [], uid = null, enCurso = false;
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
  restablecer(); pagos = []; method = "Efectivo"; enCurso = false;
  uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
$("bVolver").onclick = () => { $("dP").close(); $("code").focus(); };

/* Cerrar compra */
$("bCerrar").onclick = () => {
  if (enCurso) return;
  const e = estadoPago(); if (!e.ok) return;
  enCurso = true; $("bCerrar").disabled = true;
  const { t, iva, n, desc, d } = sums();
  let tk = `TIENDA\nTicket #${String(folio).padStart(4, "0")}\n${new Date().toLocaleString("es-MX")}\nAtendió: cobrador\nCaja ${turno.caja} · Turno ${hhmm(turno.inicio)}\n--------------------------\n`;
  lines.forEach(l => { const p = P[l.id]; p.stock = q3(p.stock - l.n); tk += `${cant(l)} x ${p.name}\n   ${money(r2(p.price * l.n))}\n`; if (d[l.id]) tk += `   Promoción: -${money(d[l.id])}\n`; });
  tk += `--------------------------\nArtículos: ${n}\n${desc ? "Ahorro por promociones: " + money(desc) + "\n" : ""}IVA incluido: ${money(iva)}\nTOTAL: ${money(t)}\n`;
  e.todos.forEach(p => tk += `${p.m}: ${money(p.monto)}\n`);
  if (e.cambio > 0) tk += `Cambio: ${money(e.cambio)}\n`;
  $("tk").textContent = tk + "\n¡Gracias por su compra!";
  turno.tickets++; turno.articulos += n; turno.venta = r2(turno.venta + t); turno.efectivo = r2(turno.efectivo + e.ef - e.cambio); revisarAviso();
  folio++; $("dP").close(); $("dT").showModal(); $("bNueva").focus();
};
$("bNueva").onclick = () => { enCurso = false; pagos = []; $("dT").close(); lines = []; sel = null; promosSel = new Set(); hint("Venta cerrada. Lista para la siguiente."); render(); $("code").focus(); };
$("dT").addEventListener("cancel", e => e.preventDefault());

/* Atajos de teclado */
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

/* Promociones */
const pid = n => P.find(p => p.name.startsWith(n)).id;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const PROMOS = [
  { nom: "2x1 en cervezas", tipo: "nxm", n: 2, m: 1, ids: [pid("Cerveza Corona"), pid("Cerveza Victoria")], etiqueta: "2x1", vigencia: "Del 1 al 31 de octubre" },
  { nom: "3x2 en Galletas Marías Gamesa", tipo: "nxm", n: 3, m: 2, ids: [pid("Galletas Marías")], etiqueta: "3x2", vigencia: "Hasta agotar existencias" },
  { nom: "15% en Detergente Ariel 850 g", tipo: "pct", pct: 15, ids: [pid("Detergente Ariel")], etiqueta: "−15%", vigencia: "Del 5 al 18 de octubre" },
  { nom: "Martes de lácteos: 20% en Leche Lala", tipo: "pct", pct: 20, ids: [pid("Leche Lala")], etiqueta: "−20%", vigencia: "Todos los martes", dias: [2] }
];
const vigente = pr => !pr.dias || pr.dias.includes(new Date().getDay());
const regla = pr => pr.tipo === "nxm" ? "Lleva " + pr.n + " y paga " + pr.m : pr.pct + "% de descuento";
function promoTip(id){
  const ix = PROMOS.findIndex(x => vigente(x) && x.ids.includes(id)); if (ix < 0) return "";
  const pr = PROMOS[ix];
  if (!promosSel.has(ix)) return " Hay promoción " + pr.etiqueta + " disponible: ábrela con F3.";
  if (pr.tipo === "pct") return " Promo " + pr.etiqueta + " aplicada.";
  const u = lines.filter(l => pr.ids.includes(l.id)).reduce((a, l) => a + l.n, 0), falta = (pr.n - u % pr.n) % pr.n;
  return falta ? " Promo " + pr.etiqueta + ": agrega " + falta + " más para activarla." : " Promo " + pr.etiqueta + " aplicada.";
}
function pintarPromos(){
  const card = ix => {
    const pr = PROMOS[ix], act = vigente(pr), on = promosSel.has(ix), ahorro = sums(lines, new Set([ix])).desc;
    const u = lines.filter(l => pr.ids.includes(l.id)).reduce((a, l) => a + l.n, 0);
    const estado = !act ? "Disponible: " + pr.dias.map(x => DIAS[x]).join(", ")
      : !on ? "Toca para aplicarla"
      : ahorro > 0 ? "✓ Aplicada · ahorras " + money(ahorro)
      : pr.tipo === "nxm" && u ? "✓ Seleccionada · agrega " + (pr.n - u) + " más para activarla" : "✓ Seleccionada 
