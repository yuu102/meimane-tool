import { SETTINGS_STORAGE_KEY, readJson, writeJson } from "./storage.js";

export const SORT_MODES = ["default", "favorite", "level", "name"];
const defaults = { sortMode: "default", autoDailyReset: false, lastResetDate: "", hideCompleted: false };

export function loadSettings() {
  const stored = readJson(SETTINGS_STORAGE_KEY);
  const source = stored && typeof stored === "object" ? stored : {};
  return { ...defaults, ...source, sortMode: SORT_MODES.includes(source.sortMode) ? source.sortMode : "default", autoDailyReset: source.autoDailyReset === true, hideCompleted: source.hideCompleted === true };
}

export function saveSettings(settings) {
  writeJson(SETTINGS_STORAGE_KEY, settings);
}
