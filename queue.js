


const SUPABASE_URL = "https://rvmhhggglfgiripeaufw.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE";

const GRACE_PERIOD_SECONDS = 5 * 60;
const TERMINAL_STATUSES = ["Completed", "Missed", "Cancelled"];
const ACTIVE_STATUSES = ["Confirmed", "Waiting", "Serving", "Temporarily Skipped"];

let db = null;
let useDemoData = true;
let appointments = [];
let selectedStudentId = "";
let currentStudentAppointment = null;
let activeChannel = null;
let countdownInterval = null;

const $ = (id) => document.getElementById(id);
const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const demoAppointments = [
  { id: "demo-1", full_name: "Student A", student_id: "2024-0001", service: "First-Time ID Picture Taking", appointment_date: todayString(), time_slot: "8:00–9:00 AM", queue_number: "026", status: "Serving", assigned_station: "Station 1", grace_period_started_at: null },
  { id: "demo-2", full_name: "Student B", student_id: "2024-0002", service: "First-Time ID Picture Taking", appointment_date: todayString(), time_slot: "8:00–9:00 AM", queue_number: "027", status: "Serving", assigned_station: "Station 2", grace_period_started_at: null },
  { id: "demo-3", full_name: "Student C", student_id: "2024-0003", service: "Lost ID Replacement", appointment_date: todayString(), time_slot: "8:00–9:00 AM", queue_number: "028", status: "Waiting", assigned_station: null, grace_period_started_at: null },
  { id: "demo-4", full_name: "Student D", student_id: "2024-0004", service: "First-Time ID Picture Taking", appointment_date: todayString(), time_slot: "9:00–10:00 AM", queue_number: "029", status: "Waiting", assigned_station: null, grace_period_started_at: null },
  { id: "demo-5", full_name: "Student E", student_id: "2024-0005", service: "Lost ID Replacement", appointment_date: todayString(), time_slot: "9:00–10:00 AM", queue_number: "030", status: "Temporarily Skipped", assigned_station: "Station 3", grace_period_started_at: new Date(Date.now() - 90000).toISOString() }
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("operator-date").value = todayString();
  bindEvents();
  connectSupabase();
  await loadQueue();
  renderStations();
  startGraceMonitor();
}

function bindEvents() {
  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      $(button.dataset.view).classList.add("active");
    });
  });

  $("queue-search").addEventListener("input", () => {
  renderQueueTable(getSelectedDateAppointments());
});

$("queue-station-filter").addEventListener("change", () => {
  renderQueueTable(getSelectedDateAppointments());
});

  $("student-lookup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    selectedStudentId = $("student-id-search").value.trim();
    renderStudentView();
  });

  $("operator-date").addEventListener("change", loadQueue);
  $("station-select").addEventListener("change", () => {
    $("current-station-title").textContent = $("station-select").value;
    renderOperatorView();
  });
  $("refresh-queue").addEventListener("click", loadQueue);
  $("call-next").addEventListener("click", callNextStudent);
  $("complete-current").addEventListener("click", completeCurrentStudent);
  $("skip-current").addEventListener("click", skipCurrentStudent);
}

function connectSupabase() {
  const configured = SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_ANON_KEY.includes("PASTE_YOUR") &&
    window.supabase && window.supabase.createClient;

  if (!configured) {
    useDemoData = true;
    setConnection(false, "Not connected");
    appointments = demoAppointments.map((item) => ({ ...item }));
    return;
  }

  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    useDemoData = false;
    setConnection(true, "Supabase configured");
    subscribeToChanges();
  } catch (error) {
    console.error("Supabase initialization failed:", error);
    useDemoData = true;
    setConnection(false, "Not connected");
  }
}

function setConnection(online, label) {
  const badge = $("connection-badge");
  badge.textContent = label;
  badge.classList.toggle("online", online);
  badge.classList.toggle("offline", !online);
}

async function loadQueue() {
  const date = $("operator-date").value || todayString();
  $("queue-date-label").textContent = date;

  if (useDemoData || !db) {
    if (!appointments.length || appointments[0]?.id?.startsWith("demo-") === false) {
      appointments = demoAppointments.map((item) => ({ ...item }));
    }
  } else {
    const { data, error } = await db
      .from("appointments")
      .select("*")
      .eq("appointment_date", date);

    if (error) {
      console.error("Could not load appointments:", error);
      setConnection(false, "Database error");
      alert("Could not load appointments. Check the table columns and Supabase permissions.");
      return;
    }
    appointments = data || [];
    setConnection(true, "Supabase connected");
  }

  renderOperatorView();
  renderStudentView();
  renderStations();
}

function subscribeToChanges() {
  if (!db) return;
  activeChannel = db.channel("id2go-queue-updates")
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => loadQueue())
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setConnection(true, "Live connected");
    });
}

function getSelectedDateAppointments() {
  const date = $("operator-date").value || todayString();
  return appointments.filter((appointment) => appointment.appointment_date === date);
}

