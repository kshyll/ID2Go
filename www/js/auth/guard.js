
(() => {
  "use strict";

  const db = window.ID2GoDB;

  const getCurrentUser = async () => {
    if (!db) {
      throw new Error("Supabase client unavailable.");
    }

    const { data, error } = await db.auth.getUser();

    if (error) throw error;

    return data.user || null;
  };

  const getRole = async userId => {
    const { data, error } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (error) throw error;

    return data?.role || null;
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
        throw new Error("Unauthorized account role.");
      }

      return user;
    } catch (error) {
      console.error("Access verification:", error);

      window.location.replace("index.html");
      return null;
    }
  };

  const logout = async () => {
    if (!db) {
      throw new Error("Supabase client unavailable.");
    }

    const { error } = await db.auth.signOut();

    if (error) throw error;

    window.location.replace("index.html");
  };

  window.ID2GoSession = {
    getCurrentUser,
    getRole,
    requireRole,
    logout
  };
})();
