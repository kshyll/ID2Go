
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

    if (error?.name === "AuthSessionMissingError") {
      return null;
    }

    if (error) {
      throw error;
    }

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

    if (!routes[data.role]) {
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

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("Unable to sign in.");
    }

    try {
      const role = await getUserRole(data.user.id);

      return {
        user: data.user,
        role: role
      };
    } catch (error) {
      await db.auth.signOut();
      throw error;
    }
  };

  const logout = async () => {
    if (!db) {
      throw new Error("Supabase is unavailable.");
    }

    const { error } = await db.auth.signOut();

    if (error) {
      throw error;
    }

    window.location.replace("index.html");
  };

  const redirectByRole = role => {
    const destination = routes[role];

    if (!destination) {
      throw new Error("Invalid account role.");
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
    const loginButtonLabel = $("login-button-label");
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
      loginButtonLabel.textContent = label;
    };

    toggleButton.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";

      passwordInput.type = isHidden ? "text" : "password";
      toggleButton.textContent = isHidden ? "Hide" : "Show";
      toggleButton.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password"
      );
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (busy || redirecting) {
        return;
      }

      errorMessage.hidden = true;
      setLoading(true, "Signing in...");

      try {
        const result = await login(
          emailInput.value.trim(),
          passwordInput.value
        );

        redirecting = true;
        redirectByRole(result.role);

      } catch (error) {
        if (error.code === "invalid_credentials") {
          showError(
            "Email or password is incorrect. Please try again."
          );
        } else {
          showError(error.message || "Unable to sign in.");
        }
      } finally {
        if (!redirecting) {
          setLoading(false);
        }
      }
    });

    setLoading(true, "Checking session...");

    try {
      const user = await getCurrentUser();

      if (user) {
        const role = await getUserRole(user.id);

        redirecting = true;
        redirectByRole(role);
      }

    } catch (error) {
      console.error("Session check:", error);

      showError(
        "Unable to verify your session. Please try signing in."
      );
    } finally {
      if (!redirecting) {
        setLoading(false);
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
