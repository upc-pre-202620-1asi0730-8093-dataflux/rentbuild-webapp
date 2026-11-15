import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSubscriptionsHarness } from "./tests/subscriptions-api-harness.js";

const subscription = {
  id: 7,
  userId: 1,
  planId: 3,
  status: "ACTIVE",
  autoRenew: true,
  startDate: "2030-01-01T00:00:00.000Z",
  endDate: "2030-02-01T00:00:00.000Z",
};
beforeEach(() => vi.setSystemTime(new Date("2030-01-15T00:00:00.000Z")));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function load() {
  const harness = await createSubscriptionsHarness({
    "user-subscriptions": [subscription],
  });
  harness.store.loadCurrentSubscription(1);
  await vi.waitFor(() =>
    expect(harness.store.subscriptionLoading.value).toBe(false),
  );
  expect(harness.store.currentSubscription.value?.id).toBe(7);
  return harness;
}

describe("Subscription cancellation", () => {
  it("uses the dedicated contract, preserves the record and revokes current access", async () => {
    const { store, db, calls } = await load();
    store.cancelCurrentSubscription();
    await vi.waitFor(() => expect(store.subscriptionLoading.value).toBe(false));
    expect(store.subscriptionError.value).toBeNull();
    expect(store.currentSubscription.value).toBeNull();
    expect(db["user-subscriptions"]).toEqual([
      { ...subscription, status: "CANCELLED", autoRenew: false },
    ]);
    expect(calls.at(-1)).toMatchObject({
      method: "PATCH",
      resource: "user-subscriptions",
      id: 7,
      action: "cancel",
      body: {},
    });
    store.loadCurrentSubscription(1);
    await vi.waitFor(() => expect(store.subscriptionLoading.value).toBe(false));
    expect(store.currentSubscription.value).toBeNull();
  });

  it("prevents repeated cancellation while the first request is pending", async () => {
    const { store, calls, deferNextResponse } = await load();
    const gate = deferNextResponse("PATCH");
    store.cancelCurrentSubscription();
    await gate.started;
    store.cancelCurrentSubscription();
    expect(calls.filter((call) => call.action === "cancel")).toHaveLength(1);
    await gate.release();
    await vi.waitFor(() => expect(store.subscriptionLoading.value).toBe(false));
  });

  it("keeps current access if the API rejects the cancellation", async () => {
    const { store, deferNextResponse } = await load();
    const gate = deferNextResponse("PATCH");
    store.cancelCurrentSubscription();
    await gate.started;
    await gate.release({
      status: 409,
      data: { message: "Cancellation rejected" },
    });
    await vi.waitFor(() => expect(store.subscriptionLoading.value).toBe(false));
    expect(store.subscriptionError.value).toBeTruthy();
    expect(store.currentSubscription.value?.id).toBe(7);
  });

  it.each([
    { id: 99 },
    { userId: 2 },
    { planId: 1 },
    { status: "ACTIVE" },
    { autoRenew: true },
  ])("rejects an unconfirmed or unrelated response: %j", async (changes) => {
    const { store, deferNextResponse } = await load();
    const gate = deferNextResponse("PATCH");
    store.cancelCurrentSubscription();
    await gate.started;
    await gate.release({
      status: 200,
      data: {
        ...subscription,
        status: "CANCELLED",
        autoRenew: false,
        ...changes,
      },
    });
    await vi.waitFor(() => expect(store.subscriptionLoading.value).toBe(false));
    expect(store.subscriptionError.value).toContain("did not confirm");
    expect(store.currentSubscription.value?.id).toBe(7);
  });

  it("does not restore subscription state after the session ends", async () => {
    const { store, deferNextResponse, endSession } = await load();
    const gate = deferNextResponse("PATCH");
    store.cancelCurrentSubscription();
    await gate.started;
    endSession();
    await gate.release();
    expect(store.currentSubscription.value).toBeNull();
    expect(store.subscriptionLoading.value).toBe(false);
    expect(store.subscriptionError.value).toBeNull();
  });

  it("does not send a cancellation without a current subscription", async () => {
    const { store, calls } = await createSubscriptionsHarness();
    store.cancelCurrentSubscription();
    expect(calls).toHaveLength(0);
  });
});
