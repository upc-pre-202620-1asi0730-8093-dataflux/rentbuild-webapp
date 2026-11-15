// Development-only contracts for the features migrated from Angular.
// Numeric demo tokens are not production authentication.
module.exports = function mountMigrationRoutes(server, db) {
  const list = (key) => db.get(key).value() || [];
  const find = (key, id) => list(key).find((x) => Number(x.id) === Number(id));
  const fail = (res, status, message) => res.status(status).json({ message });
  const save = (key, item) => {
    db.get(key).find({ id: item.id }).assign(item).write();
    return item;
  };
  const day = (value) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(
      new Date(value),
    );
  const validDay = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    !Number.isNaN(Date.parse(value + "T12:00:00-05:00")) &&
    day(value + "T12:00:00-05:00") === value;
  const overlaps = (a, b, c, d) => a <= d && c <= b;
  function user(req, res, role) {
    const id = Number(
      (req.headers.authorization || "").replace(/^Bearer /, ""),
    );
    const current = find("users", id);
    if (!current || current.status !== "active") {
      fail(res, 401, "Sign in required");
      return null;
    }
    if (role && current.role !== role) {
      fail(res, 403, "Role is not authorized");
      return null;
    }
    return current;
  }
  const blocked = (id) =>
    list("incidents").some(
      (x) => x.equipmentId === id && x.blocksRental && x.status === "OPEN",
    );
  function available(equipment, start, end) {
    if (equipment.status !== "AVAILABLE" || blocked(equipment.id)) return false;
    if (
      (equipment.availabilityBlocks || []).some((x) =>
        overlaps(
          start,
          end,
          String(x.startDate).slice(0, 10),
          String(x.endDate).slice(0, 10),
        ),
      )
    )
      return false;
    return !list("rentals").some(
      (x) =>
        x.equipmentId === equipment.id &&
        ["CONFIRMED", "ACTIVE"].includes(x.status) &&
        overlaps(start, end, day(x.startDate), day(x.endDate)),
    );
  }
  server.post("/api/v1/authentication/password-recovery", (req, res) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email || ""))
      return fail(res, 400, "Invalid email");
    // Honest demo response: there is no mail provider in json-server.
    return fail(
      res,
      501,
      "Password recovery requires the production backend and mail provider",
    );
  });
  server.get("/api/v1/equipment/:id/availability", (req, res) => {
    if (!user(req, res)) return;
    const equipment = find("equipment", req.params.id);
    if (!equipment) return fail(res, 404, "Equipment not found");
    const { startDate, endDate } = req.query;
    if (!validDay(startDate) || !validDay(endDate) || startDate > endDate)
      return fail(res, 400, "Invalid rental dates");
    res.json({ available: available(equipment, startDate, endDate) });
  });
  server.patch("/api/v1/rental-requests/:id/period", (req, res) => {
    const current = user(req, res, "construction_company");
    if (!current) return;
    const record = find("rental-requests", req.params.id);
    if (!record) return fail(res, 404, "Request not found");
    if (record.constructionUserId !== current.id)
      return fail(res, 403, "Request belongs to another company");
    if (record.status !== "PENDING")
      return fail(res, 409, "Only pending requests can be rescheduled");
    const { startDate, endDate } = req.body;
    if (
      typeof startDate !== "string" ||
      typeof endDate !== "string" ||
      !Number.isFinite(Date.parse(startDate)) ||
      !Number.isFinite(Date.parse(endDate)) ||
      Date.parse(startDate) > Date.parse(endDate)
    )
      return fail(res, 400, "Invalid period");
    const start = day(startDate),
      end = day(endDate);
    if (start < day(new Date()))
      return fail(res, 422, "Rental start date cannot be in the past");
    const equipment = find("equipment", record.equipmentId);
    if (!equipment) return fail(res, 404, "Equipment not found");
    const duplicate = list("rental-requests").some(
      (x) =>
        x.id !== record.id &&
        x.equipmentId === record.equipmentId &&
        x.constructionUserId === current.id &&
        ["PENDING", "APPROVED"].includes(x.status) &&
        overlaps(start, end, day(x.startDate), day(x.endDate)),
    );
    if (duplicate || !available(equipment, start, end))
      return fail(res, 409, "Conflicting request or unavailable period");
    res.json(save("rental-requests", { ...record, startDate, endDate }));
  });
  server.get("/api/v1/maintenances/equipment/:id/history", (req, res) => {
    const current = user(req, res, "rental_company");
    if (!current) return;
    const equipment = find("equipment", req.params.id);
    if (!equipment) return fail(res, 404, "Equipment not found");
    if (equipment.userId !== current.id)
      return fail(res, 403, "Equipment belongs to another company");
    const entries = [
      ...list("rentals")
        .filter((x) => x.equipmentId === equipment.id)
        .map((x) => ({
          id: x.id,
          kind: "RENTAL",
          occurredAt: x.startDate,
          description: "Rental #" + x.id,
          status: x.status,
        })),
      ...list("incidents")
        .filter((x) => x.equipmentId === equipment.id)
        .map((x) => ({
          id: x.id,
          kind: "INCIDENT",
          occurredAt: x.reportedAt,
          description: x.description,
          status: x.status,
        })),
      ...list("maintenances")
        .filter((x) => x.equipmentId === equipment.id)
        .map((x) => ({
          id: x.id,
          kind: "MAINTENANCE",
          occurredAt: x.performedAt,
          description: x.type,
          status: x.status,
        })),
    ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    res.json({
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      entries,
    });
  });
  server.patch("/api/v1/maintenances/:id", (req, res) => {
    const current = user(req, res, "rental_company");
    if (!current) return;
    const record = find("maintenances", req.params.id);
    if (!record) return fail(res, 404, "Maintenance not found");
    if (find("equipment", record.equipmentId)?.userId !== current.id)
      return fail(res, 403, "Maintenance belongs to another company");
    if (
      !["SCHEDULED", "IN_PROGRESS"].includes(record.status) ||
      req.body.status !== "COMPLETED"
    )
      return fail(res, 409, "Invalid maintenance transition");
    if (
      record.status === "SCHEDULED" &&
      day(record.performedAt) > day(new Date())
    )
      return fail(res, 409, "Maintenance is not due");
    if (typeof req.body.technician !== "string" || !req.body.technician.trim())
      return fail(res, 400, "Technician is required");
    res.json(
      save("maintenances", {
        ...record,
        status: "COMPLETED",
        technician: req.body.technician.trim(),
        notes: String(req.body.notes || "").trim(),
      }),
    );
  });
  server.post("/api/v1/incidents/equipment/:id/reactivate", (req, res) => {
    const current = user(req, res, "rental_company");
    if (!current) return;
    const equipment = find("equipment", req.params.id);
    if (!equipment) return fail(res, 404, "Equipment not found");
    if (equipment.userId !== current.id)
      return fail(res, 403, "Equipment belongs to another company");
    if (req.body.inspectionConfirmed !== true)
      return fail(res, 400, "Inspection confirmation required");
    const active = list("rentals").some(
      (x) => x.equipmentId === equipment.id && x.status === "ACTIVE",
    );
    const pending = list("maintenances").some(
      (x) =>
        x.equipmentId === equipment.id &&
        ["SCHEDULED", "IN_PROGRESS"].includes(x.status),
    );
    if (
      equipment.status !== "MAINTENANCE" ||
      blocked(equipment.id) ||
      active ||
      pending
    )
      return fail(
        res,
        409,
        "Equipment has unresolved operational restrictions",
      );
    save("equipment", { ...equipment, status: "AVAILABLE" });
    res.status(204).end();
  });
  // In the migrated workflow the server applies the incident and inventory restriction together.
  server.post("/api/v1/incidents", (req, res, next) => {
    const current = user(req, res, "rental_company");
    if (!current) return;
    const equipment = find("equipment", req.body.equipmentId);
    if (!equipment || equipment.userId !== current.id)
      return fail(res, 403, "Equipment belongs to another company");
    if (
      typeof req.body.description !== "string" ||
      !req.body.description.trim()
    )
      return fail(res, 400, "Description is required");
    const item = {
      ...req.body,
      id: Math.max(0, ...list("incidents").map((x) => Number(x.id))) + 1,
      equipmentId: equipment.id,
      status: "OPEN",
      resolvedAt: null,
      blocksRental: req.body.blocksRental === true,
    };
    if (!Number.isFinite(Date.parse(item.reportedAt)))
      item.reportedAt = new Date().toISOString();
    db.get("incidents").push(item).write();
    if (item.blocksRental)
      save("equipment", { ...equipment, status: "MAINTENANCE" });
    res.status(201).json(item);
  });
  server.patch("/api/v1/incidents/:id", (req, res, next) => {
    const current = user(req, res, "rental_company");
    if (!current) return;
    const item = find("incidents", req.params.id);
    if (!item) return fail(res, 404, "Incident not found");
    const equipment = find("equipment", item.equipmentId);
    if (equipment?.userId !== current.id)
      return fail(res, 403, "Incident belongs to another company");
    if (item.status !== "OPEN")
      return fail(res, 409, "Incident already resolved");
    if (req.body.status === "RESOLVED") {
      if (!Number.isFinite(Date.parse(req.body.resolvedAt)))
        return fail(res, 400, "Resolution date required");
      return res.json(
        save("incidents", {
          ...item,
          status: "RESOLVED",
          resolvedAt: req.body.resolvedAt,
        }),
      );
    }
    if (req.body.blocksRental === true) {
      save("equipment", { ...equipment, status: "MAINTENANCE" });
      return res.json(save("incidents", { ...item, blocksRental: true }));
    }
    return fail(res, 400, "Invalid incident transition");
  });
  server.patch("/api/v1/user-subscriptions/:id/cancel", (req, res) => {
    const current = user(req, res, "rental_company");
    if (!current) return;
    const item = find("user-subscriptions", req.params.id);
    if (!item) return fail(res, 404, "Subscription not found");
    if (item.userId !== current.id)
      return fail(res, 403, "Subscription belongs to another user");
    res.json(
      save("user-subscriptions", {
        ...item,
        status: "CANCELLED",
        autoRenew: false,
      }),
    );
  });
};
