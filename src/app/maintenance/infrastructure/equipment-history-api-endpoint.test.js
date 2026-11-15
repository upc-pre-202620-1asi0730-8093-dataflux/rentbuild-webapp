import { afterEach, describe, it, expect, vi } from "vitest";
import { of, firstValueFrom } from "rxjs";
import { HttpClient } from "../../shared/infrastructure/services.js";
import { EquipmentHistoryApiEndpoint } from "./equipment-history-api-endpoint.js";
afterEach(() => vi.restoreAllMocks());
describe("equipment history endpoint isolation", () => {
    it("rejects invalid identifiers before making a request", () => {
        const spy = vi.spyOn(HttpClient.prototype, "get");
        expect(() => new EquipmentHistoryApiEndpoint().getByEquipmentId(0)).toThrow(
            "Invalid equipment identifier",
        );
        expect(spy).not.toHaveBeenCalled();
    });
    it("rejects a projection returned for another machine", async () => {
        vi.spyOn(HttpClient.prototype, "get").mockReturnValue(
            of({
                equipmentId: 2,
                equipmentCode: "B",
                equipmentName: "Other",
                entries: [],
            }),
        );
        await expect(
            firstValueFrom(new EquipmentHistoryApiEndpoint().getByEquipmentId(1)),
        ).rejects.toThrow("does not match");
    });
});
