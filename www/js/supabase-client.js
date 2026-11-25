
(() => {
  "use strict";

  const SUPABASE_URL = window.ID2GO_CONFIG?.supabaseUrl;

  const SUPABASE_KEY = window.ID2GO_CONFIG?.supabasePublishableKey;

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
