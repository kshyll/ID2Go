
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
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return data.user;
  };

  const getUserRole = async userId => {
    const { data, error } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw new Error(
        "Your account has no assigned role. Contact the administrator."
      );
    }

    if (!Object.prototype.hasOwnProperty.call(routes, data.role)) {
      throw new Error("Your account has an invalid role.");
    }

    return data.role;
  };

  const login = async (email, password) => {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Authentication failed.");
    }

    try {
      const role = await getUserRole(data.user.id);

      return {
        user: data.user,
        role
      };
    } catch (error) {
      await db.auth.signOut();
      throw error;
    }
  };

  const logout = async () => {
    const { error } = await db.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    window.location.replace("index.html");
  };

  const redirectByRole = role => {
    const destination = routes[role];

    if (!destination) {
      throw new Error("Unknown user role.");
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

    if (!form) {
      return;
    }

    const emailInput = $("login-email");
    const passwordInput = $("login-password");
    const toggleButton = $("toggle-password");
    const loginButton = $("login-button");
    const errorMessage = $("login-error");

    const showError = message => {
      errorMessage.textContent = message;
      errorMessage.hidden = false;
    };

    const setLoading = (loading, message = "Sign In") => {
      loginButton.disabled = loading;
      loginButton.textContent = message;
    };

    toggleButton.addEventListener("click", () => {
      const hidden = passwordInput.type === "password";

      passwordInput.type = hidden ? "text" : "password";
      toggleButton.textContent = hidden ? "Hide" : "Show";
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();

      errorMessage.hidden = true;
      setLoading(true, "Signing in...");

      try {
        const result = await login(
          emailInput.value.trim(),
          passwordInput.value
        );

        redirectByRole(result.role);
      } catch (error) {
        showError(error.message || "Unable to sign in.");
      } finally {
        setLoading(false);
      }
    });

    setLoading(true, "Checking session...");

    try {
      const user = await getCurrentUser();

      if (user) {
        const role = await getUserRole(user.id);
        redirectByRole(role);
      }
    } catch (error) {
      showError(error.message || "Unable to verify session.");
    } finally {
      setLoading(false);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
