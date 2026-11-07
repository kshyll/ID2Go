
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

  const status = (message, error = false) => {
    $("report-status").textContent = message;
    $("report-status").classList.toggle("error", error);
  };

  const resetQuota = () => {
    quotaFields.forEach(id => {
      $(id).textContent = "—";
    });

    $("quota-progress-fill").style.width = "0%";
    $("quota-progress").setAttribute("aria-valuenow", "0");
  };

  const resetReport = () => {
    Object.values(metrics).forEach(id => {
      $(id).textContent = "—";
    });

    $("station-monitoring").replaceChildren();
    resetQuota();
  };

  const today = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
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

  const checkAdmin = async () => {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      window.location.replace("index.html");
      return false;
    }

    const { data: role, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    if (roleError || role?.role !== "admin") {
      status("Administrator access required.", true);
      return false;
    }

    return true;
  };

  const renderQuota = quota => {
    if (!quota || typeof quota !== "object") {
      resetQuota();
      return;
    }

    const { daily_capacity, booked, completed } = quota;

    if (![daily_capacity, booked, completed].every(
      value => Number.isInteger(value) && value >= 0
    )) {
      resetQuota();
      return;
    }

    const remaining = Math.max(0, daily_capacity - booked);

    const percentage = daily_capacity > 0
      ? (completed / daily_capacity) * 100
      : 0;

    const progress = Math.min(100, percentage);

    $("quota-completed").textContent = completed;
    $("quota-capacity").textContent = daily_capacity;
    $("quota-daily-capacity").textContent = daily_capacity;
    $("quota-booked").textContent = booked;
    $("quota-completed-count").textContent = completed;

    $("quota-percentage").textContent =
      `${percentage.toFixed(1)}% completed`;

    $("quota-remaining").textContent =
      `${remaining} remaining booking slots`;

    $("quota-progress-fill").style.width = `${progress}%`;

    $("quota-progress").setAttribute(
      "aria-valuenow",
      String(progress)
    );
  };

  const renderStations = stations => {
    const container = $("station-monitoring");
    container.replaceChildren();

    if (!Array.isArray(stations) || !stations.length) {
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
      name.textContent = String(station.name || "Station");

      const state = String(station.status || "unknown");

      const statusLabel = document.createElement("span");
      statusLabel.className = "station-status";

      const dot = document.createElement("span");
      dot.className = "status-dot";

      if (state === "available") {
        dot.classList.add("available");
      }

      if (["serving", "busy", "occupied"].includes(state)) {
        dot.classList.add("busy");
      }

      const label = document.createElement("span");
      label.textContent = state.replaceAll("_", " ");

      statusLabel.append(dot, label);
      row.append(name, statusLabel);
      container.appendChild(row);
    });
  };

  const renderReport = report => {
    Object.entries(metrics).forEach(([key, id]) => {
      const value = report[key];

      $(id).textContent =
        Number.isFinite(value) && value >= 0
          ? String(value)
          : "—";
    });

    renderQuota(report.quota);
    renderStations(report.stations);
  };

  const loadReport = async () => {
    const date = $("report-date").value;
    const button = $("refresh-report");

    if (!date) {
      status("Select a reporting date.", true);
      return;
    }

    button.disabled = true;
    resetReport();
    status("Loading report...");

    try {
      const { data, error } = await db.rpc(
        "get_daily_report",
        { p_report_date: date }
      );

      if (error) throw error;

      if (!data || Array.isArray(data) ||
          typeof data !== "object") {
        throw new Error("Invalid report response.");
      }

      renderReport(data);
      $("report-date-label").textContent = date;
      status("Report updated.");
    } catch (error) {
      console.error("Report error:", error);

      status(
        "Unable to load report. Check database configuration.",
        true
      );
    } finally {
      button.disabled = false;
    }
  };

  const initialize = async () => {
    if (!db) {
      status("Supabase is unavailable.", true);
      return;
    }

    $("report-date").value = today();

    $("refresh-report").addEventListener("click", loadReport);
    $("report-date").addEventListener("change", loadReport);

    try {
      const authorized = await checkAdmin();

      if (!authorized) {
        $("report-date").disabled = true;
        $("refresh-report").disabled = true;
        return;
      }

      await loadReport();
    } catch (error) {
      console.error(error);
      status("Unable to verify administrator access.", true);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
