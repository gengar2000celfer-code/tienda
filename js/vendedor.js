const $ = id => document.getElementById(id), money = n => "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = n => Math.round(n * 100) / 100, r3 = n => Math.round(n * 1000) / 1000;
const ean = b => { let s = 0; for (let i = 0; i < 12; i++) s += +b[i] * (i % 2 ? 3 : 1); return b + (10 - s % 10) % 10; };
const fh = d => d.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// [nombre, precio, departamento, IVA, código, stock, mínimo, unidad]
const P = [
["Leche Lala Entera 1 L",27.5,"Abarrotes",0,"750102050001",40,10],["Pan Bimbo Blanco Grande 680 g",46,"Abarrotes",0,"750100011120",25,8],
["Huevo San Juan Blanco 12 pzas",52,"Abarrotes",0,"750105530007",3,10],["Arroz Verde Valle 1 kg",32,"Abarrotes",0,"750104009002",30,10],
["Coca-Cola 600 ml",19,"Bebidas",.16,"750105536305",60,24],["Agua Bonafont 1 L",13,"Bebidas",0,"750103131130",80,30],
["Jugo del Valle Naranja 1 L",31,"Bebidas",.16,"750101312704",18,8],["Nescafé Clásico 100 g",74,"Bebidas",.16,"750105927315",0,5],
["Cerveza Corona Extra 355 ml",22,"Cervezas",.16,"750100551122",96,36],["Sabritas Original 45 g",21,"Botanas",.16,"750101111212",50,20],
["Galletas Marías Gamesa 170 g",18,"Botanas",.16,"750100061371",45,15],["Detergente Ariel 850 g",52,"Limpieza",.16,"750102540706",22,8],
["Fibra Scotch-Brite Verde",11,"Limpieza",.16,"750100330820",4,6],["Pasta Dental Colgate Triple Acción 75 ml",36,"Higiene",.16,"750103640008",33,10],
["Huevo suelto (pieza)",5.5,"Abarrotes",0,"1",120,30],["Cigarro Marlboro Rojo suelto",9,"Tabaco",.16,"2",200,60],["Azúcar estándar suelta (kg)",34,"Abarrotes",0,"3",25,10,"kg"]
].map(a => ({ nombre: a[0], precio: a[1], costo: r2(a[1] * .7), depto: a[2], iva: a[3], cod: a[4].length === 12 ? ean(a[4]) : a[4], stock: a[5], min: a[6], unidad: a[7] || "pza", activo: true }));

