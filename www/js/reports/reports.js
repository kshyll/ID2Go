
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const db = window.ID2GoDB;

  const metricIds = {
    total_appointments: "total-appointments",
    waiting: "total-waiting",
    in_service: "total-serving",
    completed: "total-completed",
    missed: "total-missed"
  };

  const setStatus = (message, error = false) => {
    const element = $("report-status");
    element.textContent = message;
    element.classList.toggle("error", error);
  };

  const clearReport = () => {
    Object.values(metricIds).forEach(id => {
      $(id).textContent = "—";
    });

    $("station-monitoring").replaceChildren();
  };

  const getToday = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const values = Object.fromEntries(
      parts.map(part => [part.type, part.value])
    );

    return `${values.year}-${values.month}-${values.day}`;
  };

  const checkAccess = async () => {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      window.location.replace("index.html");
      return false;
    }

    const { data: roleData, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      setStatus("You are not authorized to view reports.", true);
      return false;
    }

    return true;
  };

  const renderStations = stations => {
    const container = $("station-monitoring");
    container.replaceChildren();

    if (!Array.isArray(stations) || stations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "reports-muted";
      empty.textContent = "No station records available.";
      container.appendChild(empty);
      return;
    }

    stations.forEach(station => {
      const row = document.createElement("div");
      row.className = "station-row";

      const name = document.createElement("strong");
      name.textContent = station.name;

      const status = document.createElement("span");
      status.className = "station-status";

      const dot = document.createElement("span");
      dot.className = "status-dot";

      if (station.status === "available") {
        dot.classList.add("available");
      }

      if (station.status === "serving") {
        dot.classList.add("busy");
      }

      const label = document.createElement("span");
      label.textContent = station.status
        .replaceAll("_", " ");

      status.append(dot, label);
      row.append(name, status);
      container.appendChild(row);
    });
  };


const renderQuota = quota => {
  const fields = [
    "quota-completed",
    "quota-capacity",
    "quota-daily-capacity",
    "quota-booked",
    "quota-completed-count",
    "quota-percentage",
    "quota-remaining"
  ];

  const reset = () => {
    fields.forEach(id => {
      $(id).textContent = "—";
    });

    $("quota-progress-fill").style.width = "0%";
    $("quota-progress").setAttribute("aria-valuenow", "0");
  };

  if (!quota || typeof quota !== "object") {
    reset();
    return;
  }

  const capacity = quota.daily_capacity;
  const booked = quota.booked;
  const completed = quota.completed;

  if (
    !Number.isInteger(capacity) ||
    !Number.isInteger(booked) ||
    !Number.isInteger(completed) ||
    capacity < 0 ||
    booked < 0 ||
    completed < 0
  ) {
    reset();
    return;
  }

  const remaining = Math.max(0, capacity - booked);

  const percentage = capacity > 0
    ? (completed / capacity) * 100
    : 0;

  const displayedPercentage = Math.min(
    100,
    Math.max(0, percentage)
  );

  $("quota-completed").textContent = completed;
  $("quota-capacity").textContent = capacity;
  $("quota-daily-capacity").textContent = capacity;
  $("quota-booked").textContent = booked;
  $("quota-completed-count").textContent = completed;

  $("quota-percentage").textContent =
    `${percentage.toFixed(1)}% completed`;

  $("quota-remaining").textContent =
    `${remaining} remaining booking slots`;

  $("quota-progress-fill").style.width =
    `${displayedPercentage}%`;

  $("quota-progress").setAttribute(
    "aria-valuenow",
    String(displayedPercentage)
  );
};


  const renderReport = report => {
    Object.entries(metricIds).forEach(([key, id]) => {
      const value = report[key];

      $(id).textContent =
        Number.isFinite(value) ? String(value) : "—";
    });

    renderStations(report.stations);
  };

  const loadReport = async () => {
    const selectedDate = $("report-date").value;
    const button = $("refresh-report");

    if (!selectedDate) {
      setStatus("Please select a reporting date.", true);
      return;
    }

    button.disabled = true;
    setStatus("Loading report...");
    clearReport();

    try {
      const { data, error } = await db.rpc(
        "get_daily_report",
        { p_report_date: selectedDate }
      );

      if (error) {
        throw error;
      }

      if (!data || typeof data !== "object" ||
          Array.isArray(data)) {
        throw new Error("Invalid report response.");
      }

      renderReport(data);
      $("report-date-label").textContent = selectedDate;
      setStatus("Report updated successfully.");
    } catch (error) {
      console.error("Report loading failed:", error);
      setStatus(
        "Unable to load the report. Check database configuration and permissions.",
        true
      );
    } finally {
      button.disabled = false;
    }
  };

  const initialize = async () => {
    if (!db) {
      setStatus("Supabase connection is unavailable.", true);
      return;
    }

    $("report-date").value = getToday();

    $("refresh-report").addEventListener(
      "click",
      loadReport
    );

    $("report-date").addEventListener(
      "change",
      loadReport
    );

    try {
      const authorized = await checkAccess();

      if (!authorized) {
        $("refresh-report").disabled = true;
        $("report-date").disabled = true;
        return;
      }

      await loadReport();
    } catch (error) {
      console.error(error);
      setStatus("Unable to verify account access.", true);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }
})();
