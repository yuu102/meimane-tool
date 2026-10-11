import { localDateKey } from "./utils.js";

/** Calendar arithmetic keeps Monday 00:00 local even across DST changes. */
export function localWeekKey(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return localDateKey(monday);
}

/** Changes only weekly progress; missing week metadata is treated as legacy. */
export function resetWeekIfNeeded(characters, settings, date = new Date()) {
  const week = localWeekKey(date);
  if (settings.lastWeeklyResetWeek === week) return false;
  characters.forEach((character) => { character.weeklyCompleted = false; });
  settings.lastWeeklyResetWeek = week;
  return true;
}
