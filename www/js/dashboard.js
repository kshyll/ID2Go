(() => {
  "use strict";

  const db = window.ID2GoDB;
  const $ = id => document.getElementById(id);

  let currentUser = null;
  let refreshing = false;
  let refreshTimer = null;

  // Use Philippine time for appointment dates.
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

  const formatQueue = value => {
    if (value === null || value === undefined ||
        String(value).trim() === "") {
      return "—";
    }

    return String(value).padStart(3, "0");
  };

  const formatDate = value => {
    if (!value) return "Date unavailable";

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  // Only the signed-in student may load this dashboard.
  const getStudent = async () => {
    if (!db) {
      throw new Error("Supabase is unavailable.");
    }

    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      window.location.replace("index.html");
      return null;
    }

    const { data: role, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    if (roleError || role?.role !== "student") {
      throw new Error("Student access is required.");
    }

    return data.user;
  };

  // Set the initial state without using fake data.
  const setStandbyLayout = active => {
    $("progress-label").textContent = active ? "Return within" : "Queue progress";
    $("students-ahead").classList.toggle("return-countdown", active);
    $("estimated-wait").closest(".queue-card-footer").hidden = active;
  };

  const resetQueue = () => {
    clearInterval(graceTimer);
    setStandbyLayout(false);
    $("queue-number").textContent = "—";
    $("queue-status").textContent = "No Active Queue";
    $("students-ahead").textContent = "No active queue";
    $("estimated-wait").textContent =
      "Estimated wait: Not available";
  };

  const resetStations = () => {
    for (let number = 1; number <= 4; number++) {
      $(`station-${number}-number`).textContent = "-";
      $(`station-${number}-status`).textContent =
        "Not available";
    }
  };

  const resetAppointment = () => {
    $("appointment-service").textContent =
      "No upcoming appointment";

    $("appointment-schedule").textContent =
      "Your booking details will appear here.";
  };

  // Display the student's saved appointment.
  const renderAppointment = appointment => {
    if (!appointment) {
      resetAppointment();
      resetQueue();
      return;
    }

    $("appointment-service").textContent =
      appointment.service || "ID Service";

    const date = formatDate(appointment.appointment_date);
    const time = appointment.time_slot || "Time not specified";

    $("appointment-schedule").textContent =
      `${date} · ${time}`;

    // This number comes from the saved booking.
    // Live queue progress is handled separately.
    $("queue-number").textContent =
      formatQueue(appointment.queue_number);

    $("queue-status").textContent = "Scheduled";
    $("students-ahead").textContent =
      "Queue progress will appear when available.";

    $("estimated-wait").textContent =
      "Estimated wait: Not available";
  };

  // Fetch the student's appointment from Supabase.
  const loadAppointment = async () => {
    const { data, error } = await db
      .from("appointments")
      .select(
        "id, service, appointment_date, time_slot, " +
        "queue_number, status"
      )
      .eq("user_id", currentUser.id)
      .gte("appointment_date", today())
      .order("appointment_date", { ascending: true })
      .order("time_slot", { ascending: true })
      .limit(50);

    if (error) {
      throw error;
    }

    // Ignore cancelled, missed, or completed bookings.
    const active = (data || []).find(item => {
      const status = String(item.status || "").toLowerCase();

      return ![
        "cancelled",
        "canceled",
        "completed",
        "missed"
      ].includes(status);
    });

    renderAppointment(active || null);
  };

  // Display the student's real queue information.
  let graceTimer;
  const renderQueue = queue => {
    clearInterval(graceTimer);
    setStandbyLayout(false);
    if (!queue || typeof queue !== "object") {
      return;
    }

    $("queue-number").textContent =
      formatQueue(queue.number);

    const labels = {
      confirmed: "Scheduled",
      waiting: "Waiting",
      returned: "Waiting",
      called: "You're Called!",
      in_service: "In Service",
      standby: "Standby",
      completed: "Completed",
      missed: "Missed"
    };

    const status = String(
      queue.status || ""
    ).toLowerCase();

    $("queue-status").textContent =
      labels[status] || "Queue Status Unavailable";

    if (status === "standby" && Number.isFinite(Date.parse(queue.deadline))) {
      setStandbyLayout(true);
      const tick = () => {
        const left = Math.max(0, Math.ceil((Date.parse(queue.deadline) - Date.now()) / 1000));
        if (!left) setStandbyLayout(false);
        $("students-ahead").textContent = left
          ? Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0")
          : "Grace period ended. Book a new appointment.";
      };
      tick();
      graceTimer = setInterval(tick, 1000);
    } else if (status === "missed") {
      $("students-ahead").textContent = "Your grace period ended. Book a new appointment.";
    } else if (status === "called") {
      $("students-ahead").textContent =
        "Please proceed to Station " + queue.station + ".";
    } else if (status === "in_service") {
      $("students-ahead").textContent =
        "Your ID service is in progress.";
    } else if (
      Number.isInteger(queue.students_ahead) &&
      queue.students_ahead >= 0
    ) {
      const count = queue.students_ahead;

      $("students-ahead").textContent =
        count === 0
          ? "You're next in line."
          : `${count} student${count === 1 ? "" : "s"} ahead of you`;
    } else {
      $("students-ahead").textContent =
        "Live queue position unavailable.";
    }

    if (
      Number.isFinite(queue.estimated_wait_minutes) &&
      queue.estimated_wait_minutes >= 0
    ) {
      $("estimated-wait").textContent =
        `Estimated wait: ${Math.round(
          queue.estimated_wait_minutes
        )} minutes`;
    } else {
      $("estimated-wait").textContent =
        "Estimated wait: Not available";
    }
  };

  // Display all four camera stations.
  const renderStations = stations => {
    resetStations();

    if (!Array.isArray(stations)) {
      return;
    }

    stations.forEach(station => {
      const number = Number(station.number);

      if (!Number.isInteger(number) ||
          number < 1 || number > 4) {
        return;
      }

      const currentNumber = $(`station-${number}-number`);
      const currentStatus = $(`station-${number}-status`);

      currentNumber.textContent =
        formatQueue(station.queue_number);

      const labels = {
        available: "Available",
        serving: "Now serving",
        busy: "Now serving",
        occupied: "Now serving",
        offline: "Offline",
        unavailable: "Not available"
      };

      const status = String(
        station.status || ""
      ).toLowerCase();

      currentStatus.textContent =
        labels[status] || "Status unavailable";
    });
  };

  // Fetch live queue and station data.
  // Supabase must provide this RPC function.
  const loadLiveQueue = async () => {
    const { data, error } = await db.rpc(
      "student_queue_dashboard"
    );

    if (error) {
      throw error;
    }

    if (!data || Array.isArray(data) ||
        typeof data !== "object") {
      throw new Error("Invalid queue dashboard response.");
    }

    renderQueue(data.queue);
    renderStations(data.stations);
  };

  // Refresh appointment and queue information.
  const refreshDashboard = async () => {
    if (!currentUser || refreshing) {
      return;
    }

    refreshing = true;

    try {
      // Load appointments first so the booking is visible
      // even when the queue RPC has not been configured.
      try {
        await loadAppointment();
      } catch (error) {
        console.error("Appointment error:", error);

        $("appointment-service").textContent =
          "Unable to load appointment";

        $("appointment-schedule").textContent =
          "Please try again later.";

        resetQueue();
      }

      try {
        await loadLiveQueue();
      } catch (error) {
        console.warn("Live queue unavailable:", error);

        // Retain booking details but never invent
        // station values or waiting estimates.
        clearInterval(graceTimer);
        setStandbyLayout(false);
        resetStations();

        $("students-ahead").textContent =
          "Live queue updates are unavailable.";
      }
    } finally {
      refreshing = false;
    }
  };

  // Initialize the student dashboard.
  const initialize = async () => {
    resetQueue();
    resetStations();
    resetAppointment();

    try {
      currentUser = await getStudent();

      if (!currentUser) {
        return;
      }

      await refreshDashboard();

      // Poll every 15 seconds for updated information.
      refreshTimer = setInterval(
        refreshDashboard,
        15000
      );

      // Refresh when the student returns to this page.
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          refreshDashboard();
        }
      });
    } catch (error) {
      console.error("Student dashboard:", error);

      $("queue-status").textContent =
        "Unable to load dashboard";
    }
  };

  // Clear the timer when leaving the screen.
  window.addEventListener("pagehide", () => {
    clearInterval(graceTimer);
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();