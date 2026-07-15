import { CHARACTER_STORAGE_KEY, LEGACY_CHARACTER_KEYS, readJson, writeJson } from "./storage.js";
import { createId, normalizeLevel, normalizePercentage } from "./utils.js";
import { seriesForJob } from "./jobs.js";
import { createDefaultDailies, normalizeDailies, syncCompleted } from "./dailies.js";

let characters = [];

export const getCharacters = () => characters;
export const findCharacter = (id) => characters.find((character) => character.id === id);
export const saveCharacters = () => writeJson(CHARACTER_STORAGE_KEY, characters);

export function normalizeCharacter(record, template = []) {
  const { daily: _legacyDaily, ...rest } = record;
  const job = typeof record.job === "string" ? record.job.trim().slice(0, 20) : "";
  const dailies = normalizeDailies(record, template);
  const character = {
    ...rest,
    id: typeof record.id === "string" && record.id ? record.id : createId(),
    name: record.name.trim(),
    job,
    series: seriesForJob(job, record.series || ""),
    level: normalizeLevel(record.level) || "1",
    previousExp: normalizePercentage(record.previousExp ?? record.exp ?? ""),
    dailies,
    favorite: record.favorite === true,
  };
  syncCompleted(character);
  return character;
}

export function loadCharacters(template = []) {
  for (const key of [CHARACTER_STORAGE_KEY, ...LEGACY_CHARACTER_KEYS]) {
    const parsed = readJson(key);
    if (!Array.isArray(parsed)) continue;
    const used = new Set();
    characters = parsed.filter((item) => item && typeof item.name === "string").map((item) => {
      const character = normalizeCharacter(item, template);
      if (used.has(character.id)) character.id = createId();
      used.add(character.id);
      return character;
    });
    saveCharacters();
    return characters;
  }
  characters = [];
  return characters;
}

export function replaceCharacters(records, template = []) {
  const used = new Set();
  characters = records.map((record) => normalizeCharacter(record, template)).map((character) => {
    if (used.has(character.id)) character.id = createId();
    used.add(character.id);
    return character;
  });
  saveCharacters();
}

export function addCharacter(data, dailyTemplate) {
  const character = { id: createId(), ...data, dailies: createDefaultDailies(dailyTemplate), favorite: false };
  syncCompleted(character);
  characters.push(character);
  saveCharacters();
}

export function updateCharacter(id, data) {
  const character = findCharacter(id);
  if (character) {
    Object.assign(character, data);
    saveCharacters();
  }
  return character;
}

export function deleteCharacter(id) {
  characters = characters.filter((character) => character.id !== id);
  saveCharacters();
}
