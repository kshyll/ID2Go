// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://rvmhhggglfgiripeaufw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_S-RGE0NTsajME2hnJ1QGGw_H0SUtj-m";

function getDbClient() {
  return (
    window.ID2GoDB ||
    (window.supabase
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null)
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const db = getDbClient();
  const MAX_SLOTS_PER_HOUR = 48;

  const TIME_SLOTS = [
    "8:00–9:00 AM",
    "9:00–10:00 AM",
    "10:00–11:00 AM",
    "11:00 AM–12:00 PM",
    "1:00–2:00 PM",
    "2:00–3:00 PM",
    "3:00–4:00 PM",
    "4:00–5:00 PM"
  ];

  // 1. VERIFY AUTHENTICATED ACCOUNT OWNER
  let currentUser = null;
  if (db) {
    try {
      const { data: sessionData } = await db.auth.getSession();
      currentUser = sessionData?.session?.user || null;

      if (!currentUser) {
        const { data: userData } = await db.auth.getUser();
        currentUser = userData?.user || null;
      }
    } catch (err) {
      console.error("[ID2GO Booking] Auth session check failed:", err);
    }
  } else {
    console.error("[ID2GO Booking] Supabase client failed to initialize.");
  }

  if (!currentUser) {
    alert("Please log in to your student account before booking an appointment.");
    window.location.replace("index.html");
    return;
  }

  const userProfileCacheKey = `id2go_user_profile_${currentUser.id}`;
  const userBookingCacheKey = `id2go_active_appointment_${currentUser.id}`;

  // Clear legacy unscoped keys so different accounts on the same device never mix
  localStorage.removeItem("id2go_user_profile");
  localStorage.removeItem("id2go_active_student_id");
  localStorage.removeItem("id2go_active_appointment");

  // Booking system state
  let bookingData = {
    service: "First-Time ID Picture Taking",
    studentInfo: {},
    selectedDate: null,
    selectedTimeSlot: null,
    queueNumber: "",
    activeBooking: null
  };

  let slotBookings =
    JSON.parse(localStorage.getItem("id2go_slot_bookings")) || {};

  // Calendar State
  let currentDate = new Date();
  let currentYear = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth();

  // DOM Elements
  const steps = {
    1: document.getElementById("step-1"),
    2: document.getElementById("step-2"),
    3: document.getElementById("step-3"),
    4: document.getElementById("step-4"),
    5: document.getElementById("step-5")
  };

  function goToStep(stepNumber) {
    Object.keys(steps).forEach((key) => {
      if (steps[key]) {
        steps[key].classList.remove("active");
      }
    });
    if (steps[stepNumber]) {
      steps[stepNumber].classList.add("active");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // GLOBAL NAVIGATION BACK BUTTON HANDLER
  document.querySelectorAll(".nav-back-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetStep = btn.getAttribute("data-target");
      if (targetStep) {
        goToStep(parseInt(targetStep, 10));
      }
    });
  });

  /* ==================== LOCK & PREFILL OWNER IDENTITY ==================== */
  function applyReadOnlyStyle(el) {
    if (!el) return;
    el.readOnly = true;
    el.style.backgroundColor = "#f1f5f9";
    el.style.color = "#475569";
    el.style.cursor = "not-allowed";
  }

  function setSelectValueSmart(selectId, rawValue) {
    const el = document.getElementById(selectId);
    if (!el || !rawValue) return;

    const clean = String(rawValue).trim();
    // Exact match first
    for (const opt of el.options) {
      if (opt.value.toLowerCase() === clean.toLowerCase()) {
        el.value = opt.value;
        return;
      }
    }

    // Common shorthand mappings (e.g., BSIT -> BS Information Technology, 3 -> 3rd Year)
    const aliases = {
      bsit: "BS Information Technology",
      bscs: "BS Computer Science",
      bsis: "BS Information Systems",
      bsba: "BS Business Administration",
      bsa: "BS Accountancy",
      bsn: "BS Nursing",
      bsce: "BS Civil Engineering",
      "1": "1st Year",
      "2": "2nd Year",
      "3": "3rd Year",
      "4": "4th Year",
      "5": "5th Year"
    };

    const mapped = aliases[clean.toLowerCase()];
    if (mapped) {
      el.value = mapped;
    }
  }

  function lockOwnerIdentityFields(hasExistingIdentity) {
    const emailEl = document.getElementById("email");
    const fullNameEl = document.getElementById("fullName");
    const studentIdEl = document.getElementById("studentId");

    if (emailEl && currentUser.email) {
      emailEl.value = currentUser.email;
      applyReadOnlyStyle(emailEl);
    }

    if (hasExistingIdentity) {
      if (fullNameEl && fullNameEl.value.trim()) {
        applyReadOnlyStyle(fullNameEl);
      }
      if (studentIdEl && studentIdEl.value.trim()) {
        applyReadOnlyStyle(studentIdEl);
      }
    }
  }

  async function loadAndPopulateOwnerProfile() {
    let profile = null;

    if (db) {
      try {
        const { data, error } = await db
          .from("student_profiles")
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (error) {
          console.warn("[ID2GO Booking] student_profiles query error:", error.message);
        } else if (data) {
          profile = {
            fullName: data.full_name || "",
            studentId: data.student_id || "",
            courseProgram: data.course_program || "",
            yearLevel: data.year_level || "",
            email: currentUser.email || data.email || "",
            mobileNumber: data.mobile_number || "",
            emergencyName: data.emergency_name || "",
            emergencyRelationship: data.emergency_relationship || "",
            emergencyPhone: data.emergency_phone || ""
          };
          localStorage.setItem(userProfileCacheKey, JSON.stringify(profile));
        }
      } catch (err) {
        console.warn("[ID2GO Booking] Profile fetch exception:", err);
      }
    }

    // Fallback to user-scoped local cache if Supabase returned no row yet
    if (!profile) {
      const cached = localStorage.getItem(userProfileCacheKey);
      if (cached) {
        try {
          profile = JSON.parse(cached);
        } catch (e) {
          console.warn("[ID2GO Booking] Invalid cached profile:", e);
        }
      }
    }

    const setInput = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };

    if (profile) {
      setInput("fullName", profile.fullName);
      setInput("studentId", profile.studentId);
      setSelectValueSmart("courseProgram", profile.courseProgram);
      setSelectValueSmart("yearLevel", profile.yearLevel);
      setInput("email", currentUser.email || profile.email);
      setInput("mobileNumber", profile.mobileNumber);
      setInput("emergencyName", profile.emergencyName);
      setSelectValueSmart("emergencyRelationship", profile.emergencyRelationship);
      setInput("emergencyPhone", profile.emergencyPhone);

      const hasIdentity = Boolean(
        profile.fullName?.trim() && profile.studentId?.trim()
      );
      lockOwnerIdentityFields(hasIdentity);
    } else {
      lockOwnerIdentityFields(false);
    }
  }

  /* ==================== TITLE CASE VALIDATION ==================== */
  function setupTitleCaseValidation(inputElement) {
    if (!inputElement) return;

    function formatTitleCase(value) {
      return value.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    inputElement.addEventListener("input", (e) => {
      if (e.target.readOnly) return;
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      e.target.value = formatTitleCase(e.target.value);
      e.target.setSelectionRange(start, end);
    });

    inputElement.addEventListener("blur", (e) => {
      if (e.target.readOnly) return;
      e.target.value = formatTitleCase(e.target.value.trim());
    });
  }

  setupTitleCaseValidation(document.getElementById("fullName"));
  setupTitleCaseValidation(document.getElementById("emergencyName"));

  /* ==================== RENDER FULL DETAILS IN STEP 5 ==================== */
  function renderDetailsStep(data) {
    if (!data) return;

    document.getElementById("generated-queue-number").textContent =
      data.queueNumber || "001";
    document.getElementById("conf-service-title").textContent =
      data.service || "First-Time ID Picture Taking";

    document.getElementById("conf-student-name").textContent =
      data.fullName || data.studentInfo?.fullName || "-";
    document.getElementById("conf-student-id").textContent =
      data.studentId || data.studentInfo?.studentId || "-";

    const course = data.courseProgram || data.studentInfo?.courseProgram || "";
    const year = data.yearLevel || data.studentInfo?.yearLevel || "";
    document.getElementById("conf-student-course").textContent =
      course && year ? `${course} (${year})` : course || year || "-";

    document.getElementById("conf-student-email").textContent =
      data.email || data.studentInfo?.email || "-";
    document.getElementById("conf-student-mobile").textContent =
      data.mobileNumber || data.studentInfo?.mobileNumber || "-";

    const rawDate = data.date || data.appointment_date || data.selectedDate;
    if (rawDate) {
      const [y, m, d] = rawDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      document.getElementById("conf-date-display").textContent =
        dateObj.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric"
        });
    } else {
      document.getElementById("conf-date-display").textContent = "-";
    }

    document.getElementById("conf-time-display").textContent =
      data.time || data.selectedTimeSlot || "-";

    const emerName =
      data.emergencyName || data.studentInfo?.emergencyName || "";
    const emerRel =
      data.emergencyRelationship ||
      data.studentInfo?.emergencyRelationship ||
      "";
    document.getElementById("conf-emergency-name").textContent =
      emerName && emerRel ? `${emerName} (${emerRel})` : emerName || "-";
    document.getElementById("conf-emergency-phone").textContent =
      data.emergencyPhone || data.studentInfo?.emergencyPhone || "-";
  }

  /* ==================== ACTIVE APPOINTMENT CHECK ==================== */
  async function checkExistingAppointment() {
    let activeAppointment = null;

    if (db) {
      try {
        const { data, error } = await db
          .from("appointments")
          .select("*")
          .eq("user_id", currentUser.id)
          .eq("status", "Confirmed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          activeAppointment = {
            service: data.service,
            date: data.appointment_date,
            time: data.time_slot,
            queueNumber: data.queue_number,
            fullName: data.full_name,
            studentId: data.student_id,
            courseProgram: data.course_program,
            yearLevel: data.year_level,
            email: data.email,
            mobileNumber: data.mobile_number,
            emergencyName: data.emergency_name,
            emergencyRelationship: data.emergency_relationship,
            emergencyPhone: data.emergency_phone,
            dbId: data.id
          };
          localStorage.setItem(
            userBookingCacheKey,
            JSON.stringify(activeAppointment)
          );
        } else if (!error && !data) {
          localStorage.removeItem(userBookingCacheKey);
        }
      } catch (err) {
        console.warn("[ID2GO Booking] Active appointment query error:", err);
      }
    }

    if (!activeAppointment) {
      const localActive = localStorage.getItem(userBookingCacheKey);
      if (localActive) {
        activeAppointment = JSON.parse(localActive);
      }
    }

    const existingCard = document.getElementById("existing-appointment-card");
    const newBookingContainer = document.getElementById(
      "new-booking-container"
    );
    const step1Indicator = document.getElementById("step1-indicator");

    if (activeAppointment && existingCard && newBookingContainer) {
      bookingData.activeBooking = activeAppointment;

      document.getElementById("active-queue-no").textContent =
        activeAppointment.queueNumber || "001";
      document.getElementById("existing-service-name").textContent =
        activeAppointment.service;

      if (activeAppointment.date) {
        const [y, m, d] = activeAppointment.date.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        document.getElementById("active-booking-date").textContent =
          dateObj.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
          });
      }

      document.getElementById("active-booking-time").textContent =
        activeAppointment.time;

      if (step1Indicator) {
        step1Indicator.textContent = "Active Appointment Details";
      }

      existingCard.style.display = "block";
      newBookingContainer.style.display = "none";
    } else if (existingCard && newBookingContainer) {
      existingCard.style.display = "none";
      newBookingContainer.style.display = "block";
      if (step1Indicator) {
        step1Indicator.textContent = "Step 1 of 4: Select Service";
      }
    }
  }

  // View Details Click Handler
  const btnViewActiveDetails = document.getElementById(
    "btn-view-appointment-details"
  );
  if (btnViewActiveDetails) {
    btnViewActiveDetails.addEventListener("click", () => {
      if (bookingData.activeBooking) {
        renderDetailsStep(bookingData.activeBooking);
        goToStep(5);
      }
    });
  }

  // Cancel Booking Click Handler
  const btnCancelBooking = document.getElementById("btn-cancel-booking");
  if (btnCancelBooking) {
    btnCancelBooking.addEventListener("click", async () => {
      const active = bookingData.activeBooking;
      if (!active) return;

      const confirmCancel = confirm(
        "Are you sure you want to cancel your active appointment?"
      );
      if (!confirmCancel) return;

      btnCancelBooking.disabled = true;
      btnCancelBooking.textContent = "Cancelling...";

      if (db) {
        try {
          const query = active.dbId
            ? db
                .from("appointments")
                .update({ status: "Cancelled" })
                .eq("id", active.dbId)
                .eq("user_id", currentUser.id)
            : db
                .from("appointments")
                .update({ status: "Cancelled" })
                .eq("user_id", currentUser.id)
                .eq("status", "Confirmed");

          await query;
        } catch (err) {
          console.error("[ID2GO Booking] Cancel error:", err);
        }
      }

      localStorage.removeItem(userBookingCacheKey);
      bookingData.activeBooking = null;

      btnCancelBooking.disabled = false;
      btnCancelBooking.textContent = "Cancel Booking";

      alert("Your appointment has been cancelled.");
      await checkExistingAppointment();
    });
  }

  /* ==================== STEP 1 ==================== */
  const btnStep1Next = document.getElementById("btn-step1-next");
  if (btnStep1Next) {
    btnStep1Next.addEventListener("click", () => {
      const selectedRadio = document.querySelector(
        'input[name="id_service"]:checked'
      );
      if (selectedRadio) {
        bookingData.service = selectedRadio.value;
        goToStep(2);
      }
    });
  }

  /* ==================== STEP 2: SYNC WITH STUDENT PROFILE ==================== */
  const studentInfoForm = document.getElementById("student-info-form");
  if (studentInfoForm) {
    studentInfoForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btnStep2Next = document.getElementById("btn-step2-next");
      const titleCase = (str) =>
        str.trim().replace(/\b\w/g, (c) => c.toUpperCase());

      const studentIdVal = document.getElementById("studentId").value.trim();
      if (!/^[0-9A-Za-z-]{4,15}$/.test(studentIdVal)) {
        alert("Please enter a valid Student ID (e.g., 2023-0001).");
        document.getElementById("studentId").focus();
        return;
      }

      const info = {
        fullName: titleCase(document.getElementById("fullName").value),
        studentId: studentIdVal,
        courseProgram: document.getElementById("courseProgram").value,
        yearLevel: document.getElementById("yearLevel").value,
        email: currentUser.email,
        mobileNumber: document.getElementById("mobileNumber").value.trim(),
        emergencyName: titleCase(
          document.getElementById("emergencyName").value
        ),
        emergencyRelationship: document.getElementById(
          "emergencyRelationship"
        ).value,
        emergencyPhone: document.getElementById("emergencyPhone").value.trim()
      };

      if (btnStep2Next) {
        btnStep2Next.disabled = true;
        btnStep2Next.textContent = "Syncing Profile...";
      }

      // Sync booking details to student_profiles so Profile page matches
      if (db) {
        try {
          const profilePayload = {
            user_id: currentUser.id,
            student_id: info.studentId,
            full_name: info.fullName,
            course_program: info.courseProgram,
            year_level: info.yearLevel,
            email: info.email,
            mobile_number: info.mobileNumber,
            emergency_name: info.emergencyName,
            emergency_relationship: info.emergencyRelationship,
            emergency_phone: info.emergencyPhone,
            updated_at: new Date().toISOString()
          };

          const { error } = await db
            .from("student_profiles")
            .upsert(profilePayload, { onConflict: "user_id" });

          if (error) {
            if (error.code === "23505") {
              alert(
                "This Student ID is already registered to another account. Each student must book using their own account."
              );
              if (btnStep2Next) {
                btnStep2Next.disabled = false;
                btnStep2Next.textContent = "Save and Continue";
              }
              return;
            }
            throw error;
          }
        } catch (err) {
          console.error("[ID2GO Booking] Profile sync error:", err);
          alert(
            `Unable to verify and save your student profile: ${
              err.message || "Please try again."
            }`
          );
          if (btnStep2Next) {
            btnStep2Next.disabled = false;
            btnStep2Next.textContent = "Save and Continue";
          }
          return;
        }
      }

      localStorage.setItem(userProfileCacheKey, JSON.stringify(info));
      bookingData.studentInfo = info;

      lockOwnerIdentityFields(true);

      if (btnStep2Next) {
        btnStep2Next.disabled = false;
        btnStep2Next.textContent = "Save and Continue";
      }

      renderCalendar();
      goToStep(3);
    });
  }

  /* ==================== STEP 3: CALENDAR & TIME SLOTS ==================== */
  const monthYearLabel = document.getElementById("calendar-month-year");
  const calendarDaysContainer = document.getElementById("calendar-days");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const timeSlotsList = document.getElementById("time-slots-list");
  const selectedDateLabel = document.getElementById("selected-date-label");
  const btnStep3Next = document.getElementById("btn-step3-next");

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  function renderCalendar() {
    if (!monthYearLabel || !calendarDaysContainer) return;

    monthYearLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    calendarDaysContainer.innerHTML = "";

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
      const emptyDiv = document.createElement("div");
      emptyDiv.classList.add("cal-day", "empty");
      calendarDaysContainer.appendChild(emptyDiv);
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayEl = document.createElement("div");
      dayEl.classList.add("cal-day");
      dayEl.textContent = day;

      const fullDate = new Date(currentYear, currentMonth, day);
      const dayOfWeek = fullDate.getDay();
      const dateString = formatDateString(currentYear, currentMonth + 1, day);

      if (dayOfWeek === 0) {
        dayEl.classList.add("sunday");
        dayEl.title = "Closed on Sundays";
      } else {
        if (bookingData.selectedDate === dateString) {
          dayEl.classList.add("selected");
        }

        dayEl.addEventListener("click", () => {
          document
            .querySelectorAll(".cal-day")
            .forEach((el) => el.classList.remove("selected"));
          dayEl.classList.add("selected");
          bookingData.selectedDate = dateString;
          bookingData.selectedTimeSlot = null;
          if (btnStep3Next) btnStep3Next.disabled = true;

          renderTimeSlots(dateString, fullDate);
        });
      }

      calendarDaysContainer.appendChild(dayEl);
    }

    if (bookingData.selectedDate) {
      const [y, m, d] = bookingData.selectedDate.split("-").map(Number);
      renderTimeSlots(bookingData.selectedDate, new Date(y, m - 1, d));
    } else {
      if (timeSlotsList) {
        timeSlotsList.innerHTML = `<p class="selected-date-subtext" style="grid-column: span 2;">Please select a date from the calendar above.</p>`;
      }
      if (selectedDateLabel) {
        selectedDateLabel.textContent = "Select a date from the calendar";
      }
    }
  }

  async function renderTimeSlots(dateString, fullDate) {
    if (!timeSlotsList || !selectedDateLabel) return;

    const formattedDateText = fullDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });

    selectedDateLabel.textContent = `Schedule for ${formattedDateText}`;
    timeSlotsList.innerHTML =
      "<p class='selected-date-subtext' style='grid-column: span 2;'>Loading available slots...</p>";

    let dbBookings = {};
    if (db) {
      try {
        const { data, error } = await db
          .from("appointments")
          .select("time_slot")
          .eq("appointment_date", dateString)
          .neq("status", "Cancelled");

        if (!error && data) {
          data.forEach((row) => {
            dbBookings[row.time_slot] = (dbBookings[row.time_slot] || 0) + 1;
          });
        }
      } catch (err) {
        console.warn("[ID2GO Booking] Slot fetch error:", err);
        dbBookings = slotBookings[dateString] || {};
      }
    } else {
      dbBookings = slotBookings[dateString] || {};
    }

    timeSlotsList.innerHTML = "";

    TIME_SLOTS.forEach((slotText) => {
      const bookedCount = dbBookings[slotText] || 0;
      const remainingSlots = Math.max(0, MAX_SLOTS_PER_HOUR - bookedCount);
      const isFull = remainingSlots === 0;

      const slotEl = document.createElement("div");
      slotEl.classList.add("slot-item");

      if (isFull) {
        slotEl.classList.add("disabled");
        slotEl.innerHTML = `
          <span class="slot-time">${slotText}</span>
          <span class="slot-count">Full</span>
        `;
      } else {
        if (bookingData.selectedTimeSlot === slotText) {
          slotEl.classList.add("selected");
          if (btnStep3Next) btnStep3Next.disabled = false;
        }

        slotEl.innerHTML = `
          <span class="slot-time">${slotText}</span>
          <span class="slot-count">${remainingSlots} left</span>
        `;

        slotEl.addEventListener("click", () => {
          document
            .querySelectorAll(".slot-item")
            .forEach((el) => el.classList.remove("selected"));
          slotEl.classList.add("selected");
          bookingData.selectedTimeSlot = slotText;
          if (btnStep3Next) btnStep3Next.disabled = false;
        });
      }

      timeSlotsList.appendChild(slotEl);
    });
  }

  if (btnStep3Next) {
    btnStep3Next.addEventListener("click", () => {
      populateReviewStep();
      goToStep(4);
    });
  }

  /* ==================== STEP 4: REVIEW & CONFIRM ==================== */
  const btnConfirmBooking = document.getElementById("btn-confirm-booking");

  function populateReviewStep() {
    document.getElementById("review-service").textContent = bookingData.service;
    document.getElementById("review-student-name").textContent =
      bookingData.studentInfo.fullName || "N/A";
    document.getElementById("review-student-course").textContent = `${
      bookingData.studentInfo.courseProgram || ""
    } (${bookingData.studentInfo.yearLevel || ""})`;

    if (bookingData.selectedDate) {
      const [y, m, d] = bookingData.selectedDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      document.getElementById("review-date").textContent =
        dateObj.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric"
        });
    }

    document.getElementById("review-time").textContent =
      bookingData.selectedTimeSlot || "N/A";
    document.getElementById("review-emergency").textContent = `${
      bookingData.studentInfo.emergencyName || ""
    } (${bookingData.studentInfo.emergencyRelationship || ""})`;
  }

  if (btnConfirmBooking) {
    btnConfirmBooking.addEventListener("click", async () => {
      btnConfirmBooking.disabled = true;
      btnConfirmBooking.textContent = "Processing...";

      const { selectedDate, selectedTimeSlot, studentInfo, service } =
        bookingData;
      const generatedQueueNumber = `0${Math.floor(Math.random() * 90) + 10}`;
      bookingData.queueNumber = generatedQueueNumber;

      const newRecord = {
        user_id: currentUser.id,
        full_name: studentInfo.fullName,
        student_id: studentInfo.studentId,
        course_program: studentInfo.courseProgram,
        year_level: studentInfo.yearLevel,
        email: currentUser.email,
        mobile_number: studentInfo.mobileNumber,
        emergency_name: studentInfo.emergencyName,
        emergency_relationship: studentInfo.emergencyRelationship,
        emergency_phone: studentInfo.emergencyPhone,
        service: service,
        appointment_date: selectedDate,
        time_slot: selectedTimeSlot,
        queue_number: generatedQueueNumber,
        status: "Confirmed"
      };

      let insertedId = null;

      if (db) {
        try {
          const { data, error } = await db
            .from("appointments")
            .insert([newRecord])
            .select("id")
            .single();

          if (error) throw error;
          insertedId = data?.id || null;
        } catch (err) {
          console.error("[ID2GO Booking] Supabase Save Error:", err);
          alert(
            `Booking failed: ${
              err.message || "Could not verify account ownership."
            }`
          );
          btnConfirmBooking.disabled = false;
          btnConfirmBooking.textContent = "Confirm Booking";
          return;
        }
      }

      const activeObj = {
        service: service,
        date: selectedDate,
        time: selectedTimeSlot,
        queueNumber: generatedQueueNumber,
        fullName: studentInfo.fullName,
        studentId: studentInfo.studentId,
        courseProgram: studentInfo.courseProgram,
        yearLevel: studentInfo.yearLevel,
        email: currentUser.email,
        mobileNumber: studentInfo.mobileNumber,
        emergencyName: studentInfo.emergencyName,
        emergencyRelationship: studentInfo.emergencyRelationship,
        emergencyPhone: studentInfo.emergencyPhone,
        dbId: insertedId
      };

      localStorage.setItem(userBookingCacheKey, JSON.stringify(activeObj));
      bookingData.activeBooking = activeObj;

      if (!slotBookings[selectedDate]) slotBookings[selectedDate] = {};
      const currentBooked = slotBookings[selectedDate][selectedTimeSlot] || 0;
      slotBookings[selectedDate][selectedTimeSlot] = currentBooked + 1;
      localStorage.setItem("id2go_slot_bookings", JSON.stringify(slotBookings));

      btnConfirmBooking.disabled = false;
      btnConfirmBooking.textContent = "Confirm Booking";

      renderDetailsStep(activeObj);
      goToStep(5);
    });
  }

  /* ==================== HELPER FUNCTIONS & LISTENERS ==================== */
  function formatDateString(year, month, day) {
    const m = month < 10 ? `0${month}` : month;
    const d = day < 10 ? `0${day}` : day;
    return `${year}-${m}-${d}`;
  }

  const btnBackHome = document.getElementById("btn-back-home");
  if (btnBackHome) {
    btnBackHome.addEventListener("click", () => {
      window.location.href = "dashboard.html";
    });
  }

  // Initial Load: Pre-fill Owner Profile first, then check Active Appointment
  await loadAndPopulateOwnerProfile();
  await checkExistingAppointment();
});