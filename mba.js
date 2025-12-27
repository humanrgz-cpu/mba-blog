<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
  import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
  import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

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

  // === Replacement helper functions ===

  // Load all users (from Firestore)
  async function loadUsers() {
    const snap = await getDoc(doc(db, "usersDB", "list"));
    return snap.exists() ? snap.data().users : [];
  }

  // Save users (overwrite Firestore list)
  async function saveUsers(users) {
    await setDoc(doc(db, "usersDB", "list"), { users });
  }

  // Get role for a given username/password
  async function getRole(username, password) {
    try {
      const userCred = await signInWithEmailAndPassword(auth, username, password);
      const uid = userCred.user.uid;
      const snap = await getDoc(doc(db, "users", uid));
      return snap.exists() ? snap.data().role : null;
    } catch {
      return null;
    }
  }
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const db = getFirestore(app);

async function getRoleFromFirebase(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().role : "master";
}



  // Add or update a user
  async function addOrUpdateUser(currentRole, username, password, role) {
    if (currentRole === "normal") return { ok: false, msg: "Not allowed." };
    if (currentRole === "admin" && role !== "normal") return { ok: false, msg: "Admin can only add/update Normal." };
    if (role === "master" && currentRole !== "master") return { ok: false, msg: "Only Master can create Master." };

    try {
      // Create Firebase Auth user
      const userCred = await createUserWithEmailAndPassword(auth, username, password);
      const uid = userCred.user.uid;
      // Save role in Firestore
      await setDoc(doc(db, "users", uid), { role });
      return { ok: true, msg: "User added/updated." };
    } catch (err) {
      console.error(err);
      return { ok: false, msg: "Error adding/updating user." };
    }
  }

  // Remove a user
  async function removeUser(currentRole, username) {
    if (currentRole === "admin") return { ok: false, msg: "Admin can only remove Normal." };

    try {
      // Find user by username (you may need to store mapping in Firestore)
      // For simplicity, assume username is email
      const snap = await getDoc(doc(db, "usernames", username));
      if (!snap.exists()) return { ok: false, msg: "User not found." };

      const uid = snap.data().uid;
      const roleSnap = await getDoc(doc(db, "users", uid));
      if (roleSnap.exists() && roleSnap.data().role === "master") {
        return { ok: false, msg: "Cannot remove Master." };
      }

      await deleteDoc(doc(db, "users", uid));
      return { ok: true, msg: "User removed." };
    } catch (err) {
      console.error(err);
      return { ok: false, msg: "Error removing user." };
    }
  }

  // Expose auth/db globally for later code
  window.__auth = auth;
  window.__db = db;
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










