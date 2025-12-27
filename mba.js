<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
  import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
  import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1m80OnKDqLHrOyIMD3at1CblFfvh64X8",
  authDomain: "mba-qa-46f51.firebaseapp.com",
  projectId: "mba-qa-46f51",
  storageBucket: "mba-qa-46f51.firebasestorage.app",
  messagingSenderId: "554345717376",
  appId: "1:554345717376:web:907bb2ae83e891a36ed065"
};

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Login button handler
  document.getElementById('loginBtn').onclick = async () => {
    const email = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // 🔎 Get role from Firestore
      const snap = await getDoc(doc(db, "users", uid));
      const role = snap.exists() ? snap.data().role : "normal";
      window.__currentRole = role;

      // Show app content
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appContent').style.display = 'block';
      document.getElementById('searchArea').style.display = 'block';

      // Role‑based UI toggles
      if (role !== 'normal') {
        document.getElementById('toggleInputs').style.display = 'inline-block';
      }
      if (role === 'master' || role === 'admin') {
        document.getElementById('manageUsersToggle').style.display = 'inline-block';
      }

      // Greeting
      const greetEl = document.getElementById('greeting');
      if (greetEl) {
        greetEl.textContent = `Hello Dear ${email}`;
      }

      initApp();
    } catch (err) {
      document.getElementById('loginMessage').textContent = 'Invalid email or password.';
      console.error(err);
    }
  };

  // Logout button handler
  document.getElementById('logoutBtn').onclick = async () => {
    await signOut(auth);
    window.__currentRole = null;
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('appContent').style.display = 'none';
    document.getElementById('searchArea').style.display = 'none';
    document.getElementById('greeting').textContent = '';
  };

  // Auto‑check login state
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid));
      const role = snap.exists() ? snap.data().role : "normal";
      window.__currentRole = role;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appContent').style.display = 'block';
    } else {
      window.__currentRole = null;
      document.getElementById('loginScreen').style.display = 'block';
      document.getElementById('appContent').style.display = 'none';
    }
  });
</script>

document.getElementById('loginBtn').onclick = () => {
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value.trim();
  const role = getRole(u,p);
  if (!role) { document.getElementById('loginMessage').textContent='Invalid username or password.'; return; }

  // Show app
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('appContent').style.display='block';
  document.getElementById('searchArea').style.display='block';
  window.__currentRole = role;

  // Sidebar toggles
  if (role!=='normal') document.getElementById('toggleInputs').style.display='inline-block';
  if (role==='master'||role==='admin') document.getElementById('manageUsersToggle').style.display='inline-block';

  // Set greeting (create target if missing)
  const greetEl = document.getElementById('greeting') || (() => {
    const h = document.querySelector('.container header');
    const pEl = document.createElement('p');
    pEl.id = 'greeting';
    pEl.className = 'small';
    pEl.style.fontWeight = '700';
    pEl.style.color = '#2563eb';
    h?.insertBefore(pEl, h.querySelector('.small')); // place before tip text
    return pEl;
  })();
  greetEl.textContent = 'Hello Dear ' + u;

  initApp();
};





