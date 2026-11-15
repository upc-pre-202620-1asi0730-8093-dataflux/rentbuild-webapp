import { describe, it, expect } from "vitest";
import { EquipmentHistoryAssembler } from "./equipment-history-assembler.js";
const assembler = new EquipmentHistoryAssembler();
const resource = {
    equipmentId: 1,
    equipmentCode: "EX-1",
    equipmentName: "Excavadora",
    entries: [
        {
            id: 1,
            kind: "RENTAL",
            occurredAt: "2026-11-01T12:00:00Z",
            description: "Rental",
            status: "COMPLETED",
        },
        {
            id: 1,
            kind: "MAINTENANCE",
            occurredAt: "2026-11-02T12:00:00Z",
            description: "Inspection",
            status: "COMPLETED",
        },
    ],
};
describe("equipment operational history contract", () => {
    it("combines record kinds and sorts newest first", () => {
        const result = assembler.toEntity(resource);
        expect(result.entries.map((x) => x.kind)).toEqual([
            "MAINTENANCE",
            "RENTAL",
        ]);
        expect(result.entries[0].occurredAt).toBeInstanceOf(Date);
    });
    it("rejects malformed projections", () => {
        for (const patch of [
            { equipmentId: 0 },
            { entries: null },
            { equipmentCode: 42 },
        ])
            expect(() => assembler.toEntity({ ...resource, ...patch })).toThrow();
    });
    it("rejects unsupported kinds and invalid dates", () => {
        for (const patch of [{ kind: "OTHER" }, { occurredAt: "invalid" }])
            expect(() =>
                assembler.toEntity({
                    ...resource,
                    entries: [{ ...resource.entries[0], ...patch }],
                }),
            ).toThrow();
    });
});
