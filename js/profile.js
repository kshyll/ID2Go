// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://rvmhhggglfgiripeaufw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_S-RGE0NTsajME2hnJ1QGGw_H0SUtj-m";

// Initialize Supabase client
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

document.addEventListener("DOMContentLoaded", () => {
  initProfilePage();
});

async function initProfilePage() {
  setupTitleCaseInputs();
  const studentData = await loadStudentProfile();

  if (studentData) {
    populateProfileInputs(studentData);
  }

  setupProfileFormSubmit();
  setupLogout();
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

    // Capitalize while typing while preserving cursor position
    input.addEventListener("input", (e) => {
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      e.target.value = formatTitleCase(e.target.value);
      e.target.setSelectionRange(start, end);
    });

    // Clean up extra spacing on blur
    input.addEventListener("blur", (e) => {
      e.target.value = formatTitleCase(e.target.value.trim());
    });
  });
}

/**
 * Validates Email Address format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates Student ID format (e.g. 2023-0001 or alphanumeric ID of 4 to 15 chars)
 */
function isValidStudentId(studentId) {
  const idRegex = /^[0-9A-Za-z-]{4,15}$/;
  return idRegex.test(studentId);
}

/**
 * Loads student profile data from Supabase profiles table or local storage fallback
 */
async function loadStudentProfile() {
  const activeStudentId = localStorage.getItem("id2go_active_student_id");

  // 1. Fetch from Supabase
  if (db) {
    try {
      // Check for logged-in auth user session
      const { data: authData } = await db.auth.getUser();
      const authUser = authData?.user;

      // Note: Update "student_profiles" to "profiles" if your table is named "profiles"
      let query = db.from("student_profiles").select("*");

      if (authUser) {
        query = query.eq("user_id", authUser.id);
      } else if (activeStudentId) {
        query = query.eq("student_id", activeStudentId);
      } else {
        query = null;
      }

      if (query) {
        // Using .maybeSingle() prevents PGRST116 exceptions on new accounts with no row
        const { data, error } = await query.maybeSingle();

        if (data && !error) {
          return {
            fullName: data.full_name,
            studentId: data.student_id,
            courseProgram: data.course_program,
            yearLevel: data.year_level,
            email: data.email,
            mobileNumber: data.mobile_number,
            emergencyName: data.emergency_name,
            emergencyRelationship: data.emergency_relationship,
            emergencyPhone: data.emergency_phone
          };
        }
      }
    } catch (err) {
      console.warn("Supabase profile fetch error:", err);
    }
  }

  // 2. Local storage fallback
  const storedUser = localStorage.getItem("id2go_user_profile");
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
 * Fills inputs and dropdowns with student profile values safely
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
  setFieldValue("email", data.email);
  setFieldValue("mobileNumber", data.mobileNumber);
  setFieldValue("emergencyName", data.emergencyName);
  setFieldValue("emergencyRelationship", data.emergencyRelationship);
  setFieldValue("emergencyPhone", data.emergencyPhone);
}

/**
 * Handles validation and form submission to Supabase and LocalStorage
 */
function setupProfileFormSubmit() {
  const profileForm = document.getElementById("profile-form");
  if (!profileForm) return;

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const titleCase = (str) => str.trim().replace(/\b\w/g, (c) => c.toUpperCase());

    const studentIdEl = document.getElementById("studentId");
    const emailEl = document.getElementById("email");

    const studentIdInput = studentIdEl ? studentIdEl.value.trim() : "";
    const emailInput = emailEl ? emailEl.value.trim() : "";

    // Field Validations
    if (!isValidStudentId(studentIdInput)) {
      alert("Please enter a valid Student ID (e.g., 2023-0001).");
      if (studentIdEl) studentIdEl.focus();
      return;
    }

    if (!isValidEmail(emailInput)) {
      alert("Please enter a valid email address (e.g., student@xu.edu.ph).");
      if (emailEl) emailEl.focus();
      return;
    }

    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };

    // Database mapping payload
    const dbPayload = {
      student_id: studentIdInput,
      full_name: titleCase(getVal("fullName")),
      course_program: getVal("courseProgram"),
      year_level: getVal("yearLevel"),
      email: emailInput,
      mobile_number: getVal("mobileNumber").trim(),
      emergency_name: titleCase(getVal("emergencyName")),
      emergency_relationship: getVal("emergencyRelationship"),
      emergency_phone: getVal("emergencyPhone").trim(),
      updated_at: new Date().toISOString()
    };

    // Attach user_id if authenticated session exists
    if (db) {
      const { data: authData } = await db.auth.getUser();
      if (authData?.user) {
        dbPayload.user_id = authData.user.id;
      }
    }

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

    // Cache locally
    localStorage.setItem("id2go_user_profile", JSON.stringify(localPayload));
    localStorage.setItem("id2go_active_student_id", dbPayload.student_id);

    // Upsert into Supabase database
    if (db) {
      try {
        // Match table name in Supabase ("student_profiles" or "profiles")
        const targetTable = "student_profiles"; 
        const conflictTarget = dbPayload.user_id ? "user_id" : "student_id";

        const { error } = await db
          .from(targetTable)
          .upsert(dbPayload, { onConflict: conflictTarget });

        if (error) throw error;
        alert("Profile saved and synced to database successfully!");
      } catch (err) {
        console.error("Database save error details:", err.message || err);
        alert(`Profile saved locally, but database sync failed: ${err.message || 'Check console'}`);
      }
    } else {
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

    localStorage.removeItem("id2go_user_profile");
    localStorage.removeItem("id2go_active_student_id");

    if (db && db.auth) {
      try {
        await db.auth.signOut();
      } catch (err) {
        console.warn("Sign out error:", err);
      }
    }

    window.location.href = "login.html";
  });
}