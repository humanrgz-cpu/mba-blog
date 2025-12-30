// ===== Firebase setup =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } 
  from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, doc, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

// TODO: Replace with your actual config
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

// ===== Auth UI wiring =====
const loginForm = document.getElementById("loginScreen");
const logoutBtn = document.getElementById("logoutBtn");
const appScreen = document.getElementById("appScreen");
const greeting = document.getElementById("greeting");

// Login
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email")?.value.trim() || "";
    const password = document.getElementById("password")?.value.trim() || "";

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const roleDoc = await getDoc(doc(db, "users", userCred.user.uid));
      const role = roleDoc.exists() ? roleDoc.data().role : "normal";
      showAppForRole(role, email);
      // Delay init to ensure DOM-visible elements exist
      setTimeout(initApp, 50);
    } catch (err) {
      console.error("Login error:", err.code, err.message);
      alert("Login failed: " + err.code);
    }
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } finally {
      // Keep it simple: reload the page to reset UI
      location.reload();
    }
  });
}

// Auth state observer
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Authenticated:", user.email);
  } else {
    console.log("Unauthenticated");
  }
});

// Reveal app UI after login
function showAppForRole(role, email) {
  if (loginForm) loginForm.classList.add("hidden");
  if (appScreen) appScreen.classList.remove("hidden");
  if (greeting) greeting.textContent = `Welcome ${email} (${role})`;
}

// ===== Q&A controls =====
let __qaBound = false;

function initApp() {
  if (__qaBound) return;
  __qaBound = true;

  const container = document.querySelector(".container");
  if (!container) {
    console.warn("Q&A: No .container found — controls will not bind.");
    return;
  }

  // Global controls
  document.getElementById("printDoc")?.addEventListener("click", () => window.print());
  document.getElementById("backToTop")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Expand/Collapse all
  container.addEventListener("click", (e) => {
    const expandAll = e.target.closest(".expand-all");
    const collapseAll = e.target.closest(".collapse-all");
    if (expandAll) {
      container.querySelectorAll("details").forEach((d) => { d.open = true; });
      return;
    }
    if (collapseAll) {
      container.querySelectorAll("details").forEach((d) => { d.open = false; });
      return;
    }
  });

  // Per-section controls via delegation
  container.addEventListener("click", (e) => {
    const sectionDetails = e.target.closest("details");
    if (!sectionDetails) return;

    const expandBtn = e.target.closest(".expand-section");
    const collapseBtn = e.target.closest(".collapse-section");
    const randomQBtn = e.target.closest(".readCatQuestion");
    const readABtn   = e.target.closest(".readCatAnswer");
    const readAllQ   = e.target.closest(".readAllQuestions");
    const readAllA   = e.target.closest(".readAllAnswers");

    // Expand / Collapse single section
    if (expandBtn) {
      sectionDetails.open = true;
      return;
    }
    if (collapseBtn) {
      sectionDetails.open = false;
      return;
    }

    // Collect QA items within this section
    const items = collectQAItems(sectionDetails);
    if (!items.length && (randomQBtn || readABtn || readAllQ || readAllA)) {
      warnNoItems(sectionDetails);
      return;
    }

    // Random question
    if (randomQBtn) {
      const { index, item } = pickRandomQA(items);
      // Persist last picked index for "Read Answer"
      sectionDetails.dataset.lastIndex = String(index);
      speak(`Question: ${item.question}`);
      return;
    }

    // Read answer to last picked question
    if (readABtn) {
      const last = sectionDetails.dataset.lastIndex;
      const idx = last ? parseInt(last, 10) : -1;
      const item = items[idx];
      if (!item) {
        speak("No question selected yet. Pick a random question first.");
        return;
      }
      speak(`Answer: ${item.answer}`);
      return;
    }

    // Read all questions
    if (readAllQ) {
      const text = items.map(i => i.question).join(". ");
      speak(text || "No questions found in this section.");
      return;
    }

    // Read all answers
    if (readAllA) {
      const text = items.map(i => i.answer).join(". ");
      speak(text || "No answers found in this section.");
      return;
    }
  });

  console.log("Q&A controls bound.");
}

// ===== Helpers =====

// Collect Q/A items from a section:
// Supports two patterns:
// 1) .question + .answer pairing (siblings or grouped)
// 2) .qa-item with data-question / data-answer
function collectQAItems(sectionRoot) {
  const items = [];

  // Pattern 1: .question/.answer pairs
  const qEls = Array.from(sectionRoot.querySelectorAll(".question"));
  const aEls = Array.from(sectionRoot.querySelectorAll(".answer"));

  // Try to pair by index if counts align
  if (qEls.length && qEls.length === aEls.length) {
    for (let i = 0; i < qEls.length; i++) {
      const q = cleanText(qEls[i].textContent);
      const a = cleanText(aEls[i].textContent);
      if (q || a) items.push({ question: q, answer: a });
    }
  } else if (qEls.length) {
    // Fallback: search nearest answer sibling for each question
    qEls.forEach((qEl) => {
      const q = cleanText(qEl.textContent);
      let a = "";
      const near = qEl.closest(".qa-pair")?.querySelector(".answer")
        || qEl.nextElementSibling?.matches?.(".answer") ? qEl.nextElementSibling : null;
      if (near && near.classList.contains("answer")) a = cleanText(near.textContent);
      if (q || a) items.push({ question: q, answer: a });
    });
  }

  // Pattern 2: .qa-item with data-question/answer
  const qaItems = Array.from(sectionRoot.querySelectorAll(".qa-item"));
  qaItems.forEach((el) => {
    const q = cleanText(el.getAttribute("data-question") || el.textContent || "");
    const a = cleanText(el.getAttribute("data-answer") || "");
    if (q || a) items.push({ question: q, answer: a });
  });

  // De-duplicate blank entries
  return items.filter(i => i.question || i.answer);
}

function pickRandomQA(items) {
  const index = Math.floor(Math.random() * items.length);
  return { index, item: items[index] };
}

function warnNoItems(sectionRoot) {
  const title = sectionRoot.querySelector("summary")?.textContent?.trim() || "this section";
  console.warn(`Q&A: No items found in ${title}. Ensure markup uses .question/.answer or .qa-item with data-question/data-answer.`);
  speak(`No items found in ${title}.`);
}

function cleanText(t) {
  return (t || "").replace(/\s+/g, " ").trim();
}

// ===== Text-to-speech =====
function speak(text, opts = {}) {
  if (!text) return;
  const synth = window.speechSynthesis;
  if (!synth) {
    alert(text);
    return;
  }

  const utter = new SpeechSynthesisUtterance(text);
  // Basic Persian/English handling — adjust if needed
  utter.lang = detectLang(text);
  utter.rate = opts.rate || 1.0;
  utter.pitch = opts.pitch || 1.0;
  utter.volume = opts.volume || 1.0;

  synth.cancel(); // stop any ongoing speech
  synth.speak(utter);
}

function detectLang(text) {
  // Naive check: Persian characters range
  const hasPersian = /[\u0600-\u06FF]/.test(text);
  return hasPersian ? "fa-IR" : "en-US";
}