function sortByQueue(list) {
  return [...list].sort((a, b) => {
    const numberA = parseInt(String(a.queue_number || "").replace(/\D/g, ""), 10) || 0;
    const numberB = parseInt(String(b.queue_number || "").replace(/\D/g, ""), 10) || 0;
    return numberA - numberB;
  });
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("serving")) return "serving";
  if (value.includes("complete")) return "completed";
  if (value.includes("miss")) return "missed";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("skip")) return "skipped";
  if (value.includes("confirm")) return "confirmed";
  return "waiting";
}

function statusPill(status) {
  return `<span class="status-pill ${statusClass(status)}">${escapeHtml(status || "Waiting")}</span>`;
}

function renderOperatorView() {
  const list = getSelectedDateAppointments();
  const waiting = list.filter((a) => ["Confirmed", "Waiting"].includes(a.status));
  const serving = list.filter((a) => a.status === "Serving");
  const completed = list.filter((a) => a.status === "Completed");
  const skipped = list.filter((a) => a.status === "Temporarily Skipped");

  $("count-waiting").textContent = waiting.length;
  $("count-serving").textContent = serving.length;
  $("count-completed").textContent = completed.length;
  $("count-skipped").textContent = skipped.length;
  $("standby-count").textContent = `${skipped.length} student${skipped.length === 1 ? "" : "s"}`;

  const station = $("station-select").value;
  $("current-station-title").textContent = station;
  const current = serving.find((a) => a.assigned_station === station);
  renderCurrentStudent(current);
  renderQueueTable(list);
  renderStandbyList(skipped);
}

function renderCurrentStudent(appointment) {
  currentStudentAppointment = appointment || null;
  $("station-current-status").textContent = appointment ? "Serving" : "Available";
  $("station-current-status").className = `status-pill ${appointment ? "serving" : ""}`;
  $("current-student").innerHTML = appointment
    ? `<strong>${escapeHtml(appointment.queue_number)} · ${escapeHtml(appointment.full_name)}</strong><span>${escapeHtml(appointment.service || "ID Service")} · ${escapeHtml(appointment.student_id)}</span>`
    : `<span class="muted">No student is currently being served at this station.</span>`;
  $("call-next").disabled = !!appointment;
  $("complete-current").disabled = !appointment;
  $("skip-current").disabled = !appointment;
}



