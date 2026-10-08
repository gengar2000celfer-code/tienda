import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeT6mpizgzZ2jmgwKLkv7H40iZGYlLHh8",
  authDomain: "tienda-login-31aa0.firebaseapp.com",
  projectId: "tienda-login-31aa0",
  storageBucket: "tienda-login-31aa0.firebasestorage.app",
  messagingSenderId: "682451581952",
  appId: "1:682451581952:web:32bc895d321abf70f32ce5"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Devuelve { user, perfil } o null si no hay sesión. perfil es null si el usuario no tiene documento en "usuarios".
export function sesionActual() {
  return new Promise(resolve => {
    const off = onAuthStateChanged(auth, async user => {
      off();
      if (!user) return resolve(null);
      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        resolve({ user, perfil: snap.exists() ? snap.data() : null });
      } catch (e) { resolve({ user, perfil: null }); }
    });
  });
}

// Protege una pantalla: exige sesión, usuario activo y rol. Si no cumple, cierra sesión y regresa al login.
export async function requerirRol(...roles) {
  const s = await sesionActual();
  if (!s || !s.perfil || s.perfil.activo !== true || !roles.includes(s.perfil.rol)) {
    await signOut(auth);
    location.href = "index.html";
    return new Promise(() => {});
  }
  return s;
}

export const irAInicio = rol => { location.href = rol === "admin" ? "admin.html" : "ventas.html"; };
export const cerrarSesion = () => signOut(auth).then(() => (location.href = "index.html"));
