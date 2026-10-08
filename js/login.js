import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, sesionActual, irAInicio } from "./firebase.js";

const $ = id => document.getElementById(id);

// Si ya había iniciado sesión, lo manda a su pantalla según su rol
sesionActual().then(s => { if (s && s.perfil && s.perfil.activo === true) irAInicio(s.perfil.rol); });

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

const MENSAJES = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/invalid-email": "El correo no es válido.",
  "auth/user-disabled": "Esta cuenta está desactivada. Habla con tu administrador.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet."
};

$("fl").onsubmit = async e => {
  e.preventDefault();
  const u = $("u").value.trim(), c = $("c").value;
  if (!u) return error("Escribe tu correo.", "u");
  if (!c) return error("Escribe tu contraseña.", "c");
  error("");
  $("enter").disabled = true; $("enter").textContent = "Entrando…";
  try {
    await signInWithEmailAndPassword(auth, u, c);
    const s = await sesionActual();
    if (!s || !s.perfil || s.perfil.activo !== true) {
      await signOut(auth);
      throw { code: "sin-acceso" };
    }
    irAInicio(s.perfil.rol);
  } catch (err) {
    error(err.code === "sin-acceso" ? "Tu usuario no tiene acceso. Habla con el dueño." : (MENSAJES[err.code] || "No se pudo iniciar sesión. Inténtalo de nuevo."));
    $("enter").disabled = false; $("enter").textContent = "Entrar";
  }
};
