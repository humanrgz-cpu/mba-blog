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

// Your Firebase config
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

    // Write email -> uid mapping so removeUser can find the account
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

  const loginScreen = document.getElementById("loginScreen");
  const appContent = document.getElementById("appContent");
  const searchArea = document.getElementById("searchArea");

  if (loginScreen) loginScreen.style.display = "none";
  if (appContent) appContent.style.display = "block";
  if (searchArea) searchArea.style.display = "block";

  const toggleInputs = document.getElementById("toggleInputs");
  const manageUsersToggle = document.getElementById("manageUsersToggle");

  if (toggleInputs && role !== "normal") toggleInputs.style.display = "inline-block";
  if (manageUsersToggle && (role === "master" || role === "admin")) manageUsersToggle.style.display = "inline-block";

  const greetEl = document.getElementById("greeting");
  if (greetEl) greetEl.textContent = "Hello Dear " + (email || "");
}

function hideApp() {
  window.__currentRole = null;
  const loginScreen = document.getElementById("loginScreen");
  const appContent = document.getElementById("appContent");
  const searchArea = document.getElementById("searchArea");
  const greetEl = document.getElementById("greeting");

  if (loginScreen) loginScreen.style.display = "block";
  if (appContent) appContent.style.display = "none";
  if (searchArea) searchArea.style.display = "none";
  if (greetEl) greetEl.textContent = "";
}

// ===== Q&A Helpers (module scope) =====
function loadQAData() {
  try { return JSON.parse(localStorage.getItem("qaData")) || []; }
  catch { return []; }
}
function saveQAData(data) {
  localStorage.setItem("qaData", JSON.stringify(data));
}
function escapeHTML(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function ensureSection(category) {
  const container = document.querySelector(".container");
  if (!container) return null;

  let section = Array.from(container.querySelectorAll(":scope > details.category"))
    .find(d => d.querySelector(":scope > summary")?.textContent.trim() === category.trim());

  if (!section) {
    section = document.createElement("details");
    section.className = "category";
    section.setAttribute("data-category", category);
    section.innerHTML = `
      <summary>${escapeHTML(category)}</summary>
      <div class="section-toolbar">
        <button class="expand-section">Expand</button>
        <button class="collapse-section">Collapse</button>
        <button class="readCatQuestion">Read Random Question</button>
        <button class="readCatAnswer">Read Answer</button>
      </div>
      <div class="qa"></div>`;
    container.appendChild(section);
  }
  return section;
}
function insertQA(category, question, answer, id) {
  const section = ensureSection(category);
  if (!section) return;
  const qaBlock = section.querySelector(":scope > .qa");
  const item = document.createElement("details");
  item.setAttribute("data-id", String(id));
  item.innerHTML = `
    <summary>
      <span class="summary-text">${escapeHTML(question)}</span>
      <button class="icon-btn deleteQA" title="Delete"></button>
      <button class="icon-btn editQA" title="Edit"></button>
      <button class="icon-btn playQA" title="Play"></button>
    </summary>
    <div class="answer">${escapeHTML(answer)}</div>`;
  qaBlock.appendChild(item);
}
function addToLog(entry) {
  const list = document.getElementById("changeLog");
  if (!list) return;
  const li = document.createElement("li");
  li.setAttribute("data-id", entry.id);
  li.textContent = `[${entry.category}] ${entry.question}`;
  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.style.marginLeft = "10px";
  delBtn.onclick = () => {
    if (window.__currentRole === "normal") { alert("Not allowed."); return; }
    const qaItem = document.querySelector(`details[data-id='${CSS.escape(entry.id)}']`);
    if (qaItem) qaItem.remove();
    saveQAData(loadQAData().filter(d => String(d.id) !== String(entry.id)));
    li.remove();
  };
  li.appendChild(delBtn);
  list.appendChild(li);
}

// ===== Main Initializer (idempotent) =====
let __qaBound = false;
function initApp() {
  if (__qaBound) return;
  __qaBound = true;

  const container = document.querySelector(".container");
  if (!container) return;

  // Expand / Collapse per section
  container.addEventListener("click", e => {
    const expandBtn = e.target.closest(".expand-section");
    const collapseBtn = e.target.closest(".collapse-section");
    const readQBtn = e.target.closest(".readCatQuestion");
    const readABtn = e.target.closest(".readCatAnswer");

    if (expandBtn) {
      expandBtn.closest("details")?.querySelectorAll(".qa > details").forEach(d => d.open = true);
    }
    if (collapseBtn) {
      collapseBtn.closest("details")?.querySelectorAll(".qa > details").forEach(d => d.open = false);
    }
    if (readQBtn) {
      const section = readQBtn.closest("details.category");
      const summaries = Array.from(section?.querySelectorAll(".qa > details > summary") || []);
      if (!summaries.length) { alert("No questions in this category."); return; }
      const s = summaries[Math.floor(Math.random() * summaries.length)];
      const text = s.querySelector(".summary-text")?.textContent.trim() || s.textContent.trim();
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      section.dataset.lastId = s.parentElement.getAttribute("data-id") || "";
    }
    if (readABtn) {
      const section = readABtn.closest("details.category");
      const lastId = section?.dataset?.lastId || "";
      const ans = (lastId ? section.querySelector(`details[data-id='${lastId}']`) : null)?.querySelector(".answer")?.textContent.trim() || "No answer found.";
      speechSynthesis.speak(new SpeechSynthesisUtterance(ans));
    }
  });

  // Play / Edit / Delete per item
  container.addEventListener("click", e => {
    const playBtn = e.target.closest(".playQA");
    const editBtn = e.target.closest(".editQA");
    const delBtn = e.target.closest(".deleteQA");

    if (playBtn) {
      const item = playBtn.closest("details");
      const q = item.querySelector(".summary-text")?.textContent.trim() || "";
      const a = item.querySelector(".answer")?.textContent.trim() || "";
      speechSynthesis.speak(new SpeechSynthesisUtterance(q));
      speechSynthesis.speak(new SpeechSynthesisUtterance(a));
    }

    if (editBtn) {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const item = editBtn.closest("details");
      const qEl = item.querySelector(".summary-text");
      const aEl = item.querySelector(".answer");
      const q0 = qEl?.textContent.trim() || "";
      const a0 = aEl?.textContent.trim() || "";
      const q1 = prompt("Edit question:", q0); if (q1 == null) return;
      const a1 = prompt("Edit answer:", a0); if (a1 == null) return;
      if (qEl) qEl.textContent = q1;
      if (aEl) aEl.textContent = a1;
      const id = item.getAttribute("data-id");
      saveQAData(loadQAData().map(d => String(d.id) === String(id) ? { ...d, question: q1, answer: a1 } : d));
    }

    if (delBtn) {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const item = delBtn.closest("details");
      const id = item.getAttribute("data-id");
      item.remove();
      saveQAData(loadQAData().filter(d => String(d.id) !== String(id)));
      const logEntry = document.querySelector(`#changeLog li[data-id='${CSS.escape(String(id))}']`);
      if (logEntry) logEntry.remove();
    }
  });

  // Add new Q&A
  const saveBtn = document.getElementById("saveQA");
  const catSel = document.getElementById("categorySelect");
  const newQ = document.getElementById("newQuestion");
  const newA = document.getElementById("newAnswer");
  if (saveBtn && catSel && newQ && newA) {
    saveBtn.onclick = () => {
      if (window.__currentRole === "normal") { alert("Not allowed for Normal."); return; }
      const category = catSel.value;
      const question = newQ.value.trim();
      const answer = newA.value.trim();
      if (!category || !question || !answer) { alert("Please fill all fields."); return; }
      const id = String(Date.now());
      ensureSection(category);
      insertQA(category, question, answer, id);
      const data = loadQAData(); data.push({ id, category, question, answer }); saveQAData(data);
      addToLog({ id, category, question, answer });
      newQ.value = ""; newA.value = "";
    };
  }

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
          qaItem?.scrollIntoView({ behavior: "smooth", block: "center" });
        };
        searchResults.appendChild(div);
      });
    });
  }

  // Optional: print all
  const printBtn = document.getElementById("printDoc");
  if (printBtn) {
    printBtn.onclick = () => {
      document.querySelectorAll(".container > details.category").forEach(sec => {
        sec.open = true;
        sec.querySelectorAll(".qa > details").forEach(d => d.open = true);
      });
      setTimeout(() => window.print(), 150);
    };
  }
}

