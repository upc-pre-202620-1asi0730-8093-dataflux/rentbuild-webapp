// Local demonstration contract only. Numeric tokens are not production authentication.
module.exports = function mountSubscriptionCancellation(server, db) {
  server.patch("/api/v1/user-subscriptions/:id/cancel", (req, res) => {
    const token = /^Bearer ([1-9]\d*)$/.exec(req.headers.authorization || "");
    const user =
      token &&
      db
        .get("users")
        .find((item) => Number(item.id) === Number(token[1]))
        .value();
    if (!user || user.status !== "active")
      return res.status(401).json({ message: "Sign in required" });
    if (user.role !== "rental_company")
      return res.status(403).json({ message: "Role is not authorized" });
    const subscription = db
      .get("user-subscriptions")
      .find((item) => String(item.id) === req.params.id)
      .value();
    if (!subscription)
      return res.status(404).json({ message: "Subscription not found" });
    if (Number(subscription.userId) !== Number(user.id))
      return res
        .status(403)
        .json({ message: "Subscription belongs to another user" });
    const cancelled = {
      ...subscription,
      status: "CANCELLED",
      autoRenew: false,
    };
    db.get("user-subscriptions")
      .find({ id: subscription.id })
      .assign(cancelled)
      .write();
    return res.json(cancelled);
  });
};
