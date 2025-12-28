// ===== Firebase setup (ES modules) =====
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

// IMPORTANT: Ensure Email/Password sign-in is enabled in Firebase Authentication.
// Also ensure your HTML includes XLSX via:
// <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

const firebaseConfig = {
  apiKey: "AIzaSyA1m80OnKDqLHrOyIMD3at1CblFfvh64X8",
  authDomain: "mba-qa-46f51.firebaseapp.com",
  projectId: "mba-qa-46f51",
  storageBucket: "mba-qa-46f51.appspot.com",
  messagingSenderId: "554345717376",
  appId: "1:554345717376:web:907bb2ae83e891a36ed065"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.__currentRole = null;

// ===== Role helpers (Firestore) =====
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
  mailDoc = await getDoc(doc(db, "emails", email));
  if (!emailDoc.exists()) return { ok: false, msg: "User not found." };
  const uid = emailDoc.data().uid;
  const roleSnap = await getDoc(doc(db, "users", uid));
  if (roleSnap.exists() && roleSnap.data().role === "master") return { ok: false, msg: "Cannot remove Master." };
  await deleteDoc(doc(db, "users", uid));
  await deleteDoc(doc(db, "emails", email));
  return { ok: true, msg: "User removed." };
}

// ===== UI helpers =====
function showAppForRole(role, email) {
  window.__currentRole = role;
  const loginScreen = document.getElementById("loginScreen");
  const appContent = document.getElementById("appContent");
  const searchArea = document.getElementById("searchArea");
  const logoutBtn = document.getElementById("logoutBtn");
  const greeting = document.querySelector("#greeting");

  if (loginScreen) loginScreen.style.display = "none";
  if (appContent) appContent.style.display = "block";
  if (searchArea) searchArea.style.display = "block";
  if (logoutBtn) logoutBtn.style.display = "inline-block";
  if (greeting) greeting.textContent = "Hello Dear " + (email || "");
}

function hideApp() {
  window.__currentRole = null;
  const loginScreen = document.getElementById("loginScreen");
  const appContent = document.getElementById("appContent");
  const searchArea = document.getElementById("searchArea");
  const logoutBtn = document.getElementById("logoutBtn");
  const greeting = document.querySelector("#greeting");

  if (loginScreen) loginScreen.style.display = "inline-flex";
  if (appContent) appContent.style.display = "none";
  if (searchArea) searchArea.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "none";
  if (greeting) greeting.textContent = "";
}

// ===== Q&A storage =====
function loadQAData() {
  try { return JSON.parse(localStorage.getItem("qaData")) || []; }
  catch { return []; }
}
function saveQAData(data) { localStorage.setItem("qaData", JSON.stringify(data)); }
sc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

// ===== Section helpers & item rendering =====
function ensureSection(category) {
  const container = document.querySelector(".container");
  if (!container) return null;
  let section = Array.from(container.querySelectorAll(":scope > details"))
    .find(d => (d.querySelector(":scope > summary")?.textContent.trim() || "") === category.trim());
  if (!section) {
    section = document.createElement("details");
    section.innerHTML = `
      <summary>${esc(category)}</summary>
      <div class="section-toolbar">
        <button class="expand-section">Expand</button>
        <button class="collapse-section">Collapse</button>
        <button class="readCatQuestion">Read Random Question</button>
        <button class="readCatAnswer">Read Answer</button>
      </div>
      <div class="qa"></div>`;
    container.appendChild(section);
  }
  if (!section.querySelector(":scope > .qa")) {
    const qa = document.createElement("div");
    qa.className = "qa";
    section.appendChild(qa);
  }
  return section;
}

function insertQA(category, question, answer, id) {
  const sec = ensureSection(category);
  if (!sec) return;
  const qa = sec.querySelector(":scope > .qa");
  const item = document.createElement("details");
  item.setAttribute("data-id", String(id));
  item.innerHTML = `
    <summary>
      <span class="summary-text">${esc(question)}</span>
      <button class="icon-btn deleteQA" title="Delete"></button>
      <button class="icon-btn editQA" title="Edit"></button>
      <button class="icon-btn playQA" title="Play"></button>
    </summary>
    <div class="answer">${esc(answer)}</div>`;
  qa.appendChild(item);
}