function renderQueueTable(list) {
  const search = $("queue-search").value.trim().toLowerCase();
  const station = $("queue-station-filter").value;

  const filtered = sortByQueue(list).filter((a) => {
    const matchesSearch =
      String(a.queue_number || "").toLowerCase().includes(search) ||
      String(a.full_name || "").toLowerCase().includes(search);

    const matchesStation =
      station === "all" || a.assigned_station === station;

    return matchesSearch && matchesStation;
  });

  $("queue-table-body").innerHTML = filtered.length
    ? filtered.map((a) => `
      <tr>
        <td>${escapeHtml(a.queue_number || "—")}</td>
        <td>
          ${escapeHtml(a.full_name || "—")}
          <br>
          <span class="muted small">
            ${escapeHtml(a.student_id || "")}
          </span>
        </td>
        <td>${escapeHtml(a.assigned_station || "—")}</td>
        <td>${statusPill(a.status)}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="4" class="table-empty">
          No matching appointments found.
        </td>
      </tr>
    `;
}

function renderStandbyList(list) {
  const sorted = sortByQueue(list);

  $("standby-count").textContent =
    `${sorted.length} Pending`;

  $("standby-list").innerHTML = sorted.length
    ? `
      <table class="standby-table">
        <thead>
          <tr>
            <th>Queue</th>
            <th>Original Station</th>
            <th>Remaining</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((a) => `
            <tr>
              <td>${escapeHtml(a.queue_number || "—")}</td>
              <td>${escapeHtml(a.assigned_station || "—")}</td>
              <td>
                <span data-grace-id="${escapeHtml(a.id)}">
                  ${getRemainingGrace(a)}
                </span>
              </td>
              <td>
                <button
                  class="btn btn-light"
                  data-action="arrived"
                  data-id="${escapeHtml(a.id)}">
                  Mark Arrived
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="standby-note">
        When marked Arrived or when the deadline expires,
        the student is automatically removed from the active
        Standby Queue list.
      </div>
    `
    : `<div class="standby-empty">No students in the standby queue.</div>`;

  $("standby-list")
    .querySelectorAll("[data-action='arrived']")
    .forEach((button) => {
      button.addEventListener("click", () => {
        markArrived(button.dataset.id);
      });
    });
}

function renderStudentView() {
  if (!selectedStudentId) return;
  const appointment = appointments.find((a) =>
    String(a.student_id || "").toLowerCase() === selectedStudentId.toLowerCase() &&
    !TERMINAL_STATUSES.includes(a.status)
  );

  if (!appointment) {
    $("student-result").classList.add("hidden");
    $("student-empty").classList.remove("hidden");
    $("student-empty").innerHTML = `<div class="empty-icon">⌕</div><h3>No active appointment found</h3><p>Check your student ID or confirm that your appointment is not completed, cancelled, or missed.</p>`;
    currentStudentAppointment = null;
    return;
  }

  currentStudentAppointment = appointment;
  $("student-empty").classList.add("hidden");
  $("student-result").classList.remove("hidden");
  $("student-queue-number").textContent = appointment.queue_number || "—";
  $("student-status").textContent = appointment.status || "Waiting";
  $("student-status").className = `status-pill ${statusClass(appointment.status)}`;
  $("student-service").textContent = appointment.service || "ID Service";
  $("student-name").textContent = appointment.full_name || "Student";
  $("student-date").textContent = appointment.appointment_date || "—";
  $("student-time").textContent = appointment.time_slot || "—";
  $("student-station").textContent = appointment.assigned_station || "Not assigned";

  const sameDay = appointments.filter((a) => a.appointment_date === appointment.appointment_date);
  const ahead = sameDay.filter((a) =>
    ["Confirmed", "Waiting"].includes(a.status) &&
    parseInt(a.queue_number, 10) < parseInt(appointment.queue_number, 10)
  ).length;
  $("students-ahead").textContent = appointment.status === "Serving" ? "0" : ahead;

  const messages = {
    "Confirmed": "Your appointment is confirmed. Wait for your queue to be called.",
    "Waiting": "Please stay near the ID service area and monitor the live queue.",
    "Serving": "Your turn is now being served. Please proceed to your assigned station.",
    "Temporarily Skipped": "Please report to the ID Office before the grace period expires."
  };
  $("student-message").textContent = messages[appointment.status] || "Your appointment status is updated.";
  $("grace-card").classList.toggle("hidden", appointment.status !== "Temporarily Skipped");
  if (appointment.status === "Temporarily Skipped") updateStudentCountdown(appointment);
}

function renderStations() {
  const list = getSelectedDateAppointments();
  const stations = ["Station 1", "Station 2", "Station 3", "Station 4"];
  $("station-list").innerHTML = stations.map((station) => {
    const serving = list.find((a) => a.assigned_station === station && a.status === "Serving");
    return `<div class="station-item"><span>${station}</span><strong>${serving ? escapeHtml(serving.queue_number) : "—"}</strong><small>${serving ? "Serving" : "Available"}</small></div>`;
  }).join("");
}

async function callNextStudent() {
  const station = $("station-select").value;
  const alreadyServing = getSelectedDateAppointments().some((a) => a.status === "Serving" && a.assigned_station === station);
  if (alreadyServing) return alert(`${station} already has a student being served.`);

  const next = sortByQueue(getSelectedDateAppointments().filter((a) => ["Confirmed", "Waiting"].includes(a.status)))[0];
  if (!next) return alert("There are no waiting students in this queue.");

  await updateAppointment(next.id, {
    status: "Serving",
    assigned_station: station,
    grace_period_started_at: null
  });
}

async function completeCurrentStudent() {
  if (!currentStudentAppointment) return;
  await updateAppointment(currentStudentAppointment.id, {
    status: "Completed",
    grace_period_started_at: null
  });
}

async function skipCurrentStudent() {
  if (!currentStudentAppointment) return;
  await updateAppointment(currentStudentAppointment.id, {
    status: "Temporarily Skipped",
    grace_period_started_at: new Date().toISOString()
  });
}

async function markArrived(id) {
  await updateAppointment(id, {
    status: "Waiting",
    assigned_station: null,
    grace_period_started_at: null
  });
}

async function updateAppointment(id, changes) {
  if (useDemoData) {
    const item = appointments.find((a) => a.id === id);
    if (item) Object.assign(item, changes);
    renderOperatorView();
    renderStudentView();
    renderStations();
    return;
  }

  const { error } = await db.from("appointments").update(changes).eq("id", id);
  if (error) {
    console.error("Queue update failed:", error);
    alert("The queue update could not be saved. Confirm that queue_setup.sql has been run and that your Supabase policies allow this action.");
    return;
  }
  await loadQueue();
}

function getRemainingGrace(appointment) {
  if (!appointment.grace_period_started_at) return "05:00";
  const elapsed = Math.floor((Date.now() - new Date(appointment.grace_period_started_at).getTime()) / 1000);
  const remaining = Math.max(0, GRACE_PERIOD_SECONDS - elapsed);
  return formatTime(remaining);
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function updateStudentCountdown(appointment) {
  $("grace-countdown").textContent = getRemainingGrace(appointment);
}

function startGraceMonitor() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(async () => {
    const skipped = appointments.filter((a) => a.status === "Temporarily Skipped");
    for (const appointment of skipped) {
      const remaining = getRemainingGrace(appointment);
      const timer = document.querySelector(`[data-grace-id="${CSS.escape(String(appointment.id))}"]`);
      if (timer) timer.textContent = `${remaining} remaining`;
      if (appointment.id === currentStudentAppointment?.id) updateStudentCountdown(appointment);
      if (remaining === "00:00" && appointment.grace_period_started_at) {
        await updateAppointment(appointment.id, { status: "Missed" });
      }
    }
  }, 1000);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}