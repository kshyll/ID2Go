// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://rvmhhggglfgiripeaufw.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_S-RGE0NTsajME2hnJ1QGGw_H0SUtj-m";

let supabase = null;
if (window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

document.addEventListener("DOMContentLoaded", () => {
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

  // Booking system state
  const bookingData = {
    service: "First-Time ID Picture Taking",
    studentInfo: {},
    selectedDate: null,
    selectedTimeSlot: null,
    queueNumber: ""
  };

  let slotBookings = JSON.parse(localStorage.getItem("id2go_slot_bookings")) || {};

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
      steps[key].classList.remove("active");
    });
    steps[stepNumber].classList.add("active");
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

  /* ==================== TITLE CASE VALIDATION ==================== */
  // Capitalizes the first letter of every word automatically as user types or on blur
  function setupTitleCaseValidation(inputElement) {
    function formatTitleCase(value) {
      return value.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    inputElement.addEventListener("input", (e) => {
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      e.target.value = formatTitleCase(e.target.value);
      e.target.setSelectionRange(start, end);
    });

    inputElement.addEventListener("blur", (e) => {
      e.target.value = formatTitleCase(e.target.value.trim());
    });
  }

  const fullNameInput = document.getElementById("fullName");
  const emergencyNameInput = document.getElementById("emergencyName");
  setupTitleCaseValidation(fullNameInput);
  setupTitleCaseValidation(emergencyNameInput);

  /* ==================== STEP 1 ==================== */
  const btnStep1Next = document.getElementById("btn-step1-next");
  btnStep1Next.addEventListener("click", () => {
    const selectedRadio = document.querySelector('input[name="id_service"]:checked');
    if (selectedRadio) {
      bookingData.service = selectedRadio.value;
      goToStep(2);
    }
  });

  /* ==================== STEP 2 ==================== */
  const studentInfoForm = document.getElementById("student-info-form");

  studentInfoForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    // Auto-capitalize on submit to guarantee proper casing
    const titleCase = (str) => str.trim().replace(/\b\w/g, (c) => c.toUpperCase());

    bookingData.studentInfo = {
      fullName: titleCase(document.getElementById("fullName").value),
      studentId: document.getElementById("studentId").value.trim(),
      courseProgram: document.getElementById("courseProgram").value,
      yearLevel: document.getElementById("yearLevel").value,
      email: document.getElementById("email").value.trim(),
      mobileNumber: document.getElementById("mobileNumber").value.trim(),
      emergencyName: titleCase(document.getElementById("emergencyName").value),
      emergencyRelationship: document.getElementById("emergencyRelationship").value,
      emergencyPhone: document.getElementById("emergencyPhone").value.trim()
    };

    renderCalendar();
    goToStep(3);
  });

  /* ==================== STEP 3: CALENDAR & SLOTS ==================== */
  const monthYearLabel = document.getElementById("calendar-month-year");
  const calendarDaysContainer = document.getElementById("calendar-days");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const timeSlotsList = document.getElementById("time-slots-list");
  const selectedDateLabel = document.getElementById("selected-date-label");
  const btnStep3Next = document.getElementById("btn-step3-next");

  prevMonthBtn.addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  function renderCalendar() {
    monthYearLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    calendarDaysContainer.innerHTML = "";

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

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
          document.querySelectorAll(".cal-day").forEach(el => el.classList.remove("selected"));
          dayEl.classList.add("selected");
          bookingData.selectedDate = dateString;
          bookingData.selectedTimeSlot = null;
          btnStep3Next.disabled = true;

          renderTimeSlots(dateString, fullDate);
        });
      }

      calendarDaysContainer.appendChild(dayEl);
    }

    if (bookingData.selectedDate) {
      const [y, m, d] = bookingData.selectedDate.split("-").map(Number);
      renderTimeSlots(bookingData.selectedDate, new Date(y, m - 1, d));
    } else {
      timeSlotsList.innerHTML = `<p class="no-slots-notice">Please click a date on the calendar above.</p>`;
      selectedDateLabel.textContent = "Select a date from the calendar";
    }
  }

  async function renderTimeSlots(dateString, fullDate) {
    const formattedDateText = fullDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });

    selectedDateLabel.textContent = `Schedule for ${formattedDateText}`;
    timeSlotsList.innerHTML = "<p class='no-slots-notice'>Loading slots...</p>";

    let dbBookings = {};
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("time_slot")
          .eq("appointment_date", dateString);

        if (!error && data) {
          data.forEach((row) => {
            dbBookings[row.time_slot] = (dbBookings[row.time_slot] || 0) + 1;
          });
        }
      } catch (err) {
        console.warn("Supabase fetch error, using local fallback:", err);
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
          btnStep3Next.disabled = false;
        }

        slotEl.innerHTML = `
          <span class="slot-time">${slotText}</span>
          <span class="slot-count">${remainingSlots} left</span>
        `;

        slotEl.addEventListener("click", () => {
          document.querySelectorAll(".slot-item").forEach(el => el.classList.remove("selected"));
          slotEl.classList.add("selected");
          bookingData.selectedTimeSlot = slotText;
          btnStep3Next.disabled = false;
        });
      }

      timeSlotsList.appendChild(slotEl);
    });
  }

  btnStep3Next.addEventListener("click", () => {
    populateReviewStep();
    goToStep(4);
  });

  /* ==================== STEP 4 ==================== */
  const btnConfirmBooking = document.getElementById("btn-confirm-booking");

  function populateReviewStep() {
    document.getElementById("review-service").textContent = bookingData.service;
    document.getElementById("review-student-name").textContent = bookingData.studentInfo.fullName || "N/A";
    document.getElementById("review-student-course").textContent = `${bookingData.studentInfo.courseProgram || ""} (${bookingData.studentInfo.yearLevel || ""})`;

    if (bookingData.selectedDate) {
      const [y, m, d] = bookingData.selectedDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      document.getElementById("review-date").textContent = dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
    }

    document.getElementById("review-time").textContent = bookingData.selectedTimeSlot;
    document.getElementById("review-emergency").textContent = `${bookingData.studentInfo.emergencyName || ""} (${bookingData.studentInfo.emergencyRelationship || ""})`;
  }

  btnConfirmBooking.addEventListener("click", async () => {
    btnConfirmBooking.disabled = true;
    btnConfirmBooking.textContent = "Processing...";

    const { selectedDate, selectedTimeSlot, studentInfo, service } = bookingData;
    const generatedQueueNumber = `0${Math.floor(Math.random() * 90) + 10}`;
    bookingData.queueNumber = generatedQueueNumber;

    if (supabase) {
      try {
        const { data, error } = await supabase.from("appointments").insert([
          {
            full_name: studentInfo.fullName,
            student_id: studentInfo.studentId,
            course_program: studentInfo.courseProgram,
            year_level: studentInfo.yearLevel,
            email: studentInfo.email,
            mobile_number: studentInfo.mobileNumber,
            emergency_name: studentInfo.emergencyName,
            emergency_relationship: studentInfo.emergencyRelationship,
            emergency_phone: studentInfo.emergencyPhone,
            service: service,
            appointment_date: selectedDate,
            time_slot: selectedTimeSlot,
            queue_number: generatedQueueNumber,
            status: "Confirmed"
          }
        ]);

        if (error) throw error;
      } catch (err) {
        console.error("Supabase Save Error:", err);
      }
    }

    if (!slotBookings[selectedDate]) slotBookings[selectedDate] = {};
    const currentBooked = slotBookings[selectedDate][selectedTimeSlot] || 0;
    slotBookings[selectedDate][selectedTimeSlot] = currentBooked + 1;
    localStorage.setItem("id2go_slot_bookings", JSON.stringify(slotBookings));

    btnConfirmBooking.disabled = false;
    btnConfirmBooking.textContent = "Confirm Booking";

    document.getElementById("generated-queue-number").textContent = bookingData.queueNumber;
    document.getElementById("conf-service-title").textContent = bookingData.service;

    if (selectedDate) {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      document.getElementById("conf-date-display").textContent = dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
    }
    document.getElementById("conf-time-display").textContent = selectedTimeSlot;

    goToStep(5);
  });

  /* ==================== STEP 5 ==================== */
  document.getElementById("btn-go-dashboard").addEventListener("click", () => {
    alert("Navigating to Home Dashboard...");
  });

  document.getElementById("btn-view-details").addEventListener("click", () => {
    alert(`Appointment Details:\nQueue #: ${bookingData.queueNumber}\nService: ${bookingData.service}\nDate: ${bookingData.selectedDate}\nTime: ${bookingData.selectedTimeSlot}`);
  });

  function formatDateString(year, month, day) {
    const m = month < 10 ? `0${month}` : month;
    const d = day < 10 ? `0${day}` : day;
    return `${year}-${m}-${d}`;
  }
});