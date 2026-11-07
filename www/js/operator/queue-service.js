(() => {
  "use strict";

  const db = window.ID2GoDB;

  if (!db) {
    throw new Error("Supabase client is not initialized.");
  }

  const execute = async (name, parameters = {}) => {
    const { data, error } = await db.rpc(name, parameters);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  };

  const getOperator = async () => {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      throw new Error("Please sign in to continue.");
    }

    const { data: role, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    if (roleError || role?.role !== "operator") {
      throw new Error("Operator access is required.");
    }

    return data.user;
  };

  const getDashboard = () =>
    execute("operator_queue_dashboard");

  const getQueue = () =>
    execute("operator_queue_list");

  const callNext = () =>
    execute("operator_call_next");

  const confirmArrival = queueId =>
    execute("operator_confirm_arrival", {
      p_queue_id: queueId
    });

  const moveToStandby = queueId =>
    execute("operator_move_standby", {
      p_queue_id: queueId
    });

  const completeService = queueId =>
    execute("operator_complete_service", {
      p_queue_id: queueId
    });

  const markReturned = queueId =>
    execute("operator_mark_returned", {
      p_queue_id: queueId
    });

  const signOut = async () => {
    const { error } = await db.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    window.location.replace("index.html");
  };

  window.OperatorQueueService = {
    getOperator,
    getDashboard,
    getQueue,
    callNext,
    confirmArrival,
    moveToStandby,
    completeService,
    markReturned,
    signOut
  };
})();