(() => {
  "use strict";

  const service = window.OperatorQueueService;
  const $ = id => document.getElementById(id);

  let dashboard = null;
  let queue = [];
  let current = null;
  let activeFilter = "waiting";
  let busy = false;
  let loading = false;
  let refreshTimer = null;
  let countdownTimer = null;

  // Display feedback to the operator.
  const showMessage = (message, isError = false) => {
    $("operator-feedback").textContent = message;
    $("operator-feedback").classList.toggle("error", isError);
  };

  // Display queue numbers with at least three digits.
  const formatQueue = value => {
    if (value === null || value === undefined) {
      return "—";
    }

    return String(value).padStart(3, "0");
  };

  // Change the visible screen.
  const showView = view => {
    document.querySelectorAll(".view").forEach(section => {
      section.classList.toggle(
        "active",
        section.id === ${view}-view
      );
    });

    document.querySelectorAll(".nav-item").forEach(button => {
      const active = button.dataset.view === view ||
        (view === "workspace" &&
         button.dataset.view === "dashboard");

      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    const headings = {
      dashboard: "Operator Dashboard",
      workspace: "Queue Workspace",
      queue: "Queue List",
      account: "Operator Profile"
    };

    $("page-title").textContent = headings[view] || "Operator";

    const descriptions = {
      dashboard: "Manage student queues and ID processing.",
      workspace: "Process the student assigned to your station.",
      queue: "View students according to their queue status.",
      account: "View your account and assigned station."
    };

    $("page-subtitle").textContent = descriptions[view] || "";

    window.scrollTo(0, 0);
  };

  // Display the station and daily statistics.
  const renderDashboard = () => {
    const station = dashboard?.station;
    const stats = dashboard?.stats || {};

    $("assigned-station").textContent =
      station?.name || "No station assigned";

    $("station-status").textContent =
      station?.status || "Unavailable";

    const available = station &&
      ["available", "serving"].includes(station.status);

    $("open-workspace").disabled = !available || busy;

    $("workspace-station").textContent =
      station?.name || "No Station";

    $("account-station").textContent =
      station?.name || "Not Assigned";

    const values = {
      "stat-waiting": stats.waiting,
      "stat-serving": stats.in_service,
      "stat-completed": stats.completed,
      "stat-missed": stats.missed
    };

    Object.entries(values).forEach(([id, value]) => {
      $(id).textContent = Number.isInteger(value)
        ? String(value)
        : "—";
    });
  };

  // Update the five-minute arrival countdown.
  const updateCountdown = () => {
    const timer = $("arrival-timer");

    if (!current ||
        current.status !== "called" ||
        !current.arrival_deadline) {
      timer.textContent = "—";
      return;
    }

    const deadline = new Date(
      current.arrival_deadline
    ).getTime();

    if (Number.isNaN(deadline)) {
      timer.textContent = "—";
      return;
    }

    const seconds = Math.max(
      0,
      Math.ceil((deadline - Date.now()) / 1000)
    );

    const minutes = String(
      Math.floor(seconds / 60)
    ).padStart(2, "0");

    const remaining = String(
      seconds % 60
    ).padStart(2, "0");

    timer.textContent = ${minutes}:${remaining};

    if (seconds === 0) {
      timer.textContent = "Time expired";
    }
  };

  // Display the student assigned to this station.
  const renderWorkspace = () => {
    $("current-queue").textContent =
      formatQueue(current?.queue_number);

    $("current-name").textContent =
      current?.student_name || "No Student Called";

    $("current-service").textContent =
      current?.service_name || "Ready for next student";

    $("current-id").textContent =
      current?.student_number || "—";

    $("current-level").textContent =
      current?.study_level || "—";

    const status = current?.status || "ready";

    const labels = {
      ready: "Ready",
      waiting: "Waiting",
      returned: "Returned",
      called: "Awaiting Arrival",
      in_service: "In Service",
      standby: "Standby",
      completed: "Completed",
      missed: "Missed"
    };

    $("student-status").textContent =
      labels[status] || status;

    $("call-next").hidden = !!current;
    $("confirm-arrival").hidden = status !== "called";
    $("move-standby").hidden = status !== "called";
    $("complete-service").hidden = status !== "in_service";

    $("call-next").disabled =
      busy || $("open-workspace").disabled;

    $("confirm-arrival").disabled = busy;
    $("move-standby").disabled = busy;
    $("complete-service").disabled = busy;

    updateCountdown();
  };

  // Display the queue list.
  const renderQueue = () => {
    const list = $("queue-list");
    list.replaceChildren();

    const filtered = queue.filter(student => {
      if (activeFilter === "waiting") {
        return ["waiting", "returned"].includes(
          student.status
        );
      }

      return student.status === activeFilter;
    });

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No students in this category.";
      list.appendChild(empty);
      return;
    }

    filtered.forEach(student => {
      const entry = document.createElement("div");
      entry.className = "queue-entry";

      const title = document.createElement("strong");
      title.textContent =
        Queue ${formatQueue(student.queue_number)};

      const name = document.createElement("p");
      name.textContent =
        student.student_name || "Student";

      const details = document.createElement("p");
      details.textContent = [
        student.service_name,
        student.study_level
      ].filter(Boolean).join(" · ");

      entry.append(title, name, details);

      if (student.status === "standby") {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = "Mark Returned";
        button.disabled = busy;

        button.addEventListener("click", () => {
          runAction(() => {
            return service.markReturned(student.id);
          });
        });

        entry.appendChild(button);
      }

      list.appendChild(entry);
    });
  };

  const render = () => {
    renderDashboard();
    renderWorkspace();
    renderQueue();
  };

  // Get the latest queue information from Supabase.
  const refresh = async () => {
    if (loading) {
      return;
    }

    loading = true;

    try {
      const results = await Promise.all([
        service.getDashboard(),
        service.getQueue()
      ]);

      const dashboardData = results[0];
      const queueData = results[1];

      if (!dashboardData || !Array.isArray(queueData)) {
        throw new Error("Invalid queue information.");
      }

      dashboard = dashboardData;
      queue = queueData;
      current = dashboardData.current || null;

      render();
    } finally {
      loading = false;
    }
  };

  // Run an operator action and refresh the screen.
  const runAction = async action => {
    if (busy || loading) {
      return;
    }

    busy = true;
    render();

    try {
      await action();
      await refresh();
      showMessage("Queue updated successfully.");
    } catch (error) {
      console.error(error);
      showMessage(
        error.message || "Unable to update the queue.",
        true
      );
    } finally {
      busy = false;
      render();
    }
  };

  // Connect buttons to their functions.
  const bindEvents = () => {
    document.querySelectorAll(".nav-item").forEach(button => {
      button.addEventListener("click", () => {
        showView(button.dataset.view);
      });
    });

    document.querySelectorAll(".filter-btn").forEach(button => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;

        document.querySelectorAll(".filter-btn")
          .forEach(item => {
            const selected = item === button;

            item.classList.toggle("active", selected);
            item.setAttribute(
              "aria-pressed",
              String(selected)
            );
          });

        renderQueue();
      });
    });

    $("open-workspace").addEventListener("click", () => {
      if (!$("open-workspace").disabled) {
        showView("workspace");
      }
    });

    $("workspace-back").addEventListener("click", () => {
      showView("dashboard");
    });

    $("refresh-dashboard").addEventListener("click", async () => {
      try {
        await refresh();
        showMessage("Queue refreshed.");
      } catch (error) {
        showMessage("Unable to refresh queue.", true);
      }
    });

    $("refresh-queue").addEventListener("click", async () => {
      try {
        await refresh();
        showMessage("Queue refreshed.");
      } catch (error) {
        showMessage("Unable to refresh queue.", true);
      }
    });

    $("call-next").addEventListener("click", () => {
      runAction(service.callNext);
    });

    $("confirm-arrival").addEventListener("click", () => {
      if (current) {
        runAction(() => service.confirmArrival(current.id));
      }
    });

    $("move-standby").addEventListener("click", () => {
      if (current) {
        runAction(() => service.moveToStandby(current.id));
      }
    });

    $("complete-service").addEventListener("click", () => {
      if (!current) {
        return;
      }

      const confirmed = window.confirm(
        "Complete this student's ID service?"
      );

      if (confirmed) {
        runAction(() => service.completeService(current.id));
      }
    });

    $("operator-logout").addEventListener("click", async () => {
      if (!window.confirm("Sign out of ID2Go?")) {
        return;
      }

      $("operator-logout").disabled = true;

      try {
        await service.signOut();
      } catch (error) {
        showMessage(
          error.message || "Unable to sign out.",
          true
        );

        $("operator-logout").disabled = false;
      }
    });
  };

  // Start the operator application.
  const initialize = async () => {
    bindEvents();

    try {
      const user = await service.getOperator();

      $("operator-name").textContent =
        user.user_metadata?.full_name || "Camera Operator";

      $("operator-email").textContent =
        user.email || "—";

      await refresh();
      showMessage("");

    } catch (error) {
      console.error(error);

      showMessage(
        error.message || "Unable to load operator dashboard.",
        true
      );

      $("open-workspace").disabled = true;
      $("call-next").disabled = true;
      return;
    }

    // Refresh the data every 15 seconds.
    refreshTimer = setInterval(async () => {
      if (busy || loading) {
        return;
      }

      try {
        await refresh();
      } catch (error) {
        showMessage("Unable to refresh queue.", true);
      }
    }, 15000);

    // Update the countdown every second.
    countdownTimer = setInterval(
      updateCountdown,
      1000
    );
  };

  // Stop timers when the page closes.
  window.addEventListener("pagehide", () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    if (countdownTimer) {
      clearInterval(countdownTimer);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();