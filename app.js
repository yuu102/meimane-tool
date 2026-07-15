import { normalizeLevel, normalizePercentage, localDateKey } from "./utils.js";
import { seriesForJob } from "./jobs.js";
import { loadCharacters, getCharacters, findCharacter, saveCharacters, addCharacter, updateCharacter, deleteCharacter, replaceCharacters } from "./characters.js";
import { createDaily, syncCompleted, resetDailies } from "./dailies.js";
import { loadSettings, saveSettings, normalizeDailyTemplate } from "./settings.js";
import { downloadBackup, readBackup } from "./backup.js";
import { render } from "./render.js";
import { createCharacterFields, createDetailDialog, createSettingsDialog } from "./dialogs.js";

const $ = (id) => document.getElementById(id);
const elements = {
  list: $("characterList"), search: $("searchBox"), add: $("addCharacterBtn"), dialog: $("characterDialog"), title: $("dialogTitle"), name: $("characterName"), level: $("characterLevel"), exp: $("characterExp"), save: $("saveBtn"), cancel: $("cancelBtn"), remove: $("deleteBtn"),
  counts: { total: $("characterCount"), completed: $("completeCount"), remain: $("remainCount") },
};
const fields = createCharacterFields(elements);
elements.job = fields.job; elements.series = fields.series;
let editingId = null;
let settings = loadSettings();

function refresh() {
  render({ list: elements.list, counts: elements.counts, characters: getCharacters(), keyword: elements.search.value, sortMode: settings.sortMode, hideCompleted: settings.hideCompleted, onOpenDetail: (id) => detail.open(id), onToggleFavorite: toggleFavorite });
}

function applyAutoReset() {
  if (!settings.autoDailyReset || settings.lastResetDate === localDateKey()) return;
  getCharacters().forEach(resetDailies);
  settings = { ...settings, lastResetDate: localDateKey() };
  saveCharacters(); saveSettings(settings);
}

function toggleFavorite(id) {
  const character = findCharacter(id);
  if (!character) return;
  character.favorite = !character.favorite;
  saveCharacters(); refresh();
}

function setDaily(characterId, dailyId, checked) {
  const character = findCharacter(characterId);
  const daily = character?.dailies.find((item) => item.id === dailyId);
  if (!daily) return;
  daily.checked = checked; syncCompleted(character); saveCharacters();
}

function addDaily(characterId, title) {
  const character = findCharacter(characterId);
  if (!character) return;
  character.dailies.push(createDaily(title)); syncCompleted(character); saveCharacters();
}

function deleteDaily(characterId, dailyId) {
  const character = findCharacter(characterId);
  if (!character) return;
  character.dailies = character.dailies.filter((item) => item.id !== dailyId);
  syncCompleted(character); saveCharacters();
}

function moveDaily(characterId, dailyId, direction) {
  const character = findCharacter(characterId);
  const index = character?.dailies.findIndex((item) => item.id === dailyId);
  const target = index + direction;
  if (!character || index < 0 || target < 0 || target >= character.dailies.length) return;
  [character.dailies[index], character.dailies[target]] = [character.dailies[target], character.dailies[index]];
  saveCharacters();
}

function applyDailyTemplate(titles) {
  getCharacters().forEach((character) => {
    const checkedByTitle = new Map(character.dailies.map((daily) => [daily.title, daily.checked]));
    character.dailies = titles.map((title) => createDaily(title, checkedByTitle.get(title) === true));
    syncCompleted(character);
  });
  saveCharacters();
}

const detail = createDetailDialog({ find: findCharacter, setDaily, refresh, edit: openEdit });
async function restoreBackup(file) {
  try {
    const records = await readBackup(file);
    if (confirm("現在のデータを復元データで置き換えますか？")) {
      replaceCharacters(records);
      refresh();
    }
  } catch {
    alert("JSON復元に失敗しました。");
  }
}

const settingsDialog = createSettingsDialog(() => settings, (next) => {
  const enabledToday = !settings.autoDailyReset && next.autoDailyReset;
  const dailyTemplate = normalizeDailyTemplate(next.dailyTemplate);
  const templateChanged = dailyTemplate.join("\u0000") !== settings.dailyTemplate.join("\u0000");
  settings = enabledToday
    ? { ...next, dailyTemplate, lastResetDate: localDateKey() }
    : { ...next, dailyTemplate };
  if (templateChanged) applyDailyTemplate(settings.dailyTemplate);
  saveSettings(settings); applyAutoReset(); refresh();
}, { onBackup: () => downloadBackup(getCharacters()), onRestore: restoreBackup });

function openAdd() {
  editingId = null; elements.title.textContent = "キャラクター追加";
  elements.name.value = elements.job.value = elements.series.value = elements.level.value = elements.exp.value = "";
  elements.remove.hidden = true; elements.dialog.showModal(); elements.name.focus();
}

function openEdit(id) {
  const character = findCharacter(id);
  if (!character) return;
  editingId = id; elements.title.textContent = "キャラクター編集"; elements.name.value = character.name;
  if (!Array.from(elements.job.options).some((option) => option.value === character.job)) elements.job.insertBefore(new Option(`既存職業: ${character.job}`, character.job), elements.job.children[1]);
  elements.job.value = character.job; elements.series.value = seriesForJob(character.job, character.series);
  elements.level.value = character.level; elements.exp.value = character.previousExp;
  elements.remove.hidden = false; elements.dialog.showModal();
}

function saveForm() {
  const name = elements.name.value.trim();
  const level = normalizeLevel(elements.level.value);
  const previousExp = normalizePercentage(elements.exp.value);
  if (!name || !level) return alert("キャラ名とレベルを入力してください。");
  const data = { name, job: elements.job.value, series: seriesForJob(elements.job.value, elements.series.value), level, previousExp };
  if (editingId) updateCharacter(editingId, data); else addCharacter(data, settings.dailyTemplate);
  elements.dialog.close(); refresh();
}

function removeCharacter() {
  const character = findCharacter(editingId);
  if (!character || !confirm(`「${character.name}」を削除しますか？`)) return;
  deleteCharacter(editingId); elements.dialog.close(); refresh();
}

function createToolbar() {
  const config = document.createElement("button"); config.textContent = "設定"; config.addEventListener("click", () => settingsDialog.open());
  const bar = document.createElement("div"); bar.className = "tool-controls";
  bar.append(config); elements.search.insertAdjacentElement("afterend", bar);
}

elements.add.addEventListener("click", openAdd);
elements.search.addEventListener("input", refresh);
elements.save.addEventListener("click", saveForm);
elements.cancel.addEventListener("click", () => elements.dialog.close());
elements.remove.addEventListener("click", removeCharacter);
elements.level.addEventListener("input", () => { elements.level.value = normalizeLevel(elements.level.value); });
elements.exp.addEventListener("blur", () => { elements.exp.value = normalizePercentage(elements.exp.value); });
elements.dialog.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.tagName !== "BUTTON") { event.preventDefault(); saveForm(); } });

loadCharacters(); applyAutoReset(); createToolbar(); refresh();
