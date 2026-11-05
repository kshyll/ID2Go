const SUPABASE_URL = "https://rvmhhggglfgiripeaufw.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE";

const GRACE_PERIOD_SECONDS = 5 * 60;
let db = null;
let useDemoData = true;
let appointments = [];

// SET TO 2024-0005 TO TEST GRACE PERIOD PAGE DIRECTLY
let currentStudentId = "2024-0005"; 

let countdownInterval = null;

const $ = (id) => document.getElementById(id);

const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// DEMO DATA INCLUDING STUDENT E (2024-0001) WITH TEMPORARILY SKIPPED STATUS
const demoAppointments = [
  { id: "demo-1", full_name: "Student A", student_id: "2024-0001", service: "ID Picture Taking", appointment_date: todayString(), time_slot: "8:00–9:00 AM", queue_number: "031", status: "Waiting", assigned_station: null, grace_period_started_at: null },
  { id: "demo-2", full_name: "Student B", student_id: "2024-0002", service: "ID Picture Taking", appointment_date: todayString(), time_slot: "8:00–9:00 AM", queue_number: "026", status: "Serving", assigned_station: "Station 1", grace_period_started_at: null },
  { id: "demo-3", full_name: "Student C", student_id: "2024-0003", service: "ID Picture Taking", appointment_date: todayString(), time_slot: "8:00–9:00 AM", queue_number: "027", status: "Serving", assigned_station: "Station 2", grace_period_started_at: null },
  { id: "demo-4", full_name: "Student D", student_id: "2024-0004", service: "Lost ID Replacement", appointment_date: todayString(), time_slot: "8:00–9:00 AM", queue_number: "025", status: "Serving", assigned_station: "Station 3", grace_period_started_at: null },
  { id: "demo-5", full_name: "Student E", student_id: "2024-0005", service: "ID Picture Taking", appointment_date: todayString(), time_slot: "8:00–9:00 AM", queue_number: "026", status: "Temporarily Skipped", assigned_station: "Station 1", grace_period_started_at: new Date(Date.now() - 135000).toISOString() }
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  connectSupabase();
  await loadQueue();
  startGraceMonitor();
}

function connectSupabase() {
  const isConfigured = SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_ANON_KEY.includes("PASTE_YOUR") &&
    window.supabase && window.supabase.createClient;

  if (!isConfigured) {
    useDemoData = true;
    setConnection(false, "Demo Mode");
    appointments = demoAppointments.map((item) => ({ ...item }));
    return;
  }

  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    useDemoData = false;
    setConnection(true, "Live Connected");
    subscribeToChanges();
  } catch (error) {
    useDemoData = true;
    setConnection(false, "Demo Mode");
  }
}

function setConnection(online, label) {
  const badge = $("connection-badge");
  badge.textContent = label;
  badge.className = `connection-badge ${online ? "online" : "offline"}`;
}

async function loadQueue() {
  if (useDemoData || !db) {
    appointments = demoAppointments.map((item) => ({ ...item }));
  } else {
    const { data, error } = await db
      .from("appointments")
      .select("*")
      .eq("appointment_date", todayString());

    if (!error && data) {
      appointments = data;
    }
  }
  renderStudentDashboard();
}

function subscribeToChanges() {
  if (!db) return;
  db.channel("public:appointments")
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => loadQueue())
    .subscribe();
}

function renderStudentDashboard() {
  const studentApp = appointments.find(
    (a) => String(a.student_id || "").toLowerCase() === currentStudentId.toLowerCase()
  );

  renderLiveStations();

  if (!studentApp) {
    $("student-name").textContent = "Student";
    $("queue-number").textContent = "—";
    $("queue-status-text").textContent = "No Appointment Found";
    return;
  }

  $("student-name").textContent = studentApp.full_name || "Student";

  // VIEW ROUTER: SWITCHES TO GRACE PERIOD VIEW WHEN STATUS IS TEMPORARILY SKIPPED
  if (studentApp.status === "Temporarily Skipped") {
    $("view-normal").classList.remove("active");
    $("view-grace").classList.add("active");

    $("grace-queue-number").textContent = studentApp.queue_number || "—";
    $("grace-station").textContent = studentApp.assigned_station || "ID Office";
    updateCountdownDisplay(studentApp);
  } else {
    $("view-grace").classList.remove("active");
    $("view-normal").classList.add("active");

    $("queue-number").textContent = studentApp.queue_number || "—";
    $("queue-status-text").textContent = studentApp.status || "Waiting";

    const sameDay = appointments.filter((a) => a.appointment_date === studentApp.appointment_date);
    const ahead = sameDay.filter((a) =>
      ["Confirmed", "Waiting"].includes(a.status) &&
      parseInt(a.queue_number, 10) < parseInt(studentApp.queue_number, 10)
    ).length;

    $("students-ahead").textContent = ahead;
    $("est-time").textContent = `${ahead * 2 + 3}–${ahead * 3 + 5} min`;

    $("app-service").textContent = studentApp.service || "ID Picture Taking";
    $("app-schedule").textContent = `${studentApp.appointment_date} · ${studentApp.time_slot || "8:00–9:00 AM"}`;
  }
}

function renderLiveStations() {
  const stations = ["Station 1", "Station 2", "Station 3", "Station 4"];
  const grid = $("station-grid");

  grid.innerHTML = stations.map((st) => {
    const servingApp = appointments.find(
      (a) => a.assigned_station === st && a.status === "Serving"
    );

    if (servingApp) {
      return `
        <div class="station-card">
          <div class="station-title">${st}</div>
          <div class="station-number">${escapeHtml(servingApp.queue_number)}</div>
          <div class="station-status">Serving</div>
        </div>
      `;
    }

    return `
      <div class="station-card">
        <div class="station-title">${st}</div>
        <div class="station-number">—</div>
        <div class="station-status">Inactive</div>
      </div>
    `;
  }).join("");
}

function updateCountdownDisplay(appointment) {
  if (!appointment.grace_period_started_at) {
    $("grace-countdown").textContent = "05:00";
    return;
  }
  const elapsed = Math.floor((Date.now() - new Date(appointment.grace_period_started_at).getTime()) / 1000);
  const remaining = Math.max(0, GRACE_PERIOD_SECONDS - elapsed);
  const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs = String(remaining % 60).padStart(2, "0");
  $("grace-countdown").textContent = `${mins}:${secs}`;
}

function startGraceMonitor() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const studentApp = appointments.find(
      (a) => String(a.student_id || "").toLowerCase() === currentStudentId.toLowerCase()
    );

    if (studentApp && studentApp.status === "Temporarily Skipped") {
      updateCountdownDisplay(studentApp);
    }
  }, 1000);
}

function escapeHtml(val) {
  return String(val ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}