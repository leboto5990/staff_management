import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc,
  getDocs, query, orderBy, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const authPage = $("authPage");
const dashboardPage = $("dashboardPage");
let currentUser = null;
let currentRole = null;

function message(id, text, error = false) {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle("error", error);
}
function showAuth() {
  authPage.classList.remove("hidden");
  dashboardPage.classList.add("hidden");
}
function showDashboard() {
  authPage.classList.add("hidden");
  dashboardPage.classList.remove("hidden");
}
function showView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  const target = $(view);
  if (target) target.classList.remove("hidden");
  document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.view === view.replace("admin","").replace("employee","").replace(/^./, c => c.toLowerCase())));
}
function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function dateText(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString() : "Just now";
}

$("toggleRegister").addEventListener("click", () => {
  $("loginForm").classList.toggle("hidden");
  $("registerForm").classList.toggle("hidden");
  $("toggleRegister").textContent = $("registerForm").classList.contains("hidden") ? "REGISTER" : "BACK TO LOGIN";
});
$("showReset").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  if (!email) return message("loginMessage", "Enter your email address first.", true);
  try { await sendPasswordResetEmail(auth, email); message("loginMessage", "Password reset email sent. Check your inbox."); }
  catch (e) { message("loginMessage", e.message, true); }
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  message("loginMessage", "Signing in...");
  try {
    await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPassword").value);
  } catch (e) { message("loginMessage", friendlyError(e), true); }
});

$("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  message("registerMessage", "Creating employee account...");
  try {
    const name = $("registerName").value.trim();
    const email = $("registerEmail").value.trim();
    const credential = await createUserWithEmailAndPassword(auth, email, $("registerPassword").value);
    // Public registration can ONLY create an employee profile. It cannot select admin.
    await setDoc(doc(db, "users", credential.user.uid), {
      name, email, role: "employee", createdAt: serverTimestamp()
    });
    await setDoc(doc(db, "employees", credential.user.uid), {
      uid: credential.user.uid, name, email, department: "Not assigned",
      createdAt: serverTimestamp()
    });
    message("registerMessage", "Account created. Opening your employee dashboard...");
  } catch (e) { message("registerMessage", friendlyError(e), true); }
});

function friendlyError(e) {
  const map = {
    "auth/email-already-in-use": "This email already has an account. Please log in.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/operation-not-allowed": "Enable Email/Password sign-in in Firebase Authentication."
  };
  return map[e.code] || e.message || "Something went wrong.";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { currentUser = null; currentRole = null; showAuth(); return; }
  currentUser = user;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) throw new Error("Your user profile is missing. Contact the administrator.");
    const profile = snap.data();
    currentRole = profile.role;
    if (!["admin", "employee"].includes(currentRole)) throw new Error("Your account has no valid role.");
    showDashboard();
    const name = profile.name || user.email;
    $("headerName").textContent = name;
    $("avatar").textContent = name.charAt(0).toUpperCase();
    $("welcomeTitle").textContent = currentRole === "admin" ? "Admin dashboard" : "Employee dashboard";
    $("roleLabel").textContent = currentRole.toUpperCase() + " PORTAL";
    $("adminNav").classList.toggle("hidden", currentRole !== "admin");
    $("employeeNav").classList.toggle("hidden", currentRole !== "employee");
    if (currentRole === "admin") {
      $("adminName").textContent = name;
      await loadAdminData();
      showView("adminOverview");
    } else {
      await loadEmployeeData(profile);
      showView("employeeMyProfile");
    }
  } catch (e) {
    alert(e.message);
    await signOut(auth);
  }
});

