import { DateTime } from "luxon";

// Relative days ("today", "yesterday", "3 days ago") are part of the English interface copy,
// so they are always English. Left to luxon's default they follow the browser's language, and
// a German browser got "heute" in the middle of an English sentence. Absolute dates and times
// still follow the configured LOCALE.
type LuxonDate = ReturnType<typeof DateTime.fromISO>;

export const relativeDay = (date: LuxonDate): string =>
    date.setLocale("en").toRelativeCalendar({ unit: "days" }) ?? date.setLocale("en").toRelative() ?? "";
