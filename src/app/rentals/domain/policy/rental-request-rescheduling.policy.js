import { DateRange } from "../../../shared/domain/value-object/date-range.value-object.js";
import { RentalLifecycleDatePolicy } from "./rental-lifecycle-date.policy.js";
/** Date-only validation and ISO boundary conversion for the Rentals context. */
export class RentalRequestReschedulingPolicy {
  static issue(startDay, endDay, now = new Date()) {
    if (
      !RentalLifecycleDatePolicy.validDay(startDay) ||
      !RentalLifecycleDatePolicy.validDay(endDay)
    )
      return "INVALID";
    if (endDay < startDay) return "REVERSED";
    if (startDay < RentalLifecycleDatePolicy.limaDay(now)) return "PAST";
    return null;
  }
  /** Lima is UTC-05:00. Request periods include the entire final calendar day. */
  static toPeriod(startDay, endDay) {
    if (
      !RentalLifecycleDatePolicy.validDay(startDay) ||
      !RentalLifecycleDatePolicy.validDay(endDay) ||
      endDay < startDay
    ) {
      throw new Error("Invalid rental calendar period");
    }
    return new DateRange({
      startDate: new Date(`${startDay}T00:00:00.000-05:00`),
      endDate: new Date(`${endDay}T23:59:59.999-05:00`),
    });
  }
}