function addToLog(entry) {
  const list = document.getElementById("changeLog");
  if (!list) return;
  const li = document.createElement("li");
  li.setAttribute("data-id", entry.id);
  li.textContent = `[${entry.category}] ${entry.question}`;
  list.appendChild(li);
}

// ===== Main initializer =====
let __qaBound = false;
function initApp() {
  __qaBound = true;

  const container = document.querySelector(".container");
  if (!container) return;

  // Section controls: expand/collapse/read Q&A
  container.addEventListener("click", e => {
    xpandBtn = e.target.closest(".expand-section");
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
      const sec = readQBtn.closest("details");
      const summaries = Array.from(sec?.querySelectorAll(".qa > details > summary") || []);
      if (!summaries.length) { alert("No questions in this category."); return; }
      const s = summaries[Math.floor(Math.random() * summaries.length)];
      const q = s.querySelector(".summary-text")?.textContent.trim() || s.textContent.trim();
      speechSynthesis.speak(new SpeechSynthesisUtterance(q));
      sec.dataset.lastId = s.parentElement.getAttribute("data-id") || "";
    }
    if (readABtn) {
      const sec = readABtn.closest("details");
      const lastId = sec?.dataset?.lastId || "";
      const a = (lastId ? sec.querySelector(`details[data-id='${lastId}']`) : null)
        ?.querySelector(".answer")?.textContent.trim() || "No answer found.";
      speechSynthesis.speak(new SpeechSynthesisUtterance(a));
    }
  });

  // Item controls: edit/delete/play
  container.addEventListener("click", e => {
    ditBtn = e.target.closest(".editQA");
    const delBtn = e.target.closest(".deleteQA");
    const playBtn = e.target.closest(".playQA");

    if (editBtn) {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const item = editBtn.closest("details");
      const qEl = item.querySelector(".summary-text");
      const aEl = item.querySelector(".answer");
      const q1 = prompt("Edit question:", qEl.textContent.trim()); if (q1 == null) return;
      const a1 = prompt("Edit answer:", aEl.textContent.trim()); if (a1 == null) return;
      qEl.textContent = q1; aEl.textContent = a1;
      const id = item.getAttribute("data-id");
      saveQAData(loadQAData().map(d => String(d.id) === String(id)
        ? { ...d, question: q1, answer: a1 }
        : d));
    }

    if (delBtn) {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const item = delBtn.closest("details");
      const id = item.getAttribute("data-id");
      item.remove();
      saveQAData(loadQAData().filter(d => String(d.id) !== String(id)));
      const logEntry = document.querySelector(`#changeLog li[data-id="${id}"]`);
      if (logEntry) logEntry.remove();
    }

    if (playBtn) {
      const item = playBtn.closest("details");
      const q = item.querySelector(".summary-text")?.textContent.trim() || "";
      const a = item.querySelector(".answer")?.textContent.trim() || "";
      speechSynthesis.speak(new SpeechSynthesisUtterance(q));
      speechSynthesis.speak(new SpeechSynthesisUtterance(a));
    }
  });

  // Toggle Add Q&A panel (sidebar)
  const toggleInputs = document.getElementById("toggleInputs");
  const userPanels = Array.from(document.querySelectorAll("#userPanel"));
  const userPanel = userPanels[userPanels.length - 1] || null;
  if (toggleInputs && userPanel) {
    toggleInputs.onclick = () => {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const visible = userPanel.style.display === "block";
      userPanel.style.display = visible ? "none" : "block";
      toggleInputs.textContent = visible ? "Add New Q&A" : "Hide Q&A Form";
    };
  }

  // Manage Users toggle
  const manageUsersToggle = document.getElementById("manageUsersToggle");
  const manageUsersPanel = document.getElementById("manageUsersPanel");
  if (manageUsersToggle && manageUsersPanel) {
    manageUsersToggle.onclick = () => {
      if (window.__currentRole !== "master" && window.__currentRole !== "admin") { alert("Not allowed."); return; }
      manageUsersPanel.style.display = manageUsersPanel.style.display === "block" ? "none" : "block";
    };
  }

  // Save new Q&A (IDs must exist)
  const saveBtn = document.getElementById("saveQA");
  const catSel = document.getElementById("categorySelect");
  const newQ = document.getElementById("newQuestion");
  const newA = document.getElementById("newAnswer");
  if (saveBtn && catSel && newQ && newA) {
    saveBtn.onclick = () => {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const category = (catSel.value || "").trim();
      const question = (newQ.value || "").trim();
      const answer = (newA.value || "").trim();
      if (!category || !question || !answer) { alert("Please fill all fields."); return; }
      const id = String(Date.now());
      insertQA(category, question, answer, id);
      const data = loadQAData(); data.push({ id, category, question, answer }); saveQAData(data);
      addToLog({ id, category, question, answer });
      newQ.value = ""; newA.value = "";
    };
  }

  // Excel import
