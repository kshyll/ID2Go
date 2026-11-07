
(() => {
  "use strict";

  const STORAGE_KEY = "id2go_operator_demo_v3";
  const GRACE_MS = 5 * 60 * 1000;
  const $ = id => document.getElementById(id);

  const initialState = () => ({
    stationId: 1,
    sessionActive: false,
    currentId: null,
    lastCompletedId: null,
    students: [
      {
        id: "S001",
        queue: 31,
        name: "Student A",
        studentId: "2024-0001",
        service: "First-Time ID Picture Taking",
        level: "Undergraduate",
        status: "waiting",
        verified: false,
        deadline: null
      },
      {
        id: "S002",
        queue: 32,
        name: "Student B",
        studentId: "2024-0002",
        service: "First-Time ID Picture Taking",
        level: "Graduate Studies",
        status: "waiting",
        verified: false,
        deadline: null
      },
      {
        id: "S003",
        queue: 33,
        name: "Student C",
        studentId: "2024-0003",
        service: "ID Replacement",
        level: "Undergraduate",
        status: "waiting",
        verified: false,
        deadline: null
      },
      {
        id: "S004",
        queue: 34,
        name: "Student D",
        studentId: "2024-0004",
        service: "First-Time ID Picture Taking",
        level: "Graduate Studies",
        status: "waiting",
        verified: false,
        deadline: null
      },
      {
        id: "S005",
        queue: 35,
        name: "Student E",
        studentId: "2024-0005",
        service: "First-Time ID Picture Taking",
        level: "Undergraduate",
        status: "waiting",
        verified: false,
        deadline: null
      }
    ]
  });

  const loadState = () => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "null"
      );

      if (saved && Array.isArray(saved.students)) {
        return saved;
      }
    } catch (error) {
      console.warn("Starting a new demo session.", error);
    }

    return initialState();
  };

  let state = loadState();
  let activeView = "dashboard";
  let activeFilter = "waiting";
  let toastTimeout = null;

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const notify = message => {
    const toast = $("operator-toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  };

  const formatQueue = value => String(value).padStart(3, "0");

  const currentStudent = () =>
    state.students.find(s => s.id === state.currentId) || null;

  const isGraduate = student =>
    student.level === "Graduate Studies";

  const eligibleStudents = () =>
    state.students
      .filter(s => ["waiting", "returned"].includes(s.status))
      .sort((a, b) =>
        Number(!isGraduate(a)) - Number(!isGraduate(b)) ||
        a.queue - b.queue
      );

  const updateDeadlines = () => {
    let changed = false;

    state.students.forEach(student => {
      if (
        ["called", "standby"].includes(student.status) &&
        student.deadline &&
        Date.now() >= student.deadline
      ) {
        student.status = "missed";
        student.deadline = null;

        if (state.currentId === student.id) {
          state.currentId = null;
        }

        changed = true;
      }
    });

    if (changed) save();
    return changed;
  };

  const showView = view => {
    activeView = view;

    document.querySelectorAll(".view").forEach(section => {
      section.classList.toggle(
        "active",
        section.id === `${view}-view`
      );
    });

    const titles = {
      dashboard: "Operator Dashboard",
      workspace: "Station Workspace",
      queue: "Queue Management",
      account: "Operator Account"
    };

    $("page-title").textContent = titles[view];

    document.querySelectorAll(".nav-item").forEach(button => {
      const selected =
        button.dataset.view === view ||
        (view === "workspace" &&
         button.dataset.view === "dashboard");

      button.classList.toggle("active", selected);
    });

    window.scrollTo(0, 0);
    render();
  };

  const startSession = () => {
    state.sessionActive = true;
    save();
    showView("workspace");
    notify("Station session started.");
  };

  const endSession = () => {
    if (currentStudent()) {
      notify("Complete the current student first.");
      return;
    }

    state.sessionActive = false;
    state.lastCompletedId = null;
    save();
    showView("dashboard");
    notify("Station session ended.");
  };

  const callNext = () => {
    updateDeadlines();

    if (!state.sessionActive || currentStudent()) {
      notify("Station is not ready.");
      return;
    }

    const next = eligibleStudents()[0];

    if (!next) {
      notify("No students are waiting.");
      return;
    }

    next.status = "called";
    next.deadline = Date.now() + GRACE_MS;
    state.currentId = next.id;
    state.lastCompletedId = null;

    save();
    render();
    notify(`Queue ${formatQueue(next.queue)} called.`);
  };

  const confirmArrival = () => {
    updateDeadlines();

    const student = currentStudent();

    if (!student || student.status !== "called") {
      notify("No student awaiting arrival.");
      return;
    }

    student.status = "in_service";
    student.deadline = null;
    save();
    render();
    notify("Arrival confirmed.");
  };

  const moveToStandby = () => {
    updateDeadlines();

    const student = currentStudent();

    if (!student || student.status !== "called") return;

    student.status = "standby";
    state.currentId = null;

    save();
    render();
    notify("Student moved to standby.");
  };

  const verifyStudent = () => {
    const student = currentStudent();

    if (!student || student.status !== "in_service") return;

    const confirmed = window.confirm(
      `Verify requirements for ${student.name}?\n` +
      `Student ID: ${student.studentId}\n` +
      `Service: ${student.service}`
    );

    if (!confirmed) return;

    student.verified = true;
    save();
    render();
    notify("Requirements verified.");
  };

  const completeService = () => {
    const student = currentStudent();

    if (!student || student.status !== "in_service") return;

    if (!student.verified) {
      notify("Verify requirements first.");
      return;
    }

    if (!window.confirm(
      `Complete service for Queue ${formatQueue(student.queue)}?`
    )) return;

    student.status = "completed";
    state.currentId = null;
    state.lastCompletedId = student.id;

    save();
    render();
    notify("Service completed.");
  };

  const readyNext = () => {
    state.lastCompletedId = null;
    save();
    render();
  };

  const markReturned = id => {
    updateDeadlines();

    const student = state.students.find(s => s.id === id);

    if (!student || student.status !== "standby") {
      notify("Grace period has expired.");
      return;
    }

    student.status = "returned";
    student.deadline = null;

    save();
    render();
    notify("Student returned to queue.");
  };

  const renderDashboard = () => {
    const active = state.sessionActive;

    $("assigned-station").textContent =
      `Station ${String(state.stationId).padStart(2, "0")}`;

    $("session-badge").textContent =
      active ? "Active" : "Not Started";

    $("session-status").textContent =
      active ? "Active Session" : "Inactive";

    $("station-availability").textContent =
      active ? "Available" : "Offline";

    $("start-session").hidden = active;
    $("open-workspace").hidden = !active;

    $("stat-scheduled").textContent = state.students.length;

    $("stat-waiting").textContent = state.students.filter(s =>
      ["waiting", "returned", "called", "standby"].includes(s.status)
    ).length;

    $("stat-completed").textContent = state.students.filter(
      s => s.status === "completed"
    ).length;

    $("stat-missed").textContent = state.students.filter(
      s => s.status === "missed"
    ).length;

    const stations = [
      {
        number: 1,
        status: active ? "Available" : "Offline",
        color: active ? "available" : ""
      },
      {
        number: 2,
        status: "Available",
        color: "available"
      },
      {
        number: 3,
        status: "Serving",
        color: "busy"
      },
      {
        number: 4,
        status: "Available",
        color: "available"
      }
    ];

    if (active && currentStudent()) {
      stations[0].status = "Serving";
      stations[0].color = "busy";
    }

    const list = $("station-list");
    list.replaceChildren();

    stations.forEach(station => {
      const row = document.createElement("div");
      row.className = "station-row";

      const name = document.createElement("strong");
      name.className = "station-name";
      name.textContent =
        `Station ${String(station.number).padStart(2, "0")}`;

      const status = document.createElement("span");
      status.className = "station-state";

      const dot = document.createElement("span");
      dot.className = `status-dot ${station.color}`;

      status.append(dot, document.createTextNode(station.status));
      row.append(name, status);
      list.appendChild(row);
    });
  };

  const renderWorkspace = () => {
    const student = currentStudent();

    $("workspace-station").textContent =
      `Station ${state.stationId}`;

    $("current-queue").textContent =
      student ? formatQueue(student.queue) : "—";

    $("current-name").textContent = student
      ? student.name
      : state.lastCompletedId
        ? "Service Completed"
        : "No Student Assigned";

    $("current-service").textContent = student
      ? student.service
      : "Ready to call the next student";

    $("current-id").textContent = student?.studentId || "—";
    $("current-level").textContent = student?.level || "—";

    const status = student?.status ||
      (state.lastCompletedId ? "completed" : "ready");

    const labels = {
      ready: "Ready",
      called: "Awaiting Arrival",
      in_service: "In Service",
      completed: "Completed"
    };

    $("student-status").textContent = labels[status] || status;

    $("call-next").hidden =
      !!student || !!state.lastCompletedId || !state.sessionActive;

    $("confirm-arrival").hidden = status !== "called";
    $("move-standby").hidden = status !== "called";
    $("verify-student").hidden = status !== "in_service";
    $("complete-service").hidden = status !== "in_service";
    $("ready-next").hidden = !state.lastCompletedId || !!student;

    $("verify-student").disabled = !!student?.verified;
    $("verify-student").textContent = student?.verified
      ? "Requirements Verified"
      : "Verify Student Requirements";

    $("complete-service").disabled = !student?.verified;

    if (status === "called" && student.deadline) {
      const remaining = Math.max(
        0,
        Math.ceil((student.deadline - Date.now()) / 1000)
      );

      const minutes = String(
        Math.floor(remaining / 60)
      ).padStart(2, "0");

      const seconds = String(
        remaining % 60
      ).padStart(2, "0");

      $("arrival-timer").textContent = `${minutes}:${seconds}`;
    } else {
      $("arrival-timer").textContent = "—";
    }
  };

  const renderQueue = () => {
    const list = $("queue-list");
    list.replaceChildren();

    const students = state.students
      .filter(s => {
        if (activeFilter === "waiting") {
          return ["waiting", "returned"].includes(s.status);
        }
        return s.status === activeFilter;
      })
      .sort((a, b) => a.queue - b.queue);

    if (!students.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = `No ${activeFilter} students.`;
      list.appendChild(empty);
      return;
    }

    students.forEach(student => {
      const entry = document.createElement("div");
      entry.className = "queue-entry";

      const header = document.createElement("div");
      header.className = "queue-entry-header";

      const queue = document.createElement("strong");
      queue.textContent = `Queue ${formatQueue(student.queue)}`;

      const badge = document.createElement("span");
      badge.className = "status-badge";
      badge.textContent = isGraduate(student)
        ? "Graduate Priority"
        : student.status.replace("_", " ");

      header.append(queue, badge);

      const name = document.createElement("p");
      name.textContent = `${student.name} · ${student.studentId}`;

      const service = document.createElement("p");
      service.textContent = student.service;

      entry.append(header, name, service);

      if (student.status === "standby") {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Mark Arrived";
        button.addEventListener("click", () => {
          markReturned(student.id);
        });
        entry.appendChild(button);
      }

      list.appendChild(entry);
    });
  };

  const renderAccount = () => {
    $("account-station").textContent =
      `Station ${state.stationId}`;

    $("account-session").textContent =
      state.sessionActive ? "Active" : "Inactive";

    $("end-session").disabled = !state.sessionActive;
  };

  const render = () => {
    updateDeadlines();
    renderDashboard();
    renderWorkspace();
    renderQueue();
    renderAccount();
  };

  const bindEvents = () => {
    document.querySelectorAll(".nav-item").forEach(button => {
      button.addEventListener("click", () => {
        showView(button.dataset.view);
      });
    });

    document.querySelectorAll(".filter-btn").forEach(button => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;

        document.querySelectorAll(".filter-btn").forEach(item => {
          item.classList.toggle("active", item === button);
        });

        renderQueue();
      });
    });

    $("start-session").addEventListener("click", startSession);
    $("open-workspace").addEventListener("click", () => showView("workspace"));
    $("workspace-back").addEventListener("click", () => showView("dashboard"));
    $("call-next").addEventListener("click", callNext);
    $("confirm-arrival").addEventListener("click", confirmArrival);
    $("move-standby").addEventListener("click", moveToStandby);
    $("verify-student").addEventListener("click", verifyStudent);
    $("complete-service").addEventListener("click", completeService);
    $("ready-next").addEventListener("click", readyNext);
    $("end-session").addEventListener("click", endSession);

    $("operator-logout").addEventListener("click", () => {
      if (currentStudent()) {
        notify("Finish the current student first.");
        return;
      }

      if (state.sessionActive) {
        notify("End your station session first.");
        return;
      }

      window.location.href = "index.html";
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    showView("dashboard");

    setInterval(() => {
      const expired = updateDeadlines();

      if (expired) {
        notify("An arrival grace period expired.");
      }

      if (activeView === "workspace" || expired) {
        render();
      }
    }, 1000);
  });
})();