// ===== Safe wiring after DOM ready =====
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const manageUsersToggle = document.getElementById("manageUsersToggle");
  const manageUsersPanel = document.getElementById("manageUsersPanel");
  const muAddBtn = document.getElementById("muAddBtn");
  const muRemoveBtn = document.getElementById("muRemoveBtn");

  // Login
  if (loginBtn) {
    loginBtn.onclick = async () => {
      const email = document.getElementById("loginUsername")?.value.trim() || "";
      const password = document.getElementById("loginPassword")?.value.trim() || "";
      const msgEl = document.getElementById("loginMessage");
      if (msgEl) msgEl.textContent = "";

      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        const role = await getRole(uid);
        showAppForRole(role, email);
        initApp();
      } catch (err) {
        console.error(err);
        if (msgEl) msgEl.textContent = "Invalid email or password.";
      }
    };
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await signOut(auth);
      hideApp();
    };
  }

  // Manage Users panel toggle
  if (manageUsersToggle && manageUsersPanel) {
    manageUsersToggle.onclick = () => {
      if (window.__currentRole !== "master" && window.__currentRole !== "admin") {
        alert("Not allowed.");
        return;
      }
      manageUsersPanel.style.display =
        manageUsersPanel.style.display === "block" ? "none" : "block";
    };
  }

  // Add/Remove users
  if (muAddBtn) {
    muAddBtn.onclick = async () => {
      const email = document.getElementById("muEmail")?.value.trim() || "";
      const password = document.getElementById("muPassword")?.value.trim() || "";
      const role = document.getElementById("muRole")?.value || "normal";
      const res = await addOrUpdateUser(window.__currentRole, email, password, role);
      alert(res.msg);
    };
  }
  if (muRemoveBtn) {
    muRemoveBtn.onclick = async () => {
      const email = document.getElementById("muEmail")?.value.trim() || "";
      const res = await removeUser(window.__currentRole, email);
      alert(res.msg);
    };
  }

  // Auth state drives UI
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const role = await getRole(user.uid);
      showAppForRole(role, user.email || "");
      initApp();
    } else {
      hideApp();
    }
  });
});
