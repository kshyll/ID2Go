
(() => {
  "use strict";

  const db = window.ID2GoDB;
  const $ = id => document.getElementById(id);

  const metrics = {
    total_appointments: "total-appointments",
    waiting: "total-waiting",
    in_service: "total-serving",
    completed: "total-completed",
    missed: "total-missed"
  };

  const quotaFields = [
    "quota-completed",
    "quota-capacity",
    "quota-daily-capacity",
    "quota-booked",
    "quota-completed-count",
    "quota-percentage",
    "quota-remaining"
  ];

  let requestNumber = 0;

  // Show a message below the date selector.
  const showStatus = (message, isError = false) => {
    const element = $("report-status");

    element.textContent = message;
    element.classList.toggle("error", isError);
  };

  // Clear quota values when a new report is requested.
  const resetQuota = () => {
    quotaFields.forEach(id => {
      $(id).textContent = "—";
    });

    $("quota-progress-fill").style.width = "0%";

    $("quota-progress").setAttribute(
      "aria-valuenow",
      "0"
    );
  };

  // Clear previous report information.
  const resetReport = () => {
    Object.values(metrics).forEach(id => {
      $(id).textContent = "—";
    });

    $("station-monitoring").replaceChildren();
    $("report-date-label").textContent = "";

    resetQuota();
  };

  // Get the current Philippine date.
  const getToday = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const year = parts.find(p => p.type === "year").value;
    const month = parts.find(p => p.type === "month").value;
    const day = parts.find(p => p.type === "day").value;

    return `${year}-${month}-${day}`;
  };

  // Display the daily quota.
  const showQuota = quota => {
    if (!quota || typeof quota !== "object") {
      resetQuota();
      return;
    }

    const capacity = quota.daily_capacity;
    const booked = quota.booked;
    const completed = quota.completed;

    const validNumbers = [
      capacity,
      booked,
      completed
    ].every(value => {
      return Number.isInteger(value) && value >= 0;
    });

    if (!validNumbers) {
      resetQuota();
      return;
    }

    const remaining = Math.max(0, capacity - booked);

    const percentage = capacity > 0
      ? completed / capacity * 100
      : 0;

    const progress = Math.min(100, percentage);

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
      `${progress}%`;

    $("quota-progress").setAttribute(
      "aria-valuenow",
      String(progress)
    );
  };

  // Display the camera stations.
  const showStations = stations => {
    const container = $("station-monitoring");
    container.replaceChildren();

    if (!Array.isArray(stations) || stations.length === 0) {
      const message = document.createElement("p");

      message.className = "reports-muted";
      message.textContent = "No station records available.";

      container.appendChild(message);
      return;
    }

    stations.forEach(station => {
      const row = document.createElement("div");
      row.className = "station-row";

      const name = document.createElement("strong");
      name.textContent = station.name || "Station";

      const state = String(
        station.status || "unknown"
      );

      const statusLabel = document.createElement("span");
      statusLabel.className = "station-status";

      const dot = document.createElement("span");
      dot.className = "status-dot";

      if (state === "available") {
        dot.classList.add("available");
      }

      if (
        state === "serving" ||
        state === "busy" ||
        state === "occupied"
      ) {
        dot.classList.add("busy");
      }

      const label = document.createElement("span");
      label.textContent = state.replaceAll("_", " ");

      statusLabel.append(dot, label);
      row.append(name, statusLabel);

      container.appendChild(row);
    });
  };

  // Display all report values.
  const showReport = report => {
    Object.entries(metrics).forEach(([key, id]) => {
      const value = report[key];

      $(id).textContent =
        Number.isFinite(value) && value >= 0
          ? String(value)
          : "—";
    });

    showQuota(report.quota);
    showStations(report.stations);
  };

  // Fetch a report from Supabase.
  const loadReport = async () => {
    const date = $("report-date").value;
    const button = $("refresh-report");

    if (!date) {
      requestNumber++; resetReport(); button.disabled = false;
      showStatus("Please select a date.", true);
      return;
    }

    // Each request gets a number.
    // An older request cannot replace a newer report.
    requestNumber++;
    const currentRequest = requestNumber;

    button.disabled = true;
    resetReport();
    showStatus("Loading report...");

    try {
      const { data, error } = await db.rpc(
        "get_daily_report",
        { p_report_date: date }
      );

      // Ignore the response if a newer request exists.
      if (currentRequest !== requestNumber) {
        return;
      }

      if (error) {
        throw error;
      }

      if (
        !data ||
        Array.isArray(data) ||
        typeof data !== "object"
      ) {
        throw new Error("Invalid report response.");
      }

      showReport(data);
      $("report-date-label").textContent = date;

      showStatus("Report updated.");

    } catch (error) {
      if (currentRequest !== requestNumber) {
        return;
      }

      console.error("Report error:", error);

      showStatus(
        "Unable to load report. Please try again.",
        true
      );

    } finally {
      if (currentRequest === requestNumber) {
        button.disabled = false;
      }
    }
  };

  let initialized = false;
  window.ID2GoReports = {
    open() {
      if (!initialized) {
        $("report-date").value = getToday();
        $("report-date").addEventListener("change", loadReport);
        $("refresh-report").addEventListener("click", loadReport);
        initialized = true;
      }
      return loadReport();
    }
  };
})();
