const db = window.ID2GoDB;

<<<<<<< Updated upstream
// Reuse global Supabase client if available
const db =
  window.ID2GoDB ||
  (window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null);

=======
>>>>>>> Stashed changes
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  initProfilePage();
});

async function initProfilePage() {
<<<<<<< Updated upstream
  if (db) {
    try {
      const { data, error } = await db.auth.getUser();
      if (!error && data?.user) {
        currentUser = data.user;
      }
    } catch (err) {
      console.error("Auth check failed:", err);
    }
  }

  if (!currentUser) {
    alert("Please log in to view or edit your student profile.");
    window.location.replace("index.html");
    return;
  }
=======
  currentUser = await window.ID2GoSession.requireRole("student");
  if (!currentUser) return;
>>>>>>> Stashed changes

  // Clear legacy unscoped cache keys
  localStorage.removeItem("id2go_user_profile");
  localStorage.removeItem("id2go_active_student_id");

  setupTitleCaseInputs();
  const studentData = await loadStudentProfile();

  populateProfileInputs(studentData || { email: currentUser.email });
  setupProfileFormSubmit();
  setupLogout();
}

function applyReadOnlyStyle(el) {
  if (!el) return;
  el.readOnly = true;
  el.style.backgroundColor = "#f1f5f9";
  el.style.color = "#475569";
  el.style.cursor = "not-allowed";
}

/**
 * Automatically capitalizes the first letter of each word as typed in name fields
 */
function setupTitleCaseInputs() {
  const nameFields = ["fullName", "emergencyName"];

  function formatTitleCase(str) {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  nameFields.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener("input", (e) => {
      if (e.target.readOnly) return;
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      e.target.value = formatTitleCase(e.target.value);
      e.target.setSelectionRange(start, end);
    });

    input.addEventListener("blur", (e) => {
      if (e.target.readOnly) return;
      e.target.value = formatTitleCase(e.target.value.trim());
    });
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidStudentId(studentId) {
  return /^[0-9A-Za-z-]{4,15}$/.test(studentId);
}

/**
 * Loads student profile data strictly for the logged-in user_id
 */
async function loadStudentProfile() {
  const cacheKey = `id2go_user_profile_${currentUser.id}`;

  if (db) {
    try {
      const { data, error } = await db
        .from("student_profiles")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (data && !error) {
        const mapped = {
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
        localStorage.setItem(cacheKey, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn("Supabase profile fetch error:", err);
    }
  }

  const storedUser = localStorage.getItem(cacheKey);
  if (storedUser) {
    try {
      return JSON.parse(storedUser);
    } catch (e) {
      console.warn("Failed to parse cached profile:", e);
    }
  }

  return null;
}

/**
 * Fills inputs and locks owner identity fields once established
 */
function populateProfileInputs(data) {
  const setFieldValue = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) {
      el.value = value;
    }
  };

  setFieldValue("fullName", data.fullName);
  setFieldValue("studentId", data.studentId);
  setFieldValue("courseProgram", data.courseProgram);
  setFieldValue("yearLevel", data.yearLevel);
  setFieldValue("email", currentUser.email || data.email);
  setFieldValue("mobileNumber", data.mobileNumber);
  setFieldValue("emergencyName", data.emergencyName);
  setFieldValue("emergencyRelationship", data.emergencyRelationship);
  setFieldValue("emergencyPhone", data.emergencyPhone);

  // Always lock account email
  applyReadOnlyStyle(document.getElementById("email"));

  // Lock Full Name and Student ID once saved so account owner cannot be swapped
  if (data.fullName && data.fullName.trim()) {
    applyReadOnlyStyle(document.getElementById("fullName"));
  }
  if (data.studentId && data.studentId.trim()) {
    applyReadOnlyStyle(document.getElementById("studentId"));
  }
}

/**
 * Handles validation and form submission to Supabase and user-scoped LocalStorage
 */
function setupProfileFormSubmit() {
  const profileForm = document.getElementById("profile-form");
  if (!profileForm) return;

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveButton = document.getElementById("save-profile-btn");
    if (saveButton.disabled) return;

    const titleCase = (str) =>
      str.trim().replace(/\b\w/g, (c) => c.toUpperCase());

    const fullNameEl = document.getElementById("fullName");
    const studentIdEl = document.getElementById("studentId");

    const fullNameInput = fullNameEl ? titleCase(fullNameEl.value) : "";
    const studentIdInput = studentIdEl ? studentIdEl.value.trim() : "";
    const emailInput = currentUser.email;

    if (!fullNameInput) {
      alert("Please enter your full name.");
      if (fullNameEl) fullNameEl.focus();
      return;
    }

    if (!isValidStudentId(studentIdInput)) {
      alert("Please enter a valid Student ID (e.g., 2023-0001).");
      if (studentIdEl) studentIdEl.focus();
      return;
    }

    if (!isValidEmail(emailInput)) {
      alert("Authenticated account email is invalid.");
      return;
    }

    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };

    const dbPayload = {
      user_id: currentUser.id,
      student_id: studentIdInput,
      full_name: fullNameInput,
      course_program: getVal("courseProgram"),
      year_level: getVal("yearLevel"),
      email: emailInput,
      mobile_number: getVal("mobileNumber").trim(),
      emergency_name: titleCase(getVal("emergencyName")),
      emergency_relationship: getVal("emergencyRelationship"),
      emergency_phone: getVal("emergencyPhone").trim(),
      updated_at: new Date().toISOString()
    };

    const localPayload = {
      fullName: dbPayload.full_name,
      studentId: dbPayload.student_id,
      courseProgram: dbPayload.course_program,
      yearLevel: dbPayload.year_level,
      email: dbPayload.email,
      mobileNumber: dbPayload.mobile_number,
      emergencyName: dbPayload.emergency_name,
      emergencyRelationship: dbPayload.emergency_relationship,
      emergencyPhone: dbPayload.emergency_phone
    };

    const cacheKey = `id2go_user_profile_${currentUser.id}`;

    if (db) {
      saveButton.disabled = true;
      try {
        const { error } = await db
          .from("student_profiles")
          .upsert(dbPayload, { onConflict: "user_id" });

        if (error) {
          if (error.code === "23505") {
            alert(
              "This Student ID is already linked to another account. Please enter your own Student ID."
            );
            return;
          }
          throw error;
        }

        localStorage.setItem(cacheKey, JSON.stringify(localPayload));
        applyReadOnlyStyle(fullNameEl);
        applyReadOnlyStyle(studentIdEl);
        alert("Profile saved! Your details will now auto-fill when booking.");
      } catch (err) {
        console.error("Database save error details:", err.message || err);
        alert(`Database sync failed: ${err.message || "Check console"}`);
<<<<<<< Updated upstream
=======
      } finally {
        saveButton.disabled = false;
>>>>>>> Stashed changes
      }
    } else {
      localStorage.setItem(cacheKey, JSON.stringify(localPayload));
      alert("Profile saved locally!");
    }
  });
}

/**
 * Session logout handler
 */
function setupLogout() {
  const logoutBtn = document.getElementById("logout-button");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to log out?")) return;

    if (currentUser) {
      localStorage.removeItem(`id2go_user_profile_${currentUser.id}`);
      localStorage.removeItem(`id2go_active_appointment_${currentUser.id}`);
    }

    if (window.ID2GoAuth?.logout) {
      await window.ID2GoAuth.logout();
      return;
    }

    if (db && db.auth) {
      try {
        const { error } = await db.auth.signOut();
        if (error) throw error;
      } catch (err) {
        alert("Unable to sign out. Please try again.");
        return;
      }
    }

    window.location.href = "index.html";
  });
}