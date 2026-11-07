
(() => {
  "use strict";

  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  const studentPages = [
    "dashboard.html",
    "booking.html",
    "profile.html"
  ];

  const getStudent = () => {
    try {
      const data = localStorage.getItem("id2go_student");
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  };

  const logout = () => {
    localStorage.removeItem("id2go_student");
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

  const featureAvailable = async (page) => {
    try {
      const response = await fetch(page, {
        method: "GET",
        cache: "no-store"
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  };

  const showUnavailable = (name) => {
    let message = document.getElementById(
      "feature-unavailable-message"
    );

    if (!message) {
      message = document.createElement("div");
      message.id = "feature-unavailable-message";

      Object.assign(message.style, {
        position: "fixed",
        left: "50%",
        bottom: "105px",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: "420px",
        padding: "16px",
        background: "#103675",
        color: "#ffffff",
        borderRadius: "12px",
        textAlign: "center",
        fontSize: "14px",
        zIndex: "9999"
      });

      message.setAttribute("role", "status");
      document.body.appendChild(message);
    }

    message.textContent =
      `${name} is not available yet.`;
  };

  const openFeature = async (page, name) => {
    const available = await featureAvailable(page);

    if (available) {
      window.location.href = page;
    } else {
      showUnavailable(name);
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

  if (studentPages.includes(currentPage) && !getStudent()) {
    window.location.replace("index.html");
    return;
  }

  const initializeNavigation = () => {
    const student = getStudent();

    const welcomeName = document.getElementById(
      "welcome-name"
    );

    if (welcomeName && student) {
      const firstName =
        String(student.name || "Student")
          .trim()
          .split(/\s+/)[0];

      welcomeName.textContent = `${firstName}!`;
    }

    const bookingButton = document.getElementById(
      "book-appointment-button"
    );

    if (bookingButton) {
      bookingButton.addEventListener("click", () => {
        openFeature("booking.html", "Appointment Booking");
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
        showUnavailable("Notifications");
      });
    }

    const logoutButton = document.getElementById(
      "logout-button"
    );

    if (logoutButton) {
      logoutButton.addEventListener("click", logout);
    }
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
