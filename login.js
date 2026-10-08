import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeT6mpizgzZ2jmgwKLkv7H40iZGYlLHh8",
  authDomain: "tienda-login-31aa0.firebaseapp.com",
  projectId: "tienda-login-31aa0",
  storageBucket: "tienda-login-31aa0.firebasestorage.app",
  messagingSenderId: "682451581952",
  appId: "1:682451581952:web:32bc895d321abf70f32ce5"
};

const auth = getAuth(initializeApp(firebaseConfig));
const $ = id => document.getElementById(id);

/* ---------- Compartido por todas las pantallas ---------- */
// En ventas.html: import { requerirSesion } from "./js/app.js"; requerirSesion(u => { ... });
export function requerirSesion(alEntrar) {
  onAuthStateChanged(auth, u => u ? alEntrar && alEntrar(u) : (location.href = "index.html"));
}
export function cerrarSesion() {
  signOut(auth).then(() => (location.href = "index.html"));
}

/* ---------- Pantalla de inicio de sesión ---------- */
if ($("fl")) {
  onAuthStateChanged(auth, u => { if (u) location.href = "ventas.html"; });   // ya había entrado

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
      await signInWithEmailAndPassword(auth, u, c);   // al entrar, onAuthStateChanged redirige
    } catch (err) {
      error(MENSAJES[err.code] || "No se pudo iniciar sesión. Inténtalo de nuevo.");
      $("enter").disabled = false; $("enter").textContent = "Entrar";
    }
  };
}
