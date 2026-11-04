window.OperatorStore = (() => {
  const STORAGE_KEY = "id2go_operator_ui_v1";
  const GRACE_PERIOD = 5 * 60 * 1000;

  const initialState = () => ({
    stationId: null,
    sessionStartedAt: null,
    notifications: true,
    stationChangeRequest: null,
    stations: [1, 2, 3, 4].map(id => ({ id, available: true, currentId: null })),
    appointments: [],
    issues: [],
    lastCompletedId: null
  });

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.appointments) && Array.isArray(saved.stations)) {
        return saved;
      }
    } catch (error) {}
    return initialState();
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {}
  }

  function requireState(condition, message) {
    if (!condition) throw new Error(message);
  }

  function today(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")].join("-");
  }

  function find(id) {
    return state.appointments.find(a => a.id === String(id));
  }

  function station(id) {
    return state.stations.find(s => s.id === Number(id));
  }

  function myStation() {
    return station(state.stationId);
  }

  function current() {
    return find(myStation()?.currentId);
  }

  function isGraduate(appointment) {
    return ["graduate studies", "graduate", "postgraduate"].includes(
      String(appointment.studyLevel || "").trim().toLowerCase()
    );
  }

  function slotMinutes(slot) {
    const parts = String(slot || "").split(/[–—-]/).map(part => part.trim());
    if (parts.length !== 2) return null;

    const parse = text => text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    const start = parse(parts[0]);
    const end = parse(parts[1]);
    if (!start || !end) return null;

    const startHour = Number(start[1]);
    const endHour = Number(end[1]);
    const endPeriod = end[3]?.toUpperCase();
    const startPeriod = start[3]?.toUpperCase() ||
      (endPeriod === "PM" && endHour === 12 && startHour !== 12 ? "AM" : endPeriod);

    if (!startPeriod || !endPeriod || startHour > 12 || endHour > 12) return null;

    const minutes = (hour, minute, period) =>
      (hour % 12 + (period === "PM" ? 12 : 0)) * 60 + Number(minute || 0);

    return [minutes(startHour, start[2], startPeriod),
      minutes(endHour, end[2], endPeriod)];
  }

  function isEligible(appointment, date = new Date()) {
    if (appointment.appointmentDate !== today(date)) return false;
    if (appointment.status === "returned") return true;
    if (appointment.status !== "waiting") return false;

    const slot = slotMinutes(appointment.timeSlot);
    if (!slot) return false;

    const currentMinute = date.getHours() * 60 + date.getMinutes();
    return currentMinute >= slot[0] && currentMinute < slot[1];
  }

  function priority(a, b) {
    return Number(!isGraduate(a)) - Number(!isGraduate(b)) ||
      Number(a.status !== "returned") - Number(b.status !== "returned") ||
      a.queue - b.queue;
  }

  function expireDeadlines() {
    let updated = false;
    for (const a of state.appointments) {
      if (!["called", "standby"].includes(a.status) || !a.deadline || a.deadline > Date.now()) {
        continue;
      }
      const assignedStation = station(a.stationId);
      if (assignedStation?.currentId === a.id) assignedStation.currentId = null;
      a.stationId = null;
      a.deadline = null;
      a.status = "missed";
      updated = true;
    }
    if (updated) save();
    return updated;
  }

  function nextEligible() {
    expireDeadlines();
    return state.appointments.filter(a => isEligible(a)).sort(priority)[0] || null;
  }

  function selectStation(id) {
    const selected = station(id);
    requireState(selected?.available && !selected.currentId, "This station is unavailable or occupied.");
    requireState(!state.stationId, "End your current station session before changing stations.");
    state.stationId = selected.id;
    state.sessionStartedAt = Date.now();
    state.lastCompletedId = null;
    save();
  }

  function toggleAvailability() {
    const selected = myStation();
    requireState(selected && !selected.currentId, "Finish the current student first.");
    selected.available = !selected.available;
    save();
  }

  function callNext() {
    const selected = myStation();
    requireState(selected?.available && !selected.currentId, "Your station must be available and empty.");
    const appointment = nextEligible();
    requireState(appointment, "No students are eligible for the current appointment time slot.");
    appointment.status = "called";
    appointment.stationId = selected.id;
    appointment.calledAt = Date.now();
    appointment.deadline = appointment.calledAt + GRACE_PERIOD;
    selected.currentId = appointment.id;
    state.lastCompletedId = null;
    save();
    return appointment;
  }

  function confirmArrival() {
    expireDeadlines();
    const appointment = current();
    requireState(appointment?.status === "called", "No called student is awaiting arrival.");
    appointment.status = "in_service";
    appointment.deadline = null;
    appointment.serviceStartedAt = Date.now();
    save();
  }

  function moveToStandby() {
    expireDeadlines();
    const appointment = current();
    requireState(appointment?.status === "called", "No called student can be moved to standby.");
    appointment.status = "standby";
    appointment.lastStationId = state.stationId;
    appointment.stationId = null;
    myStation().currentId = null;
    save();
  }

  function markReturned(id) {
    expireDeadlines();
    const appointment = find(id);
    requireState(appointment?.status === "standby", "This student's grace period has expired.");
    appointment.status = "returned";
    appointment.returnedAt = Date.now();
    appointment.deadline = null;
    save();
  }

  function verifyRequirements(id) {
    const appointment = find(id);
    requireState(appointment?.status === "in_service", "Requirements can be verified during an active service.");
    appointment.requirementsVerified = true;
    save();
  }

  function reportIssue(type, notes) {
    const appointment = current();
    requireState(appointment?.status === "in_service", "An active service is required.");
    requireState(String(type || "").trim(), "Choose an issue type.");
    state.issues.push({
      id: `issue-${Date.now()}`,
      appointmentId: appointment.id,
      stationId: state.stationId,
      type,
      notes: String(notes || "").trim(),
      createdAt: Date.now()
    });
    save();
  }

  function completeService() {
    const appointment = current();
    requireState(appointment?.status === "in_service", "Confirm student arrival first.");
    requireState(appointment.requirementsVerified, "Verify the requirements before completing service.");
    appointment.status = "completed";
    appointment.completedAt = Date.now();
    appointment.stationId = null;
    myStation().currentId = null;
    state.lastCompletedId = appointment.id;
    save();
  }

  function readyForNext() {
    state.lastCompletedId = null;
    save();
  }

  function requestStationChange(id) {
    requireState(station(id) && Number(id) !== state.stationId, "Choose another station.");
    state.stationChangeRequest = Number(id);
    save();
  }

  function endSession() {
    requireState(!current(), "Finish the current student before ending your session.");
    state.stationId = null;
    state.sessionStartedAt = null;
    state.lastCompletedId = null;
    save();
  }

  function receiveAppointments(rows) {
    requireState(Array.isArray(rows), "Appointments must be an array.");
    let added = 0;

    for (const row of rows) {
      if (!["confirmed", "waiting"].includes(String(row.status || "confirmed").toLowerCase())) continue;
      const queue = Number(row.queue_number ?? row.queue);
      const studentId = String(row.student_id ?? row.studentId ?? "").trim();
      const service = String(row.service || "").trim();
      const appointmentDate = String(row.appointment_date ?? row.appointmentDate ?? "").trim();
      const timeSlot = String(row.time_slot ?? row.timeSlot ?? "").trim();
      const fullName = String(row.full_name ?? row.fullName ?? "").trim();
      if (!Number.isInteger(queue) || queue < 1 || !studentId || !fullName || !appointmentDate || !service || !timeSlot) continue;

      const id = String(row.id ?? row.appointment_id ??
        `${studentId}|${appointmentDate}|${timeSlot}|${service}`);
      if (find(id)) continue;

      state.appointments.push({
        id, queue, studentId, fullName, service, appointmentDate, timeSlot,
        courseProgram: String(row.course_program ?? row.courseProgram ?? "Not provided"),
        yearLevel: String(row.year_level ?? row.yearLevel ?? "Not provided"),
        studyLevel: String(row.study_level ?? row.studyLevel ?? "Unspecified"),
        requirements: Array.isArray(row.requirements) ? row.requirements : [],
        requirementsVerified: false,
        status: "waiting", stationId: null, calledAt: null, deadline: null,
        serviceStartedAt: null
      });
      added++;
    }
    if (added) save();
    return added;
  }

  function resetLocalState() {
    state = initialState();
    save();
  }

  return {
    getState: () => state, today, find, myStation, current, isGraduate,
    isEligible, nextEligible, expireDeadlines, selectStation, toggleAvailability,
    callNext, confirmArrival, moveToStandby, markReturned, verifyRequirements,
    reportIssue, completeService, readyForNext, requestStationChange,
    endSession, receiveAppointments, resetLocalState,
    setNotifications(value) { state.notifications = Boolean(value); save(); }
  };
})();
