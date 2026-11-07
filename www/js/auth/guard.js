
(() => {
  "use strict";

  const db = window.ID2GoDB;

  const getCurrentUser = async () => {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return data.user;
  };

  const getRole = async userId => {
    const { data, error } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.role;
  };

  const requireRole = async requiredRole => {
    try {
      const user = await getCurrentUser();

      if (!user) {
        window.location.replace("index.html");
        return null;
      }

      const role = await getRole(user.id);

      if (role !== requiredRole) {
        window.location.replace("index.html");
        return null;
      }

      return user;
    } catch (error) {
      console.error("Role verification failed:", error);
      window.location.replace("index.html");
      return null;
    }
  };

  const logout = async () => {
    const { error } = await db.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    window.location.replace("index.html");
  };

  window.ID2GoSession = {
    getCurrentUser,
    getRole,
    requireRole,
    logout
  };
})();
