(() => {
  "use strict";

  const service = window.OperatorQueueService;
  const $ = id => document.getElementById(id);

  let dashboard = null;
  let queue = [];
  let current = null;
  let activeView = "dashboard";
  let activeFilter = "waiting";
  let busy = false;
  let refreshTimer = null;

  const setFeedback = (message, error = false) => {
    $("operator-feedback").textContent = message;
    $("operator-feedback").classList.toggle("error", error);
  };

  const formatQueue = value =>
    value == null ? "—" : String(value).padStart(3, "0");

  const showView = view => {
    activeView = view;

    document.querySelectorAll(".view").forEach(section => {
      section.classList.toggle(
        "active",
        section.id === ${view}-view
      );
    });

    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.view === view ||
        (view === "workspace" &&
         button.dataset.view === "dashboard")
      );
    });

    $("page-subtitle").textContent = {
      dashboard: "Queue Management Dashboard",
      workspace: "Student Processing Workspace",
      queue: "Queue Management",
      account: "Operator Account"
    }[view];

    window.scrollTo(0, 0);
  };

  const renderDashboard = () => {
    const station = dashboard?.station;
    const stats = dashboard?.stats || {};

    $("assigned-station").textContent =
      station?.name || "No station assigned";

    $("station-status").textContent =
      station?.status || "Unavailable";

    $("open-workspace").disabled =
      !station || station.status !== "available" &&
      station.status !== "serving";

    const values = {
      "stat-waiting": stats.waiting,
      "stat-serving": stats.in_service,
      "stat-completed": stats.completed,
      "stat-missed": stats.missed
    };

    Object.entries(values).forEach(([id, value]) => {
      $(id).textContent =
        Number.isInteger(value) ? value : "—";
    });

    $("workspace-station").textContent =
      station?.name || "No Station";
    $("account-station").textContent =
      station?.name || "Not Assigned";
  };

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

    if (status === "called" && current?.arrival_deadline) {
      const seconds = Math.max(
        0,
        Math.ceil(
          (new Date(current.arrival_deadline).getTime() -
           Date.now()) / 1000
        )
      );

      const minutes = String(
        Math.floor(seconds / 60)
      ).padStart(2, "0");

      const remainder = String(
        seconds % 60
      ).padStart(2, "0");

      $("arrival-timer").textContent =
        ${minutes}:${remainder};
    } else {
      $("arrival-timer").textContent = "—";
    }
  };

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

    if (!filtered.length) {
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
      name.textContent = student.student_name || "Student";

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
          runAction(() =>
            service.markReturned(student.id)
          );
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

  const refresh = async () => {
    const [dashboardData, queueData] = await Promise.all([
      service.getDashboard(),
      service.getQueue()
    ]);

    if (
      !dashboardData ||
      !Array.isArray(queueData)
    ) {
      throw new Error("Invalid queue data received.");
    }

    dashboard = dashboardData;
    queue = queueData;
    current = dashboardData.current || null;

    render();
  };

  const runAction = async action => {
    if (busy) return;

    busy = true;
    renderWorkspace();

    try {
      await action();
      await refresh();
      setFeedback("Queue updated successfully.");
    } catch (error) {
      setFeedback(error.message, true);
      console.error(error);
    } finally {
      busy = false;
      render();
    }
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
          item.classList.toggle(
            "active",
            item === button
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

    $("refresh-dashboard").addEventListener("click", () => {
      runAction(async () => {});
    });

    $("refresh-queue").addEventListener("click", () => {
      runAction(async () => {});
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
      if (!current) return;

      if (window.confirm("Complete this student's ID service?")) {
        runAction(() => service.completeService(current.id));
      }
    });

    $("operator-logout").addEventListener("click", async () => {
      try {
        await service.signOut();
      } catch (error) {
        setFeedback(error.message, true);
      }
    });
  };

  const initialize = async () => {
    bindEvents();

    try {
      const user = await service.getOperator();

      $("operator-name").textContent =
        user.user_metadata?.full_name || "Camera Operator";

      $("operator-email").textContent =
        user.email || "—";

      await refresh();
      setFeedback("");
    } catch (error) {
      setFeedback(error.message, true);
      $("open-workspace").disabled = true;
      $("call-next").disabled = true;
      return;
    }

    refreshTimer = setInterval(async () => {
      if (busy) return;

      try {
        await refresh();
      } catch (error) {
        setFeedback("Unable to refresh queue.", true);
      }
    }, 15000);
  };

  window.addEventListener("pagehide", () => {
    if (refreshTimer) clearInterval(refreshTimer);
  });

  document.addEventListener("DOMContentLoaded", initialize);
})();