import { test, expect } from "@playwright/test";
const api = "http://127.0.0.1:3100/api/v1";
test("migrated Vue workflows preserve identities, ownership and backend restrictions", async ({
  page,
  request,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const stamp = Date.now();
  let sequence = 0;
  async function signup(role) {
    const email = `migration-${role}-${stamp}-${++sequence}@example.com`;
    const r = await request.post(api + "/authentication/sign-up", {
      data: {
        firstName: "Migration",
        lastName: "QA",
        email,
        password: "RentBuild123!",
        companyName: "QA Company",
        role,
      },
    });
    expect(r.status()).toBe(201);
    return r.json();
  }
  const owner = await signup("rental_company"),
    builder = await signup("construction_company"),
    other = await signup("rental_company");
  const ownerHeaders = { Authorization: `Bearer ${owner.id}` },
    builderHeaders = { Authorization: `Bearer ${builder.id}` };
  async function create(collection, data) {
    const r = await request.post(api + "/" + collection, { data });
    expect(r.ok()).toBeTruthy();
    return r.json();
  }
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
  }).format(new Date());
  const start = today + "T00:00:00-05:00",
    end = today + "T23:59:59.999-05:00";
  const equipment = await create("equipment", {
    userId: owner.id,
    code: "QA-" + stamp,
    name: "Excavadora QA",
    description: "QA",
    categoryId: 1,
    location: "Lima",
    dailyRate: 100,
    weeklyRate: 500,
    currency: "PEN",
    status: "AVAILABLE",
    availabilityBlocks: [],
  });
  const subscription = await create("user-subscriptions", {
    userId: owner.id,
    planId: 3,
    startDate: new Date(Date.now() - 86400000).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    status: "ACTIVE",
    autoRenew: true,
  });
  const pending = await create("rental-requests", {
    equipmentId: equipment.id,
    constructionUserId: builder.id,
    rentalCompanyUserId: owner.id,
    startDate: new Date(Date.now() + 86400000 * 10).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 11).toISOString(),
    status: "PENDING",
    createdAt: new Date().toISOString(),
  });
  await page.addInitScript(() => localStorage.setItem("language", "es-419"));
  await page.goto("/iam/sign-in");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill(builder.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("RentBuild123!");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/rentals/my-requests/" + pending.id);
  await page
    .getByRole("button", { name: "Editar fechas", exact: true })
    .click();
  await page.getByLabel("Fecha de inicio", { exact: true }).fill(today);
  await page.getByLabel("Fecha de fin", { exact: true }).fill(today);
  await page
    .getByRole("button", { name: "Guardar fechas", exact: true })
    .click();
  await expect(
    page.getByText("Fechas actualizadas correctamente.", { exact: false }),
  ).toBeVisible();
  const saved = await (
    await request.get(api + "/rental-requests/" + pending.id)
  ).json();
  expect(saved.id).toBe(pending.id);
  expect(saved.startDate).toBe(new Date(start).toISOString());
  expect(saved.status).toBe("PENDING");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Editar fechas", exact: true }),
  ).toBeVisible();
  const forbidden = await request.patch(
    api + "/rental-requests/" + pending.id + "/period",
    { headers: ownerHeaders, data: { startDate: start, endDate: end } },
  );
  expect(forbidden.status()).toBe(403);
  await request.patch(api + "/rental-requests/" + pending.id, {
    data: { status: "APPROVED" },
  });
  const conflict = await request.patch(
    api + "/rental-requests/" + pending.id + "/period",
    { headers: builderHeaders, data: { startDate: start, endDate: end } },
  );
  expect(conflict.status()).toBe(409);
  await page.goto("/iam/sign-in");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill(owner.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("RentBuild123!");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  const maintenance = await create("maintenances", {
    equipmentId: equipment.id,
    performedAt: new Date(start).toISOString(),
    type: "Preventivo QA",
    status: "SCHEDULED",
  });
  await page.goto("/maintenance");
  await page.getByRole("button", { name: "Completar", exact: true }).click();
  await page
    .getByLabel("Técnico responsable", { exact: true })
    .fill("Técnico QA");
  await page
    .getByLabel("Confirmo que el trabajo de mantenimiento fue realizado.", {
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Marcar como completado", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Completar", exact: true }),
  ).toHaveCount(0);
  const completed = await (
    await request.get(api + "/maintenances/" + maintenance.id)
  ).json();
  expect(completed.status).toBe("COMPLETED");
  expect(completed.technician).toBe("Técnico QA");
  await page.getByRole("link", { name: "Ver historial", exact: true }).click();
  await expect(page.getByText("Preventivo QA", { exact: true })).toBeVisible();
  const notOwner = await request.get(
    api + "/maintenances/equipment/" + equipment.id + "/history",
    { headers: { Authorization: `Bearer ${other.id}` } },
  );
  expect(notOwner.status()).toBe(403);
  const incidentResponse = await request.post(api + "/incidents", {
    headers: ownerHeaders,
    data: {
      equipmentId: equipment.id,
      description: "Bloqueo QA",
      blocksRental: true,
      reportedAt: new Date().toISOString(),
    },
  });
  expect(incidentResponse.status()).toBe(201);
  const incident = await incidentResponse.json();
  let activation = await request.post(
    api + "/incidents/equipment/" + equipment.id + "/reactivate",
    { headers: ownerHeaders, data: { inspectionConfirmed: true } },
  );
  expect(activation.status()).toBe(409);
  await request.patch(api + "/incidents/" + incident.id, {
    headers: ownerHeaders,
    data: { status: "RESOLVED", resolvedAt: new Date().toISOString() },
  });
  activation = await request.post(
    api + "/incidents/equipment/" + equipment.id + "/reactivate",
    { headers: ownerHeaders, data: { inspectionConfirmed: true } },
  );
  expect(activation.status()).toBe(204);
  const availability = await request.get(
    api + "/equipment/" + equipment.id + "/availability",
    { headers: ownerHeaders, params: { startDate: today, endDate: today } },
  );
  expect(await availability.json()).toEqual({ available: true });
  await page.goto("/subscriptions/plans");
  await page
    .getByRole("button", {
      name: "¿Cancelar la suscripción actual?",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText(
      "Selecciona uno de los planes disponibles para activar tu suscripción",
      { exact: false },
    ),
  ).toBeVisible();
  const cancelled = await (
    await request.get(api + "/user-subscriptions/" + subscription.id)
  ).json();
  expect(cancelled.status).toBe("CANCELLED");
  expect(cancelled.autoRenew).toBe(false);
  await page.evaluate(() => localStorage.clear());
  await page.goto("/iam/recover-password");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill(owner.email);
  await page
    .getByRole("button", { name: "Solicitar recuperación", exact: true })
    .click();
  await expect(
    page.getByText("La recuperación aún no está disponible", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
