
(() => {
  "use strict";

  const db = window.ID2GoDB;

  const routes = {
    student: "dashboard.html",
    operator: "operator.html",
    admin: "admin.html"
  };

  const $ = id => document.getElementById(id);

  const getCurrentUser = async () => {
    if (!db) {
      throw new Error("Supabase is unavailable.");
    }

    const { data, error } = await db.auth.getUser();

    if (error) throw error;

    return data.user || null;
  };

  const getUserRole = async userId => {
    const { data, error } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw new Error(
        "No role is assigned to this account. Contact the administrator."
      );
    }

    if (!Object.hasOwn(routes, data.role)) {
      throw new Error("Invalid account role.");
    }

    return data.role;
  };

  const login = async (email, password) => {
    if (!db) {
      throw new Error("Supabase is unavailable.");
    }

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (!data.user) {
      throw new Error("Authentication failed.");
    }

    try {
      const role = await getUserRole(data.user.id);
      return { user: data.user, role };
    } catch (error) {
      await db.auth.signOut();
      throw error;
    }
  };

  const logout = async () => {
    const { error } = await db.auth.signOut();

    if (error) throw error;

    window.location.replace("index.html");
  };

  const redirectByRole = role => {
    const destination = routes[role];

    if (!destination) {
      throw new Error("Unknown account role.");
    }

    window.location.replace(destination);
  };

  window.ID2GoAuth = {
    login,
    logout,
    getCurrentUser,
    getUserRole,
    redirectByRole
  };

  const initialize = async () => {
    const form = $("login-form");
    if (!form) return;

    const emailInput = $("login-email");
    const passwordInput = $("login-password");
    const toggleButton = $("toggle-password");
    const loginButton = $("login-button");
    const errorMessage = $("login-error");

    let busy = false;
    let redirecting = false;

    const showError = message => {
      errorMessage.textContent = message;
      errorMessage.hidden = false;
    };

    const setLoading = (loading, label = "Sign In") => {
      busy = loading;
      loginButton.disabled = loading;
      loginButton.textContent = label;
    };

    const navigate = async role => {
      const destination = routes[role];

      if (!destination) {
        throw new Error("Unknown account role.");
      }

      const response = await fetch(destination, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          "Your dashboard is not available. Contact the administrator."
        );
      }

      const html = await response.text();

      if (!html.trim()) {
        throw new Error(
          "Your dashboard has not been implemented yet."
        );
      }

      redirecting = true;
      redirectByRole(role);
    };

    toggleButton.addEventListener("click", () => {
      const show = passwordInput.type === "password";

      passwordInput.type = show ? "text" : "password";
      toggleButton.textContent = show ? "Hide" : "Show";
      toggleButton.setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password"
      );
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (busy || redirecting) return;

      errorMessage.hidden = true;
      setLoading(true, "Signing in...");

      try {
        const result = await login(
          emailInput.value.trim(),
          passwordInput.value
        );

        await navigate(result.role);
      } catch (error) {
        showError(error.message || "Unable to sign in.");
      } finally {
        if (!redirecting) setLoading(false);
      }
    });

    setLoading(true, "Checking session...");

    try {
      const user = await getCurrentUser();

      if (user) {
        const role = await getUserRole(user.id);
        await navigate(role);
      }
    } catch (error) {
      console.error("Session check:", error);
      showError(error.message || "Unable to verify session.");
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
