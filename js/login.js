import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// Agregamos Firestore para poder leer los roles después
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeT6mpizgzZ2jmgwKLkv7H40iZGYlLHh8",
  authDomain: "tienda-login-31aa0.firebaseapp.com",
  projectId: "tienda-login-31aa0",
  storageBucket: "tienda-login-31aa0.firebasestorage.app",
  messagingSenderId: "682451581952",
  appId: "1:682451581952:web:32bc895d321abf70f32ce5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // Exportamos la bd para usarla en todo el sistema

const $ = id => document.getElementById(id);

/* ---------- Compartido por todas las pantallas ---------- */
// Esta función revisa que haya un usuario y, si se le pide, que tenga el rol correcto
export function requerirSesion(rolRequerido, alEntrar) {
  onAuthStateChanged(auth, async (u) => {
    if (!u) {
      location.href = "index.html"; // No hay sesión, pa' fuera
      return;
    }
    
    // Si la página exige un rol específico (ej. "admin")
    if (rolRequerido) {
      try {
        const docRef = doc(db, "usuarios", u.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const rolUsuario = docSnap.data().rol;
          if (rolUsuario !== rolRequerido) {
            alert("No tienes permiso para ver esta pantalla.");
            // Lo mandamos a su pantalla correcta
            location.href = rolUsuario === "admin" ? "admin.html" : "vendedor.html";
            return;
          }
        } else {
          // El usuario está autenticado pero no existe en la base de datos
          alert("Usuario no registrado en el sistema.");
          cerrarSesion();
          return;
        }
      } catch (err) {
        console.error("Error al verificar rol:", err);
      }
    }
    
    // Si todo está bien, ejecuta la función de la página
    if (alEntrar) alEntrar(u);
  });
}

export function cerrarSesion() {
  signOut(auth).then(() => (location.href = "index.html"));
}

/* ---------- Pantalla de inicio de sesión ---------- */
if ($("fl")) {
  // Si entra al login y ya tiene sesión, lo mandamos directo a su pantalla
  onAuthStateChanged(auth, async u => { 
    if (u) {
      const docRef = doc(db, "usuarios", u.uid);
      const docSnap = await getDoc(docRef);
      if(docSnap.exists()){
          location.href = docSnap.data().rol === "admin" ? "admin.html" : "vendedor.html";
      }
    } 
  });

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
      // El onAuthStateChanged de arriba detectará el login y hará la redirección basada en el rol
    } catch (err) {
      error(MENSAJES[err.code] || "No se pudo iniciar sesión. Inténtalo de nuevo.");
      $("enter").disabled = false; $("enter").textContent = "Entrar";
    }
  };
}
