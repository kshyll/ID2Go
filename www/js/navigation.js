
(() => {
  "use strict";

  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  const studentPages = [
    "queue.html",
    "booking.html",
    "profile.html"
  ];

  const getStudent = () => {
    try {
      const savedStudent = localStorage.getItem("id2go_student");
      return savedStudent ? JSON.parse(savedStudent) : null;
    } catch (error) {
      console.error("Unable to load student:", error);
      return null;
    }
  };

  const logout = () => {
    localStorage.removeItem("id2go_student");
    window.location.replace("index.html");
  };

  const goToQueue = () => {
    window.location.href = "queue.html";
  };

  const goToBooking = () => {
    window.location.href = "booking.html";
  };

  const goToProfile = () => {
    window.location.href = "profile.html";
  };

  const goToLogin = () => {
    window.location.href = "index.html";
  };

  window.ID2Go = {
    getStudent,
    logout,
    goToQueue,
    goToBooking,
    goToProfile,
    goToLogin
  };

  if (studentPages.includes(currentPage) && !getStudent()) {
    window.location.replace("index.html");
    return;
  }

  const createBottomNavigation = () => {
    if (!studentPages.includes(currentPage)) {
      return;
    }

    document.body.classList.add("has-id2go-nav");

    document.querySelectorAll(".bottom-nav").forEach(nav => {
      nav.remove();
    });

    const existingNavigation = document.querySelector(
      ".id2go-bottom-nav"
    );

    if (existingNavigation) {
      existingNavigation.remove();
    }

    const navigationItems = [
      {
        page: "queue.html",
        label: "Home",
        icon: "⌂"
      },
      {
        page: "booking.html",
        label: "Book",
        icon: "▦"
      },
      {
        page: "profile.html",
        label: "Profile",
        icon: "♙"
      }
    ];

    const navigation = document.createElement("nav");

    navigation.className = "id2go-bottom-nav";
    navigation.setAttribute(
      "aria-label",
      "Student Navigation"
    );

    navigationItems.forEach(item => {
      const link = document.createElement("a");

      link.href = item.page;

      if (currentPage === item.page) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.textContent = item.icon;
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "nav-label";
      label.textContent = item.label;

      link.appendChild(icon);
      link.appendChild(label);

      navigation.appendChild(link);
    });

    document.body.appendChild(navigation);
  };

  const connectBookingButton = () => {
    if (currentPage !== "queue.html") {
      return;
    }

    const bookingButton = document.querySelector(
      "#view-normal .btn-primary"
    );

    if (bookingButton) {
      bookingButton.addEventListener("click", () => {
        goToBooking();
      });
    }
  };

  const initializeNavigation = () => {
    createBottomNavigation();
    connectBookingButton();
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
