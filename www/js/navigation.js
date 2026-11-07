
(() => {
  "use strict";

  const db = window.ID2GoDB;

  const currentPage =
    window.location.pathname.split("/").pop() ||
    "index.html";

  const studentPages = [
    "dashboard.html",
    "booking.html",
    "profile.html",
    "notifications.html"
  ];

  const getStudent = async () => {
    if (!db) {
      throw new Error("Supabase client is unavailable.");
    }

    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    const { data: roleData, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    if (roleError) {
      throw new Error("Unable to verify student role.");
    }

    return roleData?.role === "student"
      ? data.user
      : null;
  };

  const logout = async () => {
    if (!db) {
      throw new Error("Supabase client is unavailable.");
    }

    const { error } = await db.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    window.location.replace("index.html");
  };

  const goToHome = () => {
    window.location.href = "dashboard.html";
  };

  const goToBooking = () => {
    window.location.href = "booking.html";
  };

  const goToProfile = () => {
    window.location.href = "profile.html";
  };

  const featureAvailable = async page => {
    try {
      const response = await fetch(page, {
        method: "HEAD",
        cache: "no-store"
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  };

  const showUnavailable = name => {
    let message = document.getElementById(
      "feature-unavailable-message"
    );

    if (!message) {
      message = document.createElement("div");
      message.id = "feature-unavailable-message";

      Object.assign(message.style, {
        position: "fixed",
        left: "50%",
        bottom: "100px",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: "420px",
        padding: "14px 18px",
        background: "#102f5e",
        color: "#ffffff",
        borderRadius: "9px",
        textAlign: "center",
        fontSize: "13px",
        zIndex: "9999"
      });

      message.setAttribute("role", "status");
      document.body.appendChild(message);
    }

    message.textContent =
      `${name} is not available right now.`;
  };

  const openFeature = async (page, name) => {
    const available = await featureAvailable(page);

    if (available) {
      window.location.href = page;
    } else {
      showUnavailable(name);
    }
  };

  const initializeNavigation = async () => {
    if (studentPages.includes(currentPage)) {
      let student;

      try {
        student = await getStudent();
      } catch (error) {
        console.error("Authentication error:", error);
        showUnavailable("Authentication");
        return;
      }

      if (!student) {
        window.location.replace("index.html");
        return;
      }

      const welcomeName = document.getElementById(
        "welcome-name"
      );

      if (welcomeName) {
        const fullName =
          student.user_metadata?.full_name ||
          student.email?.split("@")[0] ||
          "Student";

        const firstName =
          fullName.trim().split(/\s+/)[0];

        welcomeName.textContent = `${firstName}!`;
      }
    }

    const bookingButton = document.getElementById(
      "book-appointment-button"
    );

    if (bookingButton) {
      bookingButton.addEventListener("click", () => {
        openFeature(
          "booking.html",
          "Appointment Booking"
        );
      });
    }

    document.querySelectorAll(
      '[data-feature="booking"]'
    ).forEach(link => {
      link.addEventListener("click", event => {
        event.preventDefault();

        openFeature(
          "booking.html",
          "Appointment Booking"
        );
      });
    });

    const notificationButton = document.getElementById(
      "notification-button"
    );

    if (notificationButton) {
      notificationButton.addEventListener("click", () => {
        openFeature(
          "notifications.html",
          "Notifications"
        );
      });
    }

    const logoutButton = document.getElementById(
      "logout-button"
    );

    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        try {
          await logout();
        } catch (error) {
          console.error("Logout error:", error);
          showUnavailable("Logout");
          logoutButton.disabled = false;
        }
      });
    }
  };

  window.ID2Go = {
    getStudent,
    logout,
    goToHome,
    goToQueue: goToHome,
    goToBooking,
    goToProfile,
    openFeature
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeNavigation
    );
  } else {
    initializeNavigation();
  }
})();