const prod = c => P.find(p => p.cod === c), deps = () => [...new Set(P.map(p => p.depto))];
const h = n => new Date(Date.now() - n * 3600e3);
const MOV = [
  { f: h(5), cod: P[0].cod, nom: P[0].nombre, tipo: "Entrada por compra", cant: 24, antes: 16, desp: 40, motivo: "Proveedor: Lala" },
  { f: h(3), cod: P[2].cod, nom: P[2].nombre, tipo: "Merma", cant: -2, antes: 5, desp: 3, motivo: "Dañado" },
  { f: h(2), cod: P[7].cod, nom: P[7].nombre, tipo: "Conteo físico", cant: -1, antes: 1, desp: 0, motivo: "Conteo: había 1, se contó 0" }
];
const T = [
  { id: 1, cajero: "Cobrador", caja: "1", inicio: h(6), fondo: 500, ef: 3420.5, tj: 1860, tr: 350, tk: 14, ret: [{ h: h(2), m: 1000, mot: "Depósito a caja fuerte" }], estado: "abierto" },
  { id: 2, cajero: "Cobrador", caja: "1", inicio: h(30), fin: h(22), fondo: 500, ef: 2100, tj: 900, tr: 0, tk: 9, ret: [], estado: "cerrado", contado: 2580, dif: -20, nota: "Faltó cambio de $20" }
];
const esperado = t => r2(t.fondo + t.ef - t.ret.reduce((a, r) => a + r.m, 0));
let sec = "inicio", dep = "Todos", prodSel = null, tipo = "entrada", edit = null, cor = null, elim = null, promoEd = null, promoProds = [];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const cd = n => P.find(p => p.nombre.startsWith(n)).cod;
const etq = p => p.tipo === "nxm" ? p.n + "x" + p.m : "−" + p.pct + "%", regla = p => p.tipo === "nxm" ? "Lleva " + p.n + " y paga " + p.m : p.pct + "% de descuento";
const PROMOS = [
  { id: 1, nom: "2x1 en cervezas", tipo: "nxm", n: 2, m: 1, pct: 0, prods: [cd("Cerveza Corona")], vig: "Del 1 al 31 de octubre", dias: [], activa: true },
  { id: 2, nom: "3x2 en Galletas Marías Gamesa", tipo: "nxm", n: 3, m: 2, pct: 0, prods: [cd("Galletas Marías")], vig: "Hasta agotar existencias", dias: [], activa: true },
  { id: 3, nom: "15% en Detergente Ariel 850 g", tipo: "pct", n: 0, m: 0, pct: 15, prods: [cd("Detergente Ariel")], vig: "Del 5 al 18 de octubre", dias: [], activa: true },
  { id: 4, nom: "Martes de lácteos: 20% en Leche Lala", tipo: "pct", n: 0, m: 0, pct: 20, prods: [cd("Leche Lala")], vig: "Todos los martes", dias: [2], activa: false }
];
const AVISOS = [{ id: 1, f: h(8), txt: "Hoy la tienda cierra a las 8 p. m.", imp: false }, { id: 2, f: h(7), txt: "No recibir billetes de $500 hasta nuevo aviso.", imp: true }];
const REPS = [
  { id: 1, f: h(4), cajero: "Cobrador", tipo: "Código no encontrado", prod: "7501234567895", cod: null, nota: "", estado: "nuevo" },
  { id: 2, f: h(3), cajero: "Cobrador", tipo: "Precio incorrecto", prod: "Coca-Cola 600 ml", cod: cd("Coca-Cola"), nota: "El anaquel marca $18 y aquí sale $19", estado: "nuevo" },
  { id: 3, f: h(30), cajero: "Cobrador", tipo: "Hay producto, pero el sistema dice agotado", prod: "Nescafé Clásico 100 g", cod: cd("Nescafé"), nota: "", estado: "resuelto" }
];
const USERS = [
  { id: 1, nombre: "Dueño", correo: "dueno@tienda.com", rol: "admin", activo: true },
  { id: 2, nombre: "Cobrador", correo: "cobrador@tienda.com", rol: "cobrador", activo: true },
  { id: 3, nombre: "Ana", correo: "ana@tienda.com", rol: "cobrador", activo: false }
];
const u = p => p && p.unidad === "kg" ? " kg" : "";
const mov = (p, t, c, a, d, m) => MOV.unshift({ f: new Date(), cod: p.cod, nom: p.nombre, tipo: t, cant: c, antes: a, desp: d, motivo: m });

const VISTAS = {
  inicio(){
    const bajo = P.filter(p => p.activo && p.stock <= p.min), hoy = T.filter(t => t.inicio.toDateString() === new Date().toDateString());
    const v = hoy.reduce((a, t) => a + t.ef + t.tj + t.tr, 0), tk = hoy.reduce((a, t) => a + t.tk, 0);
    return `<h1>Buenos días, Dueño</h1><p class="sub">${new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} · datos de ejemplo</p>
    <div class="kpis"><div class="kpi" style="background:var(--c1)"><b>${money(v)}</b>Ventas de hoy<small>${tk} tickets</small></div>
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
    ${p ? `<div class="sel"><b>${p.nombre}</b><small style="color:#10292d">Stock actual: <strong>${p.stock}${u(p)}</strong> · mínimo ${p.min}</small></div>` : ""}
    <div class="seg" id="seg"><button data-t="entrada" aria-pressed="${tipo === "entrada"}">Entrada</button><button data-t="merma" aria-pressed="${tipo === "merma"}">Merma</button><button data-t="conteo" aria-pressed="${tipo === "conteo"}">Conteo</button></div>
    <label class="lbl" for="cant">${tipo === "entrada" ? "Cantidad que entró" : tipo === "merma" ? "Cantidad que sale" : "Cantidad contada físicamente"}</label>
    <input id="cant" type="number" min="0" step="${p && p.unidad === "kg" ? "0.001" : "1"}" inputmode="decimal">
    ${tipo === "merma" ? `<label class="lbl" for="mot">Motivo</label><select id="mot"><option>Caducado</option><option>Dañado</option><option>Robo o extravío</option><option>Consumo interno</option><option>Otro</option></select>` : ""}
    <label class="lbl" for="nota">${tipo === "entrada" ? "Proveedor (opcional)" : "Nota"}</label><input id="nota" maxlength="80" autocomplete="off">
    <p class="hint" id="prev"></p><p class="err" id="err"></p><button class="go" id="reg" style="width:100%">Registrar movimiento</button></div>
    <div class="paper"><div class="tabs"><i></i><i></i><i></i><i></i></div><h2>Kardex${p ? " · " + p.nombre : ""}</h2><div id="kdx"></div></div></div>`;
  },
  corte(){
    return `<h1>Corte de caja</h1><p class="sub">Compara lo que debería haber en caja contra lo que cuentas.</p>` + T.map(t => {
      const esp = esperado(t), tr = t.ret.reduce((a, r) => a + r.m, 0);
      return `<div class="paper"><div class="tabs"><i></i><i></i><i></i><i></i></div>
      <div class="k"><span><b>${t.cajero} · Caja ${t.caja}</b><small>${fh(t.inicio)}${t.fin ? " → " + fh(t.fin) : " · en curso"}</small></span><span class="chipe" style="background:${t.estado === "abierto" ? "var(--c1)" : "var(--c4)"}">${t.estado === "abierto" ? "Abierto" : "Cerrado"}</span></div>
      <div class="l"><span>Fondo de caja</span><span>${money(t.fondo)}</span></div><div class="l"><span>Ventas en efectivo</span><span>${money(t.ef)}</span></div>
      <div class="l"><span>Retiros</span><span>−${money(tr)}</span></div>${t.ret.map(r => `<div class="l"><small>${fh(r.h)} · ${r.mot}</small><small>−${money(r.m)}</small></div>`).join("")}
      <div class="l t"><span>Efectivo esperado</span><span>${money(esp)}</span></div>
      <div class="l"><span>Tarjeta</span><span>${money(t.tj)}</span></div><div class="l"><span>Transferencia</span><span>${money(t.tr)}</span></div><div class="l"><span>Tickets</span><span>${t.tk}</span></div>
      ${t.estado === "cerrado" ? `<div class="l"><span>Efectivo contado</span><span>${money(t.contado)}</span></div><div class="l t"><span>Diferencia</span><span class="${t.dif < 0 ? "bad" : t.dif > 0 ? "ok" : ""}">${t.dif === 0 ? "Cuadra" : (t.dif > 0 ? "Sobrante " : "Faltante ") + money(Math.abs(t.dif))}</span></div>${t.nota ? `<small>${t.nota}</small>` : ""}` : `<button class="go" data-c="${t.id}" style="width:100%;margin-top:12px">Hacer corte</button>`}</div>`; }).join("");
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
    + USERS.map(us => `<div class="r${us.activo ? "" : " off"}" style="grid-template-columns:1fr auto auto"><span><b>${us.nombre}</b><small>${us.correo}${us.activo ? "" : " · Desactivado"}</small></span><span class="chipe" style="background:${us.rol === "admin" ? "var(--c3)" : "var(--c4)"}">${us.rol === "admin" ? "Dueño" : "Cobrador"}</span><span class="ac">${us.id === 1 ? "<small>Tú</small>" : `<button data-ua="${us.id}">${us.activo ? "Desactivar" : "Activar"}</button>`}</span></div>`).join("")
    + '<p class="hint">Un usuario desactivado ya no puede iniciar sesión, pero conserva su historial de ventas.</p>';
  }
};

/* ---------- Render ---------- */
function render(){
  document.querySelectorAll("#nav [data-s]").forEach(b => b.toggleAttribute("aria-current", b.dataset.s === sec) || b.removeAttribute("aria-current"));
  document.querySelectorAll("#nav [data-s]").forEach(b => { if (b.dataset.s === sec) b.setAttribute("aria-current", "page"); });
  $("nRep").textContent = REPS.filter(r => r.estado === "nuevo").length || "";
  $("main").innerHTML = VISTAS[sec]();
  if (sec === "productos"){ chips(); listar(); }
  if (sec === "inventario"){ kardex(); vista(); }
}
function chips(){ $("chips").innerHTML = ["Todos", ...deps()].map(d => `<button class="chip" data-d="${d}" aria-pressed="${d === dep}">${d}</button>`).join(""); }
function listar(){
  const t = ($("q").value || "").trim().toLowerCase();
  const r = P.filter(p => (dep === "Todos" || p.depto === dep) && (!t || p.nombre.toLowerCase().includes(t) || p.cod.startsWith(t)));
  $("plist").innerHTML = r.map(p => { const base = p.precio / (1 + p.iva), mg = Math.round((base - p.costo) / base * 100);
    return `<div class="r${p.activo ? "" : " off"}"><span><b>${p.nombre}</b><small>${p.cod} · ${p.depto} · ${p.unidad === "kg" ? "por kilo" : "por pieza"}${p.iva ? "" : " · IVA 0%"}${p.activo ? "" : " · De baja"}</small></span>
    <span class="pr">${money(p.precio)}</span><span class="hm">${money(p.costo)}<small>margen ${mg}%</small></span>
    <span class="${p.stock <= p.min ? "bad" : ""}">${p.stock}${u(p)}<small>mín. ${p.min}</small></span>
    <span class="ac"><button data-e="${p.cod}">Editar</button><button data-b="${p.cod}">${p.activo ? "Dar de baja" : "Reactivar"}</button><button class="del" data-x="${p.cod}">Eliminar</button></span></div>`; }).join("") || '<div class="card">Sin resultados.</div>';
}
function kardex(){
  const r = MOV.filter(m => !prodSel || m.cod === prodSel).slice(0, 20);
  $("kdx").innerHTML = r.map(m => `<div class="k"><span>${m.nom}<small>${fh(m.f)} · ${m.tipo} · ${m.motivo}</small></span><span class="${m.cant > 0 ? "ok" : "bad"}">${m.cant > 0 ? "+" : ""}${m.cant}<small>${m.antes} → ${m.desp}</small></span></div>`).join("") || "Sin movimientos.";
}

/* ---------- Inventario ---------- */
function vista(){
  const p = prodSel ? prod(prodSel) : null, c = parseFloat(($("cant") || {}).value);
  if (!p || isNaN(c)) return ($("prev").textContent = "");
  const n = tipo === "entrada" ? p.stock + c : tipo === "merma" ? p.stock - c : c;
  $("prev").textContent = "El stock quedará en " + r3(n) + u(p) + ".";
}
function registrar(){
  const p = prodSel ? prod(prodSel) : null, c = parseFloat($("cant").value), nota = $("nota").value.trim(), err = m => ($("err").textContent = m);
  if (!p) return err("Elige un producto.");
  if (isNaN(c) || c < 0 || (tipo !== "conteo" && c === 0)) return err("Escribe una cantidad válida.");
  if (p.unidad !== "kg" && !Number.isInteger(c)) return err("Este producto se cuenta por pieza: usa un número entero.");
  let nuevo, t, m;
  if (tipo === "entrada"){ nuevo = r3(p.stock + c); t = "Entrada por compra"; m = nota ? "Proveedor: " + nota : "Compra"; }
  else if (tipo === "merma"){
    const mo = $("mot").value; if (c > p.stock) return err("No puedes sacar más de lo que hay (" + p.stock + ").");
    if (mo === "Otro" && nota.length < 5) return err("Explica el motivo en la nota (mínimo 5 letras).");
    nuevo = r3(p.stock - c); t = "Merma"; m = mo === "Otro" ? "Otro: " + nota : mo + (nota ? " · " + nota : "");
  } else {
    if (c === p.stock) return err("El conteo coincide con el sistema: no hace falta ajustar.");
    nuevo = c; t = "Conteo físico"; m = "Conteo: había " + p.stock + ", se contó " + c + (nota ? " · " + nota : "");
  }
  const antes = p.stock; p.stock = nuevo; mov(p, t, r3(nuevo - antes), antes, nuevo, m);
  render(); $("prev").textContent = "Movimiento registrado. Stock actual: " + nuevo + u(p) + "."; $("prev").style.color = "var(--ok)";
}
/* ---------- Productos: alta, edición y baja ---------- */
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
$("pOk").onclick = () => {
  const cod = $("pCod").value.trim(), nombre = $("pNom").value.trim(), depto = $("pDep").value.trim(), unidad = $("pUni").value;
  const precio = parseFloat($("pPre").value), costo = parseFloat($("pCos").value), iva = parseFloat($("pIva").value), min = parseFloat($("pMin").value) \vert{}\vert{} 0, stock = parseFloat($("pStk").value) || 0;
  const e = m => ($("pErr").textContent = m);
  if (!/^\d+$/.test(cod)) return e("El código de barras solo lleva números.");
  if (!edit && prod(cod)) return e("Ese código ya existe: " + prod(cod).nombre + ".");
  if (nombre.length < 3) return e("Escribe el nombre del producto.");
  if (!depto) return e("Elige o escribe un departamento.");
  if (!(precio > 0)) return e("El precio debe ser mayor a cero.");
  if (isNaN(costo) || costo < 0) return e("Escribe el costo (puede ser 0).");
  if (!edit && unidad === "pza" && !Number.isInteger(stock)) return e("Las existencias por pieza deben ser un número entero.");
  if (edit) Object.assign(prod(edit), { nombre, depto, unidad, precio, costo, iva, min });
  else { const p = { cod, nombre, depto, unidad, precio, costo, iva, min, stock, activo: true }; P.push(p); if (stock > 0) mov(p, "Inventario inicial", stock, 0, stock, "Alta del producto"); }
  $("dProd").close(); render();
};

/* ---------- Corte de caja ---------- */
function abrirCorte(id){
  cor = T.find(t => t.id === id); const tr = cor.ret.reduce((a, r) => a + r.m, 0);
  $("cInfo").innerHTML = `<small>${cor.cajero} · Caja ${cor.caja} · desde ${fh(cor.inicio)}</small><div class="l"><span>Fondo + ventas en efectivo</span><span>${money(cor.fondo + cor.ef)}</span></div><div class="l"><span>Retiros</span><span>−${money(tr)}</span></div><div class="l t"><span>Efectivo esperado</span><span>${money(esperado(cor))}</span></div>`;
  $("cCont").value = ""; $("cNota").value = ""; $("cDif").textContent = ""; $("cErr").textContent = ""; $("dCorte").showModal(); $("cCont").focus();
}
function difCorte(){
  const v = parseFloat($("cCont").value); if (isNaN(v)) return ($("cDif").textContent = "");
  const d = r2(v - esperado(cor)); $("cDif").textContent = d === 0 ? "Cuadra exacto." : (d > 0 ? "Sobrante " : "Faltante ") + money(Math.abs(d)); $("cDif").style.color = d === 0 ? "var(--ok)" : "var(--bad)";
}
$("cCont").oninput = difCorte; $("cNo").onclick = () => $("dCorte").close();
$("cOk").onclick = () => {
  const v = parseFloat($("cCont").value), nota = $("cNota").value.trim();
  if (isNaN(v) || v < 0) return ($("cErr").textContent = "Escribe el efectivo que contaste.");
  const d = r2(v - esperado(cor)); if (d !== 0 && nota.length < 5) return ($("cErr").textContent = "Hay diferencia: explica qué pasó en la nota.");
  Object.assign(cor, { estado: "cerrado", fin: new Date(), contado: v, dif: d, nota }); $("dCorte").close(); render();
};

/* ---------- Confirmar eliminación ---------- */
function confirmar(titulo, texto, fn){ elim = fn; $("elT").textContent = titulo; $("elP").innerHTML = texto; $("dEl").showModal(); }
$("elNo").onclick = () => $("dEl").close();
$("elSi").onclick = () => { $("dEl").close(); if (elim) elim(); elim = null; };
function eliminarProd(cod){
  const p = prod(cod);
  confirmar("¿Seguro que quieres eliminar este producto?", `<b>${p.nombre}</b><br>${p.stock > 0 ? `<span class="bad">Todavía tiene ${p.stock}${u(p)} en existencia; ese inventario se perderá.</span><br>` : ""}Esta acción no se puede deshacer. Las ventas anteriores conservan su nombre y precio. Si solo quieres dejar de venderlo, mejor usa «Dar de baja».`,
    () => { P.splice(P.indexOf(p), 1); PROMOS.forEach(x => x.prods = x.prods.filter(c => c !== cod)); if (prodSel === cod) prodSel = null; render(); });
}

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
$("prOk").onclick = () => {
  const nom = $("prNom").value.trim(), tp = $("prTipo").value, n = parseInt($("prN").value), m = parseInt($("prM").value), pct = parseFloat($("prPct").value), e = x => ($("prErr").textContent = x);
  if (nom.length < 3) return e("Ponle un nombre a la promoción.");
  if (!promoProds.length) return e("Agrega al menos un producto.");
  if (tp === "nxm" && !(n >= 2 && m >= 1 && m < n)) return e("«Lleva» debe ser mayor que «Paga» (por ejemplo lleva 2, paga 1).");
  if (tp === "pct" && !(pct > 0 && pct <= 90)) return e("El descuento debe estar entre 1 y 90 %.");
  const dat = { nom, tipo: tp, n: tp === "nxm" ? n : 0, m: tp === "nxm" ? m : 0, pct: tp === "pct" ? pct : 0, prods: [...promoProds], vig: $("prVig").value.trim(), dias: [...document.querySelectorAll("#prDias input:checked")].map(i => +i.value) };
  if (promoEd) Object.assign(PROMOS.find(x => x.id === promoEd), dat); else PROMOS.push({ id: Date.now(), activa: true, ...dat });
  $("dPromo").close(); render();
};

/* ---------- Avisos ---------- */
function publicar(){
  const t = $("avT").value.trim(); if (t.length < 5) return ($("avE").textContent = "Escribe el aviso (mínimo 5 letras).");
  AVISOS.unshift({ id: Date.now(), f: new Date(), txt: t, imp: $("avI").checked }); render();
}

/* ---------- Usuarios ---------- */
$("uNo").onclick = () => $("dUser").close();
$("uOk").onclick = () => {
  const nombre = $("uNom").value.trim(), correo = $("uCor").value.trim().toLowerCase(), rol = $("uRol").value, pas = $("uPas").value, e = x => ($("uErr").textContent = x);
  if (nombre.length < 2) return e("Escribe el nombre.");
  if (!/^\S+@\S+\.\S+$/.test(correo)) return e("Escribe un correo válido.");
  if (USERS.some(x => x.correo === correo)) return e("Ya existe un usuario con ese correo.");
  if (pas.length < 6) return e("La contraseña temporal necesita mínimo 6 caracteres.");
  USERS.push({ id: Date.now(), nombre, correo, rol, activo: true }); $("dUser").close(); render();
};

/* ---------- Eventos ---------- */
document.addEventListener("click", e => {
  const g = s => e.target.closest(s);
  if (g("[data-s]")){ sec = g("[data-s]").dataset.s; render(); }
  else if (g("[data-aj]")){ prodSel = g("[data-aj]").dataset.aj; sec = "inventario"; tipo = "entrada"; render(); }
  else if (g("#nuevo")) abrirProd();
  else if (g("[data-e]")) abrirProd(g("[data-e]").dataset.e);
  else if (g("[data-b]")){ const p = prod(g("[data-b]").dataset.b); p.activo = !p.activo; listar(); }
  else if (g("[data-d]")){ dep = g("[data-d]").dataset.d; chips(); listar(); }
  else if (g("[data-t]")){ tipo = g("[data-t]").dataset.t; render(); }
  else if (g("#reg")) registrar();
  else if (g("[data-c]")) abrirCorte(+g("[data-c]").dataset.c);
  else if (g("[data-x]")) eliminarProd(g("[data-x]").dataset.x);
  else if (g("#nPromo")) abrirPromo();
  else if (g("[data-pe]")) abrirPromo(+g("[data-pe]").dataset.pe);
  else if (g("[data-pa]")){ const p = PROMOS.find(x => x.id === +g("[data-pa]").dataset.pa); p.activa = !p.activa; render(); }
  else if (g("[data-pd]")){ const p = PROMOS.find(x => x.id === +g("[data-pd]").dataset.pd); confirmar("¿Seguro que quieres eliminar esta promoción?", `<b>${p.nom}</b><br>Dejará de aparecer en la caja. Si solo quieres detenerla un tiempo, mejor usa «Pausar».`, () => { PROMOS.splice(PROMOS.indexOf(p), 1); render(); }); }
  else if (g("#avP")) publicar();
  else if (g("[data-ad]")){ const a = AVISOS.find(x => x.id === +g("[data-ad]").dataset.ad); confirmar("¿Seguro que quieres eliminar este aviso?", `<b>${a.txt}</b>`, () => { AVISOS.splice(AVISOS.indexOf(a), 1); render(); }); }
  else if (g("[data-rr]")){ REPS.find(r => r.id === +g("[data-rr]").dataset.rr).estado = "resuelto"; render(); }
  else if (g("[data-rn]")){ const r = REPS.find(x => x.id === +g("[data-rn]").dataset.rn); abrirProd(); $("pCod").value = r.prod; }
  else if (g("#nUser")){ ["uNom", "uCor", "uPas", "uErr"].forEach(i => { $(i).value = ""; $(i).textContent = ""; }); $("uRol").value = "cobrador"; $("dUser").showModal(); $("uNom").focus(); }
  else if (g("[data-ua]")){ const x = USERS.find(y => y.id === +g("[data-ua]").dataset.ua); x.activo = !x.activo; render(); }
});
document.addEventListener("input", e => { if (e.target.id === "q") listar(); if (e.target.id === "cant") vista(); });
document.addEventListener("change", e => {
  if (e.target.id !== "iprod") return;
  const t = e.target.value.trim().toLowerCase(), p = P.find(x => x.cod === t || x.nombre.toLowerCase() === t) || P.filter(x => x.nombre.toLowerCase().includes(t))[0];
  prodSel = p && t ? p.cod : null; render();
});
$("salir").onclick = () => alert("Aquí se cerrará la sesión y volverás al inicio de sesión.");
render();
