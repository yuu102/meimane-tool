import { SETTINGS_STORAGE_KEY, readJson, writeJson } from "./storage.js";

export const SORT_MODES = ["default", "favorite", "level", "name"];
const defaults = { sortMode: "default", autoDailyReset: false, lastResetDate: "", hideCompleted: false };

export function loadSettings() {
  const stored = readJson(SETTINGS_STORAGE_KEY);
  const source = stored && typeof stored === "object" ? stored : {};
  return { ...defaults, ...source, dailyTemplate: normalizeDailyTemplate(source.dailyTemplate), sortMode: SORT_MODES.includes(source.sortMode) ? source.sortMode : "default", autoDailyReset: source.autoDailyReset === true, hideCompleted: source.hideCompleted === true };
}

export function saveSettings(settings) {
  writeJson(SETTINGS_STORAGE_KEY, settings);
}

export const DEFAULT_DAILY_TEMPLATE = ["デイリークエスト", "遠征", "ミニダン", "モンカニ"];

export function normalizeDailyTemplate(value) {
  const source = Array.isArray(value) ? value : DEFAULT_DAILY_TEMPLATE;
  const names = source.map((name) => String(name).trim().slice(0, 40)).filter(Boolean);
  return names.length ? names : [...DEFAULT_DAILY_TEMPLATE];
}
