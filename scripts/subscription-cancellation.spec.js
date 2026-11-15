import { test, expect } from "@playwright/test";

test("member 4: confirmed cancellation persists and revokes subscription access", async ({
  page,
  request,
}) => {
  const api = "http://127.0.0.1:3100/api/v1";
  const email = `member4-${Date.now()}@example.com`;
  const registered = await request.post(`${api}/authentication/sign-up`, {
    data: {
      firstName: "Member",
      lastName: "Four",
      companyName: "Cancellation QA",
      email,
      password: "RentBuild123!",
      role: "rental_company",
    },
  });
  expect(registered.status()).toBe(201);
  const user = await registered.json();
  await page.addInitScript(() => localStorage.setItem("language", "es-419"));
  await page.goto("/iam/sign-in");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("RentBuild123!");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/subscriptions/plans");
  await page
    .getByRole("button", { name: "Seleccionar plan", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Plan actual", exact: true }),
  ).toBeVisible();
  const all = await (await request.get(`${api}/user-subscriptions`)).json();
  const subscription = all.find(
    (item) => Number(item.userId) === Number(user.id),
  );
  expect(subscription.status).toBe("ACTIVE");
  const contract = `${api}/user-subscriptions/${subscription.id}/cancel`;
  expect((await request.patch(contract, { data: {} })).status()).toBe(401);

  // Another valid rental account must not cancel this user's subscription.
  const other = await (
    await request.post(`${api}/authentication/sign-up`, {
      data: {
        firstName: "Other",
        lastName: "Account",
        companyName: "Other QA",
        email: `other-${email}`,
        password: "RentBuild123!",
        role: "rental_company",
      },
    })
  ).json();
  expect(
    (
      await request.patch(contract, {
        data: {},
        headers: { Authorization: `Bearer ${other.id}` },
      })
    ).status(),
  ).toBe(403);

  await page
    .getByRole("button", {
      name: "¿Cancelar la suscripción actual?",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Mantener mi plan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Plan actual", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "¿Cancelar la suscripción actual?",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Confirmar cancelación", exact: true })
    .click();
  await expect(
    page.getByText("La suscripción se canceló correctamente.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Plan actual", exact: true }),
  ).toHaveCount(0);
  const cancelled = await (
    await request.get(`${api}/user-subscriptions/${subscription.id}`)
  ).json();
  expect(cancelled).toMatchObject({
    id: subscription.id,
    status: "CANCELLED",
    autoRenew: false,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Seleccionar plan", exact: true }),
  ).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Plan actual", exact: true }),
  ).toHaveCount(0);
  await page.goto("/inventory/equipment/new");
  await expect(page).toHaveURL(/\/subscriptions\/plans/);
});
