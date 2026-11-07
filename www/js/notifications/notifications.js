
(() => {
  "use strict";

  const db = window.ID2GoDB;
  const $ = id => document.getElementById(id);

  let currentUser = null;
  let notifications = [];
  let activeFilter = "all";
  let channel = null;
  let refreshTimer = null;

  const setFeedback = message => {
    $("notification-feedback").textContent = message;
  };

  const formatDate = value => {
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
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

    const { data, error } = await db
      .from("student_notifications")
      .select(
        "id, title, message, type, is_read, created_at"
      )
      .eq("student_user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setFeedback("Unable to load notifications.");
      console.error(error);
      return;
    }

    notifications = data || [];
    setFeedback("");
    render();
  };

  const markAsRead = async id => {
    const notification = notifications.find(
      item => item.id === id
    );

    if (!notification || notification.is_read) return;

    const { error } = await db
      .from("student_notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("student_user_id", currentUser.id);

    if (error) {
      setFeedback("Unable to update notification.");
      return;
    }

    notification.is_read = true;
    render();
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(
      item => !item.is_read
    );

    if (!unread.length) return;

    const button = $("mark-all-read");
    button.disabled = true;

    const { error } = await db
      .from("student_notifications")
      .update({ is_read: true })
      .eq("student_user_id", currentUser.id)
      .eq("is_read", false);

    if (error) {
      setFeedback("Unable to mark notifications as read.");
    } else {
      notifications.forEach(item => {
        item.is_read = true;
      });

      setFeedback("");
      render();
    }

    button.disabled = false;
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

    const body = document.createElement("div");
    body.className = "notification-body";

    const heading = document.createElement("div");
    heading.className = "notification-title";

    const title = document.createElement("h4");
    title.textContent = notification.title;

    heading.appendChild(title);

    if (!notification.is_read) {
      const dot = document.createElement("span");
      dot.className = "unread-dot";
      dot.setAttribute("aria-label", "Unread");
      heading.appendChild(dot);
    }

    const message = document.createElement("p");
    message.textContent = notification.message;

    const time = document.createElement("span");
    time.className = "notification-time";
    time.textContent = formatDate(
      notification.created_at
    );

    body.append(heading, message, time);
    card.append(icon, body);

    card.addEventListener("click", () => {
      markAsRead(notification.id);
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

    $("mark-all-read").disabled = unreadCount === 0;

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

    currentUser = await checkStudent();

    if (!currentUser) return;

    document.querySelectorAll(".filter-button")
      .forEach(button => {
        button.addEventListener("click", () => {
          activeFilter = button.dataset.filter;

          document.querySelectorAll(".filter-button")
            .forEach(item => {
              item.classList.toggle(
                "active",
                item === button
              );
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
