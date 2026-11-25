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
  let fresh = false;
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
    if (view === "dashboard") view = "workspace";
    document.querySelectorAll(".view").forEach(section => {
      section.classList.toggle(
        "active",
        section.id === `${view === "overview" ? "dashboard" : view}-view`
      );
    });

    document.querySelectorAll(".nav-item").forEach(button => {
      const active = button.dataset.view === view ||
        (["workspace","overview"].includes(view) &&
         button.dataset.view === "dashboard");

      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    const headings = {
      overview: "Station overview",
      workspace: "My station",
      queue: "Queue List",
      account: "Operator Profile"
    };

    $("page-title").textContent = headings[view] || "Operator";

    const descriptions = {
      dashboard: "Manage student queues and ID processing.",
      workspace: "Today’s service queue · Manila time",
      queue: "Today’s tickets and upcoming reservations",
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

    $("shift").disabled = !station || busy || !fresh;
    $("shift").textContent = station?.status === "offline" ? "Open station for today" : "Close station";
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

    timer.textContent = `${minutes}:${remaining}`;

    if (seconds === 0) {
      timer.textContent = "Time expired";
    }
  };

  // Display the student assigned to this station.
  const renderWorkspace = () => {
    $("current-queue").textContent =
      formatQueue(current?.queue_number);

    $("current-details").hidden = !current;
    $("current-name").textContent = current?.student_name || "";
    $("current-service").textContent = current?.service_name || "";
    const station = dashboard?.station;
    const hint = $("station-hint");
    const ready = queue.filter(student => student.eligible).length;
    const standby = queue.filter(student => student.status === "standby").length;
    $("desk-ready").textContent = fresh ? ready : "—";
    $("desk-standby").textContent = fresh ? standby : "—";
    $("desk-done").textContent = fresh ? dashboard?.stats?.completed ?? "—" : "—";
    $("desk-status").textContent = !fresh ? "Unavailable" : !station ? "Unassigned" :
      station.status === "offline" ? "Closed" : current ? "Serving" : "Open";
    const scheduled = queue.filter(s => s.status === "waiting" && s.eligible === false);
    hint.textContent = !fresh ? "Queue information is unavailable." :
      !station ? "Ask your administrator to assign a camera station." :
      station.status === "offline" ? "Open your station to start calling students." :
      ready ? "Call the next student in queue order." :
      scheduled.length ? "Next booked slot: " + scheduled[0].slot :
      "No students are ready to call. New arrivals appear here automatically.";
    hint.hidden = !!current;

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
      busy || !fresh || $("open-workspace").disabled || !(queue.some(s => s.eligible) || (!queue.some(s => "eligible" in s) && dashboard?.stats?.waiting > 0));

    $("confirm-arrival").disabled = busy || !fresh;
    $("move-standby").disabled = busy || !fresh;
    $("complete-service").disabled = busy || !fresh;

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

    const standby = queue.filter(student => student.status === "standby");

    $("standby-list").replaceChildren();
    if (!standby.length) $("standby-list").textContent = fresh ? "No students on standby." : "Standby list unavailable.";
    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No students in this category.";
      list.appendChild(empty);
    }

    [...filtered, ...standby].forEach(student => {
      const entry = document.createElement("div");
      entry.className = "queue-entry";

      const title = document.createElement("strong");
      title.textContent =
        `Queue ${formatQueue(student.queue_number)}`;

      const name = document.createElement("p");
      name.textContent =
        student.student_name || "Reserved";

      const details = document.createElement("p");
      details.textContent = [
        student.service_name,
        student.date, student.slot, student.status === "waiting" && student.eligible === false ? "Scheduled" : ""
      ].filter(Boolean).join(" · ");

      entry.append(title, name, details);

      if (student.status === "standby") {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = "Mark Returned";
        button.disabled = busy || !fresh || $("open-workspace").disabled;

        button.addEventListener("click", () => {
          runAction(() => {
            return service.markReturned(student.id);
          });
        });

        entry.appendChild(button);
      }

      (student.status === "standby" ? $("standby-list") : list).appendChild(entry);
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

      fresh = true;
      dashboard = dashboardData;
      queue = queueData;
      current = dashboardData.current || null;

      render();
    } catch (error) {
      fresh = false;
      render();
      throw error;
    } finally {
      loading = false;
    }
  };

  // Run an operator action and refresh the screen.
  const runAction = async action => {
    if (busy || !fresh) {
      return;
    }

    while (loading) await new Promise(resolve => setTimeout(resolve, 30));
    if (busy || !fresh) return;
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
    $("shift").addEventListener("click", () => {
      const open = dashboard?.station?.status === "offline";
      runAction(() => service.shift(open));
    });
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
      showView("overview");
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

      const ticket = current.id;
      runAction(() => service.completeService(ticket));
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

      showView("workspace");
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