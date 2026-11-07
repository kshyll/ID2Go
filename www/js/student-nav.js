
(() => {
  "use strict";

  const icons = {
    home: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 10 9-7 9 7v10H3z"/>
        <path d="M9 21v-7h6v7"/>
      </svg>
    `,
    book: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2"/>
        <path d="M7 3v4M17 3v4M3 10h18"/>
      </svg>
    `,
    profile: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 21v-2a8 8 0 0 1 16 0v2"/>
      </svg>
    `
  };

  const pages = [
    {
      label: "Home",
      href: "dashboard.html",
      icon: "home"
    },
    {
      label: "Book",
      href: "booking.html",
      icon: "book"
    },
    {
      label: "Profile",
      href: "profile.html",
      icon: "profile"
    }
  ];

  const currentPage = () => {
    const page = window.location.pathname
      .split("/")
      .pop()
      .toLowerCase();

    if (page === "notifications.html") {
      return "dashboard.html";
    }

    return page;
  };

  const renderNavigation = () => {
    document.querySelectorAll(
      ".student-bottom-nav, .bottom-navigation"
    ).forEach(nav => nav.remove());

    const nav = document.createElement("nav");

    nav.className = "student-bottom-nav";
    nav.setAttribute(
      "aria-label",
      "Student navigation"
    );

    pages.forEach(page => {
      const link = document.createElement("a");

      link.href = page.href;
      link.className = "student-nav-link";

      if (page.href === currentPage()) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }

      link.innerHTML = `
        ${icons[page.icon]}
        <span>${page.label}</span>
      `;

      nav.appendChild(link);
    });

    document.body.classList.add("has-student-nav");
    document.body.appendChild(nav);
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      renderNavigation
    );
  } else {
    renderNavigation();
  }
})();
