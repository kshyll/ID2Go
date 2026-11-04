window.OperatorViews = (() => {
  const store = window.OperatorStore;

  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  const number = value => String(value).padStart(3, "0");
  const tag = text => `<span class="tag">${escape(text)}</span>`;
  const button = (label, action, primary = false) =>
    `<button class="button ${primary ? "primary" : ""}" data-action="${action}">${escape(label)}</button>`;
  const back = page => `<button class="button back" data-page="${page}">← Back</button>`;
  const detail = (label, value) => `<div class="details"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;
  const timer = ms => {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };

  function layout(body, tab = "") {
    const nav = tab ? `<nav class="bottom-nav" aria-label="Operator navigation">
      ${["home", "queue", "profile"].map(name => `<button data-page="${name}"
        class="${tab === name ? "active" : ""}">${name[0].toUpperCase() + name.slice(1)}</button>`).join("")}
    </nav>` : "";
    return `<main class="phone">${body}${nav}</main>`;
  }

  function selectStation() {
    return layout(`<section class="card">
      <h1 class="heading">Select Your Station</h1>
      <p class="subtitle">Choose your assigned camera station before starting your session.</p>
      ${store.getState().stations.map(s => `<button class="choice" data-action="selectStation" data-id="${s.id}"
        ${!s.available || s.currentId ? "disabled" : ""}>
        <span><span class="status-dot"></span>Station ${s.id}</span>
        ${tag(!s.available ? "Inactive" : s.currentId ? "Occupied" : "Available")}
      </button>`).join("")}
      <div class="notice">Station assignment and access permissions chuchu OSA smth</div>
    </section>`);
  }

  function home() {
    const s = store.myStation();
    if (!s) return selectStation();
    const a = store.current();
    const state = store.getState();
    const next = store.nextEligible();
    const status = !s.available ? "Unavailable" : a?.status === "called" ? "Awaiting Arrival" :
      a?.status === "in_service" ? "In Service" : state.lastCompletedId ? "Completed" : "Ready";

    let content = "";
    if (a?.status === "called") {
      content = `<div class="panel center">
        <div class="label">Current Queue Number</div><div class="number">${number(a.queue)}</div>
        <strong>${escape(a.fullName)}</strong><p class="small muted">${escape(a.service)}</p>
        <hr style="border:0;border-top:1px solid #eee;margin:17px 0">
        <div class="label">Arrival Deadline</div>
        <div class="timer" data-countdown="${escape(a.id)}">${timer(a.deadline - Date.now())}</div>
      </div>${button("Confirm Student Arrival", "confirmArrival", true)}
      ${button("Mark Not Arrived — Move to Standby", "moveStandby")}
      <div class="notice">The five-minute grace period started when the student was called. Moving them to standby does not restart it.</div>`;
    } else if (a?.status === "in_service") {
      content = `<div class="panel center"><div class="label">Current Student</div>
        <div class="number">${number(a.queue)}</div><strong>${escape(a.fullName)}</strong>
        <p class="small muted">${escape(a.studentId)}</p><p class="small">${escape(a.service)}</p></div>
        <div class="panel center"><div class="label">Service Timer</div>
        <div class="timer" data-elapsed="${escape(a.id)}">${timer(Date.now() - a.serviceStartedAt)}</div>
        <span class="tiny muted">Target duration: 05:00</span></div>
        ${button("Complete Service", "completeService", true)}
        ${button("Report Issue", "openIssue")}
        ${button("View Student Information & Requirements", "openStudent")}`;
    } else if (state.lastCompletedId) {
      const completed = store.find(state.lastCompletedId);
      content = `<div class="panel center" style="padding:25px 12px">
        <div class="number">✓</div><h2 class="heading">Service Completed</h2>
        <p class="small">Queue ${completed ? number(completed.queue) : "—"}</p>
        <p class="small muted">The service is marked completed in this local UI session.</p></div>
        ${button("Ready for Next Student", "readyNext", true)}`;
    } else {
      content = `<div class="panel center" style="padding:28px 12px">
        <div class="label">Current Student</div><div class="number">—</div>
        <p class="small muted">No student assigned</p></div>
        ${s.available ? button("Call Next Student", "callNext", true) : button("Set Station Available", "toggleAvailability", true)}
        ${s.available ? button("Set Station Unavailable", "toggleAvailability") : ""}
        <div class="panel"><div class="label">Next Eligible Queue</div>
        <div class="number" style="font-size:25px">${next ? number(next.queue) : "—"}</div>
        <div class="small muted">${next ? store.isGraduate(next) ? "Graduate Studies — Priority" :
          next.status === "returned" ? "Returned Student — Priority" : "Waiting" :
          "Waiting for appointments in the current time slot"}</div></div>`;
    }

    return layout(`<section class="card"><div class="row"><div class="column">
      <h1 class="heading" style="margin-bottom:0">Station ${s.id}</h1>
      <span class="small muted">Camera Operator</span></div>${tag(status)}</div>
      <div style="margin-top:14px">${content}</div></section>`, "home");
  }

  function queue() {
    store.expireDeadlines();
    const state = store.getState();
    const today = store.today();
    const waiting = state.appointments.filter(a => a.appointmentDate === today && a.status === "waiting")
      .sort((a, b) => Number(!store.isGraduate(a)) - Number(!store.isGraduate(b)) || a.queue - b.queue);
    const standby = state.appointments.filter(a => a.status === "standby");
    const returned = state.appointments.filter(a => a.status === "returned");
    const missed = state.appointments.filter(a => a.status === "missed" && a.appointmentDate === today);

    return layout(`<section class="card"><div class="row"><h1 class="heading">Queue Overview</h1>${tag("Today")}</div>
      <div class="stations">${state.stations.map(s => {
        const active = store.find(s.currentId);
        return `<div class="station"><div class="tiny">Station ${s.id}</div>
          <strong>${active ? number(active.queue) : "—"}</strong>
          <span>${!s.available ? "Inactive" : active?.status === "called" ? "Awaiting Arrival" : active ? "Serving" : "Ready"}</span></div>`;
      }).join("")}</div>
      <div class="panel"><div class="row"><strong class="small">Waiting Queue</strong>
        <span class="tiny muted">${waiting.length} students</span></div>
        ${waiting.length ? waiting.slice(0, 8).map(a => `<div class="queue-item">
          <strong>Queue ${number(a.queue)}</strong><span class="muted">
          ${!store.isEligible(a) ? store.isGraduate(a) ? "Graduate · Scheduled" : "Scheduled" : store.isGraduate(a) ? "Graduate Priority" : "Waiting"}</span>
        </div>`).join("") : `<p class="small muted">No booked students in today's waiting queue yet.</p>`}
      </div>
      <div class="panel"><div class="row"><strong class="small">Standby / Grace Period</strong>
        ${tag(`${standby.length} Pending`)}</div>
        ${standby.slice(0, 4).map(a => `<div class="queue-item">
          <span>Queue ${number(a.queue)}</span><strong data-countdown="${escape(a.id)}">${timer(a.deadline - Date.now())}</strong>
        </div>`).join("") || `<p class="small muted">No students on standby.</p>`}
        ${button("Manage Standby", "openStandby")}</div>
      <div class="action-row"><button class="button" data-page="returned">Returned (${returned.length})</button>
        <button class="button" data-page="missed">Missed (${missed.length})</button></div>
      <div class="notice">Graduate Studies students are prioritized within their eligible appointment period at any available station.</div>
    </section>`, "queue");
  }

  function standby() {
    store.expireDeadlines();
    const list = store.getState().appointments.filter(a => a.status === "standby");
    return layout(`<section class="card">${back("queue")}
      <h1 class="heading">Standby Management</h1>
      <p class="subtitle">Students who have not arrived after being called.</p>
      ${list.length ? list.map(a => `<div class="panel"><div class="row"><strong>Queue ${number(a.queue)}</strong>
        <span class="timer" style="font-size:18px" data-countdown="${escape(a.id)}">${timer(a.deadline - Date.now())}</span></div>
        <p class="small muted">Originally called: Station ${a.lastStationId || "—"}</p>
        <div class="row">${tag("Standby")}${store.isGraduate(a) ? tag("Graduate Studies") : ""}</div>
        <button class="button" data-action="markReturned" data-id="${escape(a.id)}">Mark Arrived</button></div>`).join("") :
        `<div class="notice">No students are currently on standby.</div>`}
      <div class="notice">Students who arrive before the original deadline return to the eligible queue. Otherwise, they are marked missed.</div>
    </section>`, "queue");
  }

  function returned() {
    const list = store.getState().appointments.filter(a => a.status === "returned");
    return layout(`<section class="card">${back("queue")}
      <h1 class="heading">Returned — Awaiting Reassignment</h1>
      ${list.length ? list.map(a => `<div class="panel"><div class="row">
        <strong>Queue ${number(a.queue)}</strong>${tag(store.isGraduate(a) ? "Graduate Priority" : "Eligible")}
      </div><p class="small muted">Station: Awaiting assignment</p></div>`).join("") :
        `<div class="notice">No returned students awaiting reassignment.</div>`}
      <p class="small muted">Returned students are called according to priority without interrupting an ongoing service.</p>
    </section>`, "queue");
  }

  function missed() {
    const list = store.getState().appointments.filter(a => a.status === "missed" && a.appointmentDate === store.today());
    return layout(`<section class="card">${back("queue")}
      <h1 class="heading">Missed Appointments</h1><p class="subtitle">Students whose grace period expired.</p>
      ${list.length ? list.map(a => `<div class="panel row"><strong>Queue ${number(a.queue)}</strong>${tag("Missed")}</div>`).join("") :
        `<div class="notice">No missed appointments today.</div>`}
      <p class="small muted">Rebooking is handled by the Student Module, not by the operator.</p>
    </section>`, "queue");
  }

  function student(appointment) {
    if (!appointment) return layout(`<section class="card">${back("home")}<p>No current student selected.</p></section>`, "home");
    return layout(`<section class="card">${back("home")}
      <div class="center"><div class="avatar">ID</div><h1 class="heading">${escape(appointment.fullName)}</h1>
        <p class="small muted">${escape(appointment.studentId)}</p>
        ${tag(appointment.requirementsVerified ? "Verified" : "Pending Verification")}</div>
      <div class="panel">${detail("Queue Number", number(appointment.queue))}
        ${detail("Service", appointment.service)}
        ${detail("Program", appointment.courseProgram)}
        ${detail("Year Level", appointment.yearLevel)}
        ${detail("Study Level", appointment.studyLevel)}
        ${detail("Appointment", `${appointment.appointmentDate} · ${appointment.timeSlot}`)}
        ${detail("Requirements", appointment.requirementsVerified ? "Verified" : "For Review")}</div>
      <button class="button" data-page="requirements">View Submitted Requirements</button>
    </section>`, "home");
  }

  function requirements(appointment) {
    if (!appointment) return student(null);
    const list = appointment.requirements;
    return layout(`<section class="card">${back("student")}
      <h1 class="heading">Submitted Requirements</h1>
      <p class="subtitle">Queue ${number(appointment.queue)} — ${escape(appointment.fullName)}</p>
      ${list.length ? list.map(item => `<div class="choice"><span>${escape(typeof item === "string" ? item : item.name || "Requirement")}</span>
        ${tag(appointment.requirementsVerified ? "Verified" : "For Review")}</div>`).join("") :
        `<div class="notice">No uploaded requirements are linked to this appointment yet. The booking form currently provides student details, not document uploads.</div>`}
      ${appointment.requirementsVerified ? `<div class="notice">Requirements have been checked.</div>` :
        button("Confirm Requirements Checked", "verifyRequirements", true)}
    </section>`, "home");
  }

  function issue(appointment) {
    if (!appointment) return student(null);
    return layout(`<section class="card">${back("home")}
      <h1 class="heading">Report Issue</h1>
      <p class="subtitle">Queue ${number(appointment.queue)} — Station ${store.getState().stationId}</p>
      <form id="issue-form"><div class="section-title">Issue Type</div>
        ${["Incomplete Requirements", "Student Information Mismatch", "Camera / Equipment Problem", "Other"].map((name, index) =>
          `<label class="radio"><input type="radio" name="issueType" value="${escape(name)}" ${index === 0 ? "checked" : ""}>${escape(name)}</label>`).join("")}
        <div class="field"><label for="issue-notes">Additional Notes</label>
          <textarea id="issue-notes" name="notes" placeholder="Describe the issue..."></textarea></div>
        <button class="button primary" type="submit">Submit Issue</button></form>
      ${button("Cancel", "openHome")}
    </section>`, "home");
  }

  function profile() {
    const state = store.getState();
    return layout(`<section class="card"><h1 class="heading">My Profile</h1>
      <div class="center"><div class="avatar">OP</div><strong>Camera Operator</strong>
      <p class="small muted">Assigned Station: ${state.stationId || "None"}</p>
      ${tag(state.stationId ? "Active Session" : "No Active Session")}</div>
      <div class="panel">${detail("Station", state.stationId ? `Station ${state.stationId}` : "Not assigned")}
      ${detail("Session Started", state.sessionStartedAt ? new Date(state.sessionStartedAt).toLocaleString() : "Not started")}</div>
      <button class="choice" data-page="stationChange">Request Station Change <span>›</span></button>
      <label class="choice"><span>Notification Preference</span>
        <input type="checkbox" id="notification-toggle" ${state.notifications ? "checked" : ""}></label>
      <div class="notice">Your name, login, and real notification delivery will be provided by the shared authentication and backend modules later.</div>
      ${button("End Station Session", "endSession")}
    </section>`, "profile");
  }

  function stationChange() {
    const state = store.getState();
    return layout(`<section class="card">${back("profile")}
      <h1 class="heading">Request Station Change</h1>
      <p class="subtitle">Current station: ${state.stationId}. This request is stored locally until the admin workflow is connected.</p>
      <form id="station-change-form"><div class="field"><label for="requested-station">Requested Station</label>
        <select id="requested-station" name="station" required><option value="">Choose station</option>
        ${state.stations.filter(s => s.id !== state.stationId).map(s =>
          `<option value="${s.id}">Station ${s.id}${!s.available ? " — Inactive" : s.currentId ? " — Occupied" : ""}</option>`).join("")}
        </select></div><button class="button primary" type="submit">Save Request Draft</button></form>
      ${state.stationChangeRequest ? `<div class="notice">Saved draft: Request Station ${state.stationChangeRequest}. Not yet sent to an administrator.</div>` : ""}
    </section>`, "profile");
  }

  function render(page, context = {}) {
    const appointment = store.find(context.appointmentId) || store.current();
    const screens = {
      station: selectStation, home, queue, standby, returned, missed,
      student: () => student(appointment),
      requirements: () => requirements(appointment),
      issue: () => issue(appointment),
      profile, stationChange
    };
    return (screens[page] || selectStation)();
  }

  return { render, timer };
})();
