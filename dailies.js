import { createId } from "./utils.js";

const defaultTitles = ["デイリー 1", "デイリー 2", "デイリー 3"];
export const createDaily = (title, checked = false) => ({ id: createId(), title, checked: checked === true });
export const createDefaultDailies = () => defaultTitles.map((title) => createDaily(title));

export function normalizeDailies(record) {
  if (Array.isArray(record.dailies)) {
    const used = new Set();
    return record.dailies.filter((item) => item && typeof item.title === "string").map((item) => {
      let id = typeof item.id === "string" && item.id ? item.id : createId();
      if (used.has(id)) id = createId();
      used.add(id);
      return { id, title: item.title.trim().slice(0, 40), checked: item.checked === true };
    });
  }
  const legacy = record.daily && typeof record.daily === "object" ? record.daily : {};
  const goal = Math.max(1, Math.floor(Number(legacy.goal ?? legacy.target) || 3));
  const progress = Math.min(goal, Math.max(0, Math.floor(Number(legacy.progress ?? legacy.count ?? legacy.completed) || 0)));
  return Array.from({ length: goal }, (_, index) => createDaily(`デイリー ${index + 1}`, index < progress));
}

export function syncCompleted(character) { character.completed = character.dailies.length > 0 && character.dailies.every((daily) => daily.checked); }
export function resetDailies(character) { character.dailies.forEach((daily) => { daily.checked = false; }); syncCompleted(character); }