// Excel import
xcelInput = document.getElementById("excelFile");
const importBtn = document.getElementById("importExcel");
if (excelInput && importBtn) {
  importBtn.onclick = async () => {
    if (window.__currentRole === "normal") { alert("Not allowed."); return; }
    const file = excelInput.files?.[0];
    if (!file) { alert("Choose an Excel file first."); return; }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const firstSheet = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1 });
    // Expect columns: Category | Question | Answer
    const out = loadQAData();
    rows.slice(1).forEach(r => {
      const [category, question, answer] = r;
      if (!category || !question || !answer) return;
      const id = String(Date.now() + Math.random());
      insertQA(String(category), String(question), String(answer), id);
      out.push({
        id,
        category: String(category),
        question: String(question),
        answer: String(answer)
      });
      addToLog({
        id,
        category: String(category),
        question: String(question),
        answer: String(answer)
      });
    });
    saveQAData(out);
    alert("Import completed.");
  };
}

  // Search
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  if (searchInput && searchResults) {
    searchInput.addEventListener("input", () => {
      const term = (searchInput.value || "").toLowerCase().trim();
      searchResults.innerHTML = "";
      if (!term) return;

      const matches = loadQAData().filter(d =>
        (d.question || "").toLowerCase().includes(term) ||
        (d.answer || "").toLowerCase().includes(term) ||
        (d.category || "").toLowerCase().includes(term)
      );

      matches.forEach(d => {
        const div = document.createElement("div");
        div.textContent = `${d.category} — ${d.question}`;
        div.onclick = () => {
          l = document.querySelector(`details[data-id="${d.id}"]`);
          if (!el) return;
const parentDetails = el.closest("details");
if (parentDetails) {
  parentDetails.open = true;
}
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        };
        searchResults.appendChild(div);
      });
    });
  }

  // Print (open all sections and items, then print)
  const printBtn = document.getElementById("printDoc");
  if (printBtn) {
    printBtn.onclick = () => {
      document.querySelectorAll(".container > details").forEach(sec => {
        sec.open = true;
        sec.querySelectorAll(".qa > details").forEach(d => d.open = true);
      });
      setTimeout(() => window.print(), 150);
    };
  }

  // Back to top
  const backToTop = document.getElementById("backToTop");
  if (backToTop) {
    window.addEventListener("scroll", () => {
      const y = document.documentElement.scrollTop || document.body.scrollTop;
      backToTop.style.display = y > 200 ? "block" : "none";
    });
    backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  // Manage Users buttons (inside manageUsersPanel)
  const muAddBtn = document.getElementById("muAddBtn");
  const muRemoveBtn = document.getElementById("muRemoveBtn");
  if (muAddBtn) {
    muAddBtn.onclick = async () => {
      mail = document.getElementById("muUsername")?.value.trim() || "";
      const password = document.getElementById("muPassword")?.value.trim() || "";
      const role = document.getElementById("muRole")?.value || "normal";
      const res = await addOrUpdateUser(window.__currentRole, email, password, role);
      alert(res.msg);
    };
  }
  if (muRemoveBtn) {
    muRemoveBtn.onclick = async () => {
      const email = document.getElementById("muUsername")?.value.trim() || "";
      const res = await removeUser(window.__currentRole, email);
      alert(res.msg);
    };
  }
}

// ===== Login/logout/auth wiring =====
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginScreen");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email")?.value.trim() || "";
      const password = document.getElementById("password")?.value.trim() || "";
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const role = await getRole(userCred.user.uid);
        showAppForRole(role, email);
        initApp();
} catch (err) {
  console.error("Login error:", err.code, err.message);
  alert("Login failed: " + err.code);
}
    });
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await signOut(auth);
      hideApp();
    };
  }

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





