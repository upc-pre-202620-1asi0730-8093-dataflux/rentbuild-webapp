import { describe, it, expect, vi } from "vitest";
import { of, firstValueFrom } from "rxjs";
import { EquipmentApiEndpoint } from "./equipment-api-endpoint.js";
import { DateRange } from "../../shared/domain/value-object/date-range.value-object.js";
describe("authoritative inclusive equipment availability", () => {
  const period = new DateRange({
    startDate: new Date(2026, 10, 12),
    endDate: new Date(2026, 10, 13, 23, 59, 59, 999),
  });
  it("sends the selected calendar dates and respects the server decision", async () => {
    const http = { get: vi.fn(() => of({ available: false })) };
    expect(
      await firstValueFrom(
        new EquipmentApiEndpoint(http).getAvailability(7, period),
      ),
    ).toBe(false);
    const [url, options] = http.get.mock.calls[0];
    expect(url).toMatch(/\/equipment\/7\/availability$/);
    expect(options.params.get("startDate")).toBe("2026-11-12");
    expect(options.params.get("endDate")).toBe("2026-11-13");
  });
  it("rejects malformed responses rather than claiming availability", async () => {
    const endpoint = new EquipmentApiEndpoint({
      get: () => of({ available: "true" }),
    });
    await expect(
      firstValueFrom(endpoint.getAvailability(7, period)),
    ).rejects.toThrow("Invalid equipment availability response");
  });
});
