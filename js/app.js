const $ = id => document.getElementById(id);

/* ---------- Sesión (compartido por todas las pantallas) ---------- */
function usuarioActual() {
  try { return sessionStorage.getItem("pdv_usuario"); } catch (e) { return null; }
}
function guardarSesion(u) {
  try { sessionStorage.setItem("pdv_usuario", u); } catch (e) {}
}
function cerrarSesion() {
  try { sessionStorage.removeItem("pdv_usuario"); } catch (e) {}
  location.href = "index.html";
}
// En ventas.html, productos.html, etc. llama: requerirSesion();
function requerirSesion() {
  if (!usuarioActual()) location.href = "index.html";
}

/* ---------- Pantalla de inicio de sesión ---------- */
if ($("fl")) {
  if (usuarioActual()) location.href = "ventas.html";   // ya había entrado

  $("fecha").textContent = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  $("eye").onclick = () => {
    const ver = $("c").type === "password";
    $("c").type = ver ? "text" : "password";
    $("eye").textContent = ver ? "Ocultar" : "Mostrar";
    $("eye").setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
  };

  const error = (msg, campo) => {
    $("err").textContent = msg;
    ["u", "c"].forEach(i => $(i).setAttribute("aria-invalid", i === campo));
    if (campo) $(campo).focus();
  };

  $("fl").onsubmit = e => {
    e.preventDefault();
    const u = $("u").value.trim(), c = $("c").value;
    if (!u) return error("Escribe tu usuario.", "u");
    if (!c) return error("Escribe tu contraseña.", "c");
    error("");
    // Aquí después se validará con la base de datos. Por ahora entra cualquier dato.
    $("enter").disabled = true; $("enter").textContent = "Entrando…";
    setTimeout(() => { guardarSesion(u); location.href = "ventas.html"; }, 500);
  };

  $("olv").onclick = () => error("Pide a tu administrador que restablezca tu contraseña.");
}
