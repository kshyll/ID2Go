(() => {
  const store = window.OperatorStore;
  const views = window.OperatorViews;
  const root = document.getElementById("operator-app");
  const toast = document.getElementById("operator-toast");

  let page = store.getState().stationId ? "home" : "station";
  let context = {};
  let toastTimeout;

  function notify(text) {
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function render() {
    root.innerHTML = views.render(page, context);
  }

  function navigate(nextPage) {
    page = !store.getState().stationId && nextPage !== "station" ? "station" : nextPage;
    render();
    window.scrollTo(0, 0);
  }

  function runAction(action, id) {
    switch (action) {
      case "selectStation":
        store.selectStation(id);
        navigate("home");
        break;
      case "toggleAvailability":
        store.toggleAvailability();
        navigate("home");
        break;
      case "callNext":
        store.callNext();
        navigate("home");
        break;
      case "confirmArrival":
        store.confirmArrival();
        navigate("home");
        break;
      case "moveStandby":
        store.moveToStandby();
        navigate("home");
        break;
      case "markReturned":
        store.markReturned(id);
        navigate("returned");
        break;
      case "openStudent":
        context.appointmentId = store.current()?.id;
        navigate("student");
        break;
      case "openIssue":
        context.appointmentId = store.current()?.id;
        navigate("issue");
        break;
      case "verifyRequirements":
        store.verifyRequirements(context.appointmentId);
        navigate("requirements");
        notify("Requirements marked as checked.");
        break;
      case "completeService":
        store.completeService();
        navigate("home");
        break;
      case "readyNext":
        store.readyForNext();
        navigate("home");
        break;
      case "openStandby":
        navigate("standby");
        break;
      case "openHome":
        navigate("home");
        break;
      case "endSession":
        store.endSession();
        navigate("station");
        break;
    }
  }

  root.addEventListener("click", event => {
    const target = event.target.closest("[data-page], [data-action]");
    if (!target || target.disabled) return;
    try {
      if (target.dataset.page) navigate(target.dataset.page);
      else runAction(target.dataset.action, target.dataset.id);
    } catch (error) {
      notify(error.message);
    }
  });

  root.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      if (form.id === "issue-form") {
        store.reportIssue(values.issueType, values.notes);
        navigate("home");
        notify("Issue saved locally.");
      } else if (form.id === "station-change-form") {
        store.requestStationChange(values.station);
        navigate("stationChange");
        notify("Station change draft saved.");
      }
    } catch (error) {
      notify(error.message);
    }
  });

  root.addEventListener("change", event => {
    if (event.target.id !== "notification-toggle") return;
    store.setNotifications(event.target.checked);
    notify("Preference saved on this device.");
  });

  function updateTimers() {
    if (store.expireDeadlines()) {
      render();
      notify("A grace period expired. Queue updated.");
    }
    root.querySelectorAll("[data-countdown]").forEach(el => {
      const appointment = store.find(el.dataset.countdown);
      el.textContent = views.timer((appointment?.deadline || 0) - Date.now());
    });
    root.querySelectorAll("[data-elapsed]").forEach(el => {
      const appointment = store.find(el.dataset.elapsed);
      el.textContent = views.timer(Date.now() - (appointment?.serviceStartedAt || Date.now()));
    });
  }

  document.addEventListener("backbutton", () => {
    if (page === "requirements") navigate("student");
    else if (["student", "issue"].includes(page)) navigate("home");
    else if (["standby", "returned", "missed"].includes(page)) navigate("queue");
    else if (page === "stationChange") navigate("profile");
    else navigate("home");
  });

  window.ID2GOOperator = {
    receiveAppointments(rows) {
      const count = store.receiveAppointments(rows);
      render();
      return count;
    }
  };

  render();
  setInterval(updateTimers, 1000);
})();
