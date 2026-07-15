import { SETTINGS_STORAGE_KEY, readJson, writeJson } from "./storage.js";

export const SORT_MODES = ["default", "favorite", "level", "name"];
const defaults = { sortMode: "default", autoDailyReset: false, lastResetDate: "" };

export function loadSettings() {
  const stored = readJson(SETTINGS_STORAGE_KEY);
  return { ...defaults, ...(stored && typeof stored === "object" ? stored : {}), sortMode: SORT_MODES.includes(stored?.sortMode) ? stored.sortMode : "default", autoDailyReset: stored?.autoDailyReset === true };
}
export function saveSettings(settings) { writeJson(SETTINGS_STORAGE_KEY, settings); }
