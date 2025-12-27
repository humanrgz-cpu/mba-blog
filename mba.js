// ===== Firebase Setup =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

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

window.__currentRole = null;

// ===== Role Helpers =====
async function getRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().role : "normal";
}

async function addOrUpdateUser(currentRole, email, password, role) {
  if (currentRole === "normal") return { ok: false, msg: "Not allowed." };
  if (currentRole === "admin" && role !== "normal") return { ok: false, msg: "Admin can only add/update Normal." };
  if (role === "master" && currentRole !== "master") return { ok: false, msg: "Only Master can create Master." };

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;
    await setDoc(doc(db, "users", uid), { role });
    await setDoc(doc(db, "emails", email), { uid });
    return { ok: true, msg: "User added/updated." };
  } catch (err) {
    console.error(err);
    return { ok: false, msg: "Error adding/updating user." };
  }
}

async function removeUser(currentRole, email) {
  if (currentRole === "admin") return { ok: false, msg: "Admin can only remove Normal." };

  const emailDoc = await getDoc(doc(db, "emails", email));
  if (!emailDoc.exists()) return { ok: false, msg: "User not found." };

  const uid = emailDoc.data().uid;
  const roleSnap = await getDoc(doc(db, "users", uid));
  if (roleSnap.exists() && roleSnap.data().role === "master") {
    return { ok: false, msg: "Cannot remove Master." };
  }

  await deleteDoc(doc(db, "users", uid));
  await deleteDoc(doc(db, "emails", email));
  return { ok: true, msg: "User removed." };
}

// ===== UI Helpers =====
function showAppForRole(role, email) {
  window.__currentRole = role;
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appContent").style.display = "block";
  document.getElementById("searchArea").style.display = "block";
  document.getElementById("logoutBtn").style.display = "inline-block";

  const greetEl = document.getElementById("greeting");
  if (greetEl) greetEl.textContent = "Hello Dear " + (email || "");
}

function hideApp() {
  window.__currentRole = null;
  document.getElementById("loginScreen").style.display = "inline-flex";
  document.getElementById("appContent").style.display = "none";
  document.getElementById("searchArea").style.display = "none";
  document.getElementById("logoutBtn").style.display = "none";
  const greetEl = document.getElementById("greeting");
  if (greetEl) greetEl.textContent = "";
}

// ===== Q&A Helpers =====
function loadQAData() {
  try { return JSON.parse(localStorage.getItem("qaData")) || []; }
  catch { return []; }
}
function saveQAData(data) {
  localStorage.setItem("qaData", JSON.stringify(data));
}
function escapeHTML(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function addToLog(entry) {
  const list = document.getElementById("changeLog");
  if (!list) return;
  const li = document.createElement("li");
  li.setAttribute("data-id", entry.id);
  li.textContent = `[${entry.category}] ${entry.question}`;
  list.appendChild(li);
}

// ===== Main Initializer =====
let __qaBound = false;
function initApp() {
  if (__qaBound) return;
  __qaBound = true;

  const container = document.querySelector(".container");
  if (!container) return;

  // Expand/Collapse
  container.addEventListener("click", e => {
    if (e.target.closest(".expand-section")) {
      e.target.closest("details")?.querySelectorAll(".qa > details").forEach(d => d.open = true);
    }
    if (e.target.closest(".collapse-section")) {
      e.target.closest("details")?.querySelectorAll(".qa > details").forEach(d => d.open = false);
    }
  });

  // Edit/Delete/Play
  container.addEventListener("click", e => {
    const editBtn = e.target.closest(".editQA");
    const delBtn = e.target.closest(".deleteQA");
    const playBtn = e.target.closest(".playQA");

    if (editBtn) {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const item = editBtn.closest("details");
      const qEl = item.querySelector(".summary-text");
      const aEl = item.querySelector(".answer");
      const newQ = prompt("Edit question:", qEl.textContent.trim());
      if (newQ == null) return;
      const newA = prompt("Edit answer:", aEl.textContent.trim());
      if (newA == null) return;
      qEl.textContent = newQ;
      aEl.textContent = newA;
      const id = item.getAttribute("data-id");
      saveQAData(loadQAData().map(d => String(d.id) === String(id) ? { ...d, question:newQ, answer:newA } : d));
    }

    if (delBtn) {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const item = delBtn.closest("details");
      const id = item.getAttribute("data-id");
      item.remove();
      saveQAData(loadQAData().filter(d => String(d.id) !== String(id)));
    }

    if (playBtn) {
      const item = playBtn.closest("details");
      const q = item.querySelector(".summary-text").textContent.trim();
      const a = item.querySelector(".answer").textContent.trim();
      speechSynthesis.speak(new SpeechSynthesisUtterance(q));
      speechSynthesis.speak(new SpeechSynthesisUtterance(a));
    }
  });

  // Search
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  if (searchInput && searchResults) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase().trim();
      searchResults.innerHTML = "";
      if (!term) return;
      loadQAData().filter(d =>
        d.question.toLowerCase().includes(term) || d.answer.toLowerCase().includes(term)
      ).forEach(d => {
        const div = document.createElement("div");
        div.textContent = d.question;
        div.onclick = () => {
          const qaItem = document.querySelector(`details[data-id='${CSS.escape(d.id)}']`);
          qaItem?.scrollIntoView({ behavior:"smooth", block:"center" });
        };
        searchResults.appendChild(div);
      });
    });
  }

  // Print
  const printBtn = document.getElementById("printDoc");
  if (printBtn) {
    printBtn.onclick = () => {
      document.querySelectorAll(".container > details").forEach(sec => {
        sec.open = true;
        sec.querySelectorAll(".qa > details").forEach(d => d.open = true);
      });
     
