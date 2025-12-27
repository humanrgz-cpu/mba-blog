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

// 🔧 Replace with your Firebase config
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

  if (role !== "normal") document.getElementById("toggleInputs").style.display = "inline-block";
  if (role === "master" || role === "admin") document.getElementById("manageUsersToggle").style.display = "inline-block";

  const greetEl = document.getElementById("greeting");
  if (greetEl) greetEl.textContent = "Hello Dear " + (email || "");
}

function hideApp() {
  window.__currentRole = null;
  document.getElementById("loginScreen").style.display = "block";
  document.getElementById("appContent").style.display = "none";
  document.getElementById("searchArea").style.display = "none";
  const greetEl = document.getElementById("greeting");
  if (greetEl) greetEl.textContent = "";
}

// ===== Login / Logout =====
document.getElementById("loginBtn").onclick = async () => {
  const email = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const msgEl = document.getElementById("loginMessage");

  msgEl.textContent = "";

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;
    const role = await getRole(uid);

    showAppForRole(role, email);
    initApp(); // Q&A initializer
  } catch (err) {
    console.error(err);
    msgEl.textContent = "Invalid email or password.";
  }
};

document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  hideApp();
};

// ===== Auth State Listener =====
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const role = await getRole(user.uid);
    showAppForRole(role, user.email || "");
    initApp();
  } else {
    hideApp();
  }
});

// ===== Manage Users Panel =====
const manageUsersToggle = document.getElementById("manageUsersToggle");
const manageUsersPanel = document.getElementById("manageUsersPanel");

manageUsersToggle.onclick = () => {
  if (window.__currentRole !== "master" && window.__currentRole !== "admin") {
    alert("Not allowed.");
    return;
  }
  manageUsersPanel.style.display =
    manageUsersPanel.style.display === "block" ? "none" : "block";
};

document.getElementById("muAddBtn").onclick = async () => {
  const email = document.getElementById("muEmail").value.trim();
  const password = document.getElementById("muPassword").value.trim();
  const role = document.getElementById("muRole").value;

  const res = await addOrUpdateUser(window.__currentRole, email, password, role);
  alert(res.msg);
};

document.getElementById("muRemoveBtn").onclick = async () => {
  const email = document.getElementById("muEmail").value.trim();
  const res = await removeUser(window.__currentRole, email);
  alert(res.msg);
};

// ===== Q&A Logic =====
function initApp() {

// ===== Q&A Content Storage =====
// Store questions/answers in localStorage (safe for content, not for users)
function loadQAData() {
  try { return JSON.parse(localStorage.getItem("qaData")) || []; }
  catch { return []; }
}
function saveQAData(data) {
  localStorage.setItem("qaData", JSON.stringify(data));
}

// ===== Utility =====
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== Section Handling =====
function ensureSection(category) {
  const container = document.querySelector(".container");
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
  const qaBlock = ensureSection(category).querySelector(":scope > .qa");
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

// ===== Change Log =====
function addToLog(entry) {
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
    let data = loadQAData().filter(d => String(d.id) !== String(entry.id));
    saveQAData(data);
    li.remove();
  };
  li.appendChild(delBtn);
  document.getElementById("changeLog").appendChild(li);
}

// ===== Main Initializer =====
function initApp() {
  const container = document.querySelector(".container");

  // Expand / Collapse
  container.addEventListener("click", e => {
    if (e.target.closest(".expand-section")) {
      e.target.closest("details")?.querySelectorAll(".qa > details").forEach(d => d.open = true);
    }
    if (e.target.closest(".collapse-section")) {
      e.target.closest("details")?.querySelectorAll(".qa > details").forEach(d => d.open = false);
    }
  });

  // Edit / Delete Q&A
  container.addEventListener("click", e => {
    const editBtn = e.target.closest(".editQA");
    const delBtn = e.target.closest(".deleteQA");

    if (editBtn) {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const qaItem = editBtn.closest("details");
      const summary = qaItem.querySelector(".summary-text");
      const answerEl = qaItem.querySelector(".answer");
      const newQ = prompt("Edit question:", summary.textContent.trim());
      if (newQ == null) return;
      const newA = prompt("Edit answer:", answerEl.textContent.trim());
      if (newA == null) return;
      summary.textContent = newQ;
      answerEl.textContent = newA;
      let data = loadQAData();
      const id = qaItem.getAttribute("data-id");
      data = data.map(d => String(d.id) === String(id) ? { ...d, question: newQ, answer: newA } : d);
      saveQAData(data);
    }

    if (delBtn) {
      if (window.__currentRole === "normal") { alert("Not allowed."); return; }
      const qaItem = delBtn.closest("details");
      const id = qaItem.getAttribute("data-id");
      qaItem.remove();
      let data = loadQAData().filter(d => String(d.id) !== String(id));
      saveQAData(data);
    }
  });

  // Add new Q&A
  document.getElementById("saveQA").onclick = () => {
    if (window.__currentRole === "normal") { alert("Not allowed for Normal."); return; }
    const category = document.getElementById("categorySelect").value;
    const question = document.getElementById("newQuestion").value.trim();
    const answer = document.getElementById("newAnswer").value.trim();
    if (!category || !question || !answer) {
      alert("Please fill all fields.");
      return;
    }
    const id = String(Date.now());
    ensureSection(category);
    insertQA(category, question, answer, id);
    let data = loadQAData();
    data.push({ id, category, question, answer });
    saveQAData(data);
    addToLog({ id, category, question, answer });
  };

  // Search
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
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

  // Speech synthesis
  container.addEventListener("click", e => {
    const playBtn = e.target.closest(".playQA");
    if (playBtn) {
      const qaItem = playBtn.closest("details");
      const q = qaItem.querySelector(".summary-text").textContent.trim();
      const a = qaItem.querySelector(".answer").textContent.trim();
      speechSynthesis.speak(new SpeechSynthesisUtterance(q));
      speechSynthesis.speak(new SpeechSynthesisUtterance(a));
    }
  });
}