$("logoutBtn").addEventListener("click", () => signOut(auth));
document.querySelectorAll(".nav-link").forEach(btn => btn.addEventListener("click", async () => {
  const map = {
    overview: "adminOverview", employees: "adminEmployees",
    announcements: currentRole === "admin" ? "adminAnnouncements" : "employeeMyAnnouncements",
    myProfile: "employeeMyProfile", myAnnouncements: "employeeMyAnnouncements"
  };
  const view = map[btn.dataset.view];
  if (view) showView(view);
  if (btn.dataset.view === "employees") await loadEmployees();
  if (btn.dataset.view === "announcements" || btn.dataset.view === "myAnnouncements") await loadAnnouncements(currentRole);
}));
document.querySelectorAll("[data-goto]").forEach(btn => btn.addEventListener("click", async () => {
  showView("adminEmployees"); await loadEmployees();
}));

async function loadAdminData() {
  const [employees, announcements] = await Promise.all([
    getDocs(collection(db, "employees")), getDocs(collection(db, "announcements"))
  ]);
  $("totalEmployees").textContent = employees.size;
  $("totalAnnouncements").textContent = announcements.size;
  const latest = employees.docs.slice(-5).reverse().map(d => d.data());
  renderEmployeeTable("recentEmployees", latest, false);
}
async function loadEmployees() {
  const snap = await getDocs(query(collection(db, "employees"), orderBy("createdAt", "desc")));
  renderEmployeeTable("employeeTable", snap.docs.map(d => ({ id: d.id, ...d.data() })), true);
}
function renderEmployeeTable(target, rows, canDelete) {
  if (!rows.length) { $(target).innerHTML = '<p class="hint">No employee records yet.</p>'; return; }
  $(target).innerHTML = `<table><thead><tr><th>Name</th><th>Email</th><th>Department</th>${canDelete ? "<th>Action</th>" : ""}</tr></thead><tbody>${rows.map(r => `<tr><td>${safeText(r.name)}</td><td>${safeText(r.email)}</td><td>${safeText(r.department || "Not assigned")}</td>${canDelete ? `<td><button class="text-button delete-employee" data-id="${safeText(r.id)}">Delete</button></td>` : ""}</tr>`).join("")}</tbody></table>`;
  document.querySelectorAll(".delete-employee").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Delete this employee record? This does not delete their login account.")) return;
    await deleteDoc(doc(db, "employees", btn.dataset.id));
    await loadEmployees(); await loadAdminData();
  }));
}

$("addEmployeeForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await addDoc(collection(db, "employees"), {
      name: $("employeeName").value.trim(),
      email: $("employeeEmail").value.trim(),
      department: $("employeeDepartment").value.trim(),
      createdAt: serverTimestamp()
    });
    e.target.reset();
    message("employeeMessage", "Employee record added.");
    await loadEmployees(); await loadAdminData();
  } catch (e) { message("employeeMessage", e.message, true); }
});

async function loadEmployeeData(profile) {
  const employee = await getDoc(doc(db, "employees", currentUser.uid));
  const data = employee.exists() ? employee.data() : profile;
  $("profileName").textContent = data.name || "—";
  $("profileEmail").textContent = currentUser.email || "—";
  $("profileDepartment").textContent = data.department || "Not assigned";
}
$("announcementForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await addDoc(collection(db, "announcements"), {
      title: $("announcementTitle").value.trim(),
      body: $("announcementBody").value.trim(),
      createdBy: currentUser.uid, createdAt: serverTimestamp()
    });
    e.target.reset(); message("announcementMessage", "Announcement published.");
    await loadAnnouncements("admin");
  } catch (e) { message("announcementMessage", e.message, true); }
});
async function loadAnnouncements(role) {
  const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
  const html = snap.docs.map(d => {
    const a = d.data();
    return `<article class="announcement"><h3>${safeText(a.title)}</h3><p>${safeText(a.body)}</p><small>${dateText(a.createdAt)}</small></article>`;
  }).join("") || '<p class="hint">No announcements yet.</p>';
  if (role === "admin") $("adminAnnouncementList").innerHTML = html;
  else $("employeeAnnouncementList").innerHTML = html;
}
