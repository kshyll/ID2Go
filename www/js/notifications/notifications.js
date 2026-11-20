
(() => {
  "use strict";

  const db = window.ID2GoDB;
  const $ = id => document.getElementById(id);

  let currentUser = null;
  let notifications = [];
  let activeFilter = "all";
  let markingAll = false;
  let loading = false;
  let refreshPending = false;
  let channel = null;
  let refreshTimer = null;

  const setFeedback = message => {
    $("notification-feedback").textContent = message;
  };

  const formatDate = value => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "Date unavailable";

    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  const getIcon = type => {
    const icons = {
      appointment: "▦",
      queue: "☷",
      station: "⌖",
      service: "✓"
    };

    return icons[type] || "•";
  };

  const checkStudent = async () => {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      window.location.replace("index.html");
      return null;
    }

    const { data: role, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    if (roleError || role?.role !== "student") {
      window.location.replace("index.html");
      return null;
    }

    return data.user;
  };

  const loadNotifications = async () => {
    if (!currentUser) return;
    if (loading) {
      refreshPending = true;
      return;
    }

    loading = true;

    try {
      const { data, error } = await db
        .from("student_notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("student_user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      notifications = data || [];
      document.querySelectorAll(".filter-button").forEach(button => {
        button.disabled = false;
      });
      setFeedback("");
      render();
    } catch (error) {
      setFeedback("Unable to load notifications. Please reload and try again.");
      console.error(error);
    } finally {
      loading = false;

      if (refreshPending) {
        refreshPending = false;
        loadNotifications();
      }
    }
  };

  const markAsRead = async (notification, card) => {
    if (notification.is_read || card.disabled || markingAll) return;

    card.disabled = true;

    try {
      const { error } = await db
        .from("student_notifications")
        .update({ is_read: true })
        .eq("id", notification.id)
        .eq("student_user_id", currentUser.id);

      if (error) throw error;

      // A refresh can replace the list while the update is running.
      const item = notifications.find(item => item.id === notification.id);
      if (item) item.is_read = true;

      setFeedback("");
      render();
    } catch (error) {
      setFeedback("Unable to update notification. Please try again.");
    } finally {
      card.disabled = false;
    }
  };

  const markAllAsRead = async () => {
    if (markingAll || !notifications.some(item => !item.is_read)) return;

    markingAll = true;
    $("mark-all-read").disabled = true;

    // Change only rows we can see, so a new alert stays unread.
    const unreadIds = notifications.filter(item => !item.is_read).map(item => item.id);

    try {
      const { error } = await db
        .from("student_notifications")
        .update({ is_read: true })
        .eq("student_user_id", currentUser.id)
        .in("id", unreadIds)
        .eq("is_read", false);

      if (error) throw error;

      notifications.forEach(item => {
        if (unreadIds.includes(item.id)) item.is_read = true;
      });

      setFeedback("");
    } catch (error) {
      setFeedback("Unable to mark notifications as read. Please try again.");
    } finally {
      markingAll = false;
      render();
    }
  };

  const createCard = notification => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "notification-card";

    if (!notification.is_read) {
      card.classList.add("unread");
    }

    const icon = document.createElement("span");
    icon.className = "notification-icon";
    icon.textContent = getIcon(notification.type);
    icon.setAttribute("aria-hidden", "true");

    const body = document.createElement("span");
    body.className = "notification-body";

    const heading = document.createElement("span");
    heading.className = "notification-title";

    const title = document.createElement("strong");
    title.className = "notification-name";
    title.textContent = notification.title;

    heading.appendChild(title);

    if (!notification.is_read) {
      const dot = document.createElement("span");
      dot.className = "unread-dot";
      dot.setAttribute("aria-label", "Unread");
      heading.appendChild(dot);
    }

    const message = document.createElement("span");
    message.className = "notification-message";
    message.textContent = notification.message;

    const time = document.createElement("span");
    time.className = "notification-time";
    time.textContent = formatDate(
      notification.created_at
    );

    body.append(heading, message, time);
    card.append(icon, body);

    card.addEventListener("click", () => {
      markAsRead(notification, card);
    });

    return card;
  };

  const render = () => {
    const unreadCount = notifications.filter(
      item => !item.is_read
    ).length;

    const badge = $("unread-badge");
    badge.textContent = String(unreadCount);
    badge.hidden = unreadCount === 0;

    $("mark-all-read").disabled = markingAll || unreadCount === 0;

    const visible = notifications.filter(item => {
      return activeFilter === "all" || !item.is_read;
    });

    const list = $("notifications-list");
    list.replaceChildren();

    visible.forEach(item => {
      list.appendChild(createCard(item));
    });

    const empty = $("notifications-empty");
    empty.hidden = visible.length > 0;

    const emptyTitle = empty.querySelector("h3");
    const emptyText = empty.querySelector("p");

    if (activeFilter === "unread") {
      emptyTitle.textContent = "You're all caught up";
      emptyText.textContent =
        "You have no unread notifications.";
    } else {
      emptyTitle.textContent = "No notifications";
      emptyText.textContent =
        "Your appointment and queue updates will appear here.";
    }
  };

  const subscribeToUpdates = () => {
    channel = db
      .channel(`student-notifications-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_notifications",
          filter: `student_user_id=eq.${currentUser.id}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();
  };

  const initialize = async () => {
    if (!db) {
      setFeedback("Supabase is not configured.");
      return;
    }

    setFeedback("Loading notifications...");

    try {
      currentUser = await checkStudent();
    } catch (error) {
      setFeedback("Unable to check your session. Please reload and try again.");
      return;
    }

    if (!currentUser) return;

    document.querySelectorAll(".filter-button")
      .forEach(button => {
        button.addEventListener("click", () => {
          activeFilter = button.dataset.filter;

          document.querySelectorAll(".filter-button")
            .forEach(item => {
              const isActive = item === button;
              item.classList.toggle("active", isActive);
              item.setAttribute("aria-pressed", String(isActive));
            });

          render();
        });
      });

    $("mark-all-read").addEventListener(
      "click",
      markAllAsRead
    );

    await loadNotifications();
    subscribeToUpdates();

    refreshTimer = setInterval(
      loadNotifications,
      30000
    );
  };

  window.addEventListener("pagehide", () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    if (channel) {
      db.removeChannel(channel);
    }
  });

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );
})();
