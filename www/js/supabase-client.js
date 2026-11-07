
(() => {
  "use strict";

  const SUPABASE_URL =
    "https://rvmhhggglfgiripeaufw.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_S-RGE0NTsajME2hnJ1QGGw_H0SUtj-m";

  if (!window.supabase) {
    throw new Error("Supabase library is unavailable.");
  }

  window.ID2GoDB = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );
})();
