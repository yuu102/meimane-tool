import { normalizeLevel, normalizePercentage, localDateKey } from "./utils.js";
import { seriesForJob } from "./jobs.js";
import { loadCharacters, getCharacters, findCharacter, saveCharacters, addCharacter, updateCharacter, deleteCharacter, replaceCharacters } from "./characters.js";
import { createDaily, syncCompleted, resetDailies } from "./dailies.js";
import { loadSettings, saveSettings } from "./settings.js";
import { downloadBackup, readBackup } from "./backup.js";
import { render } from "./render.js";
import { createCharacterFields, createDailyDialog, createDetailDialog, createSettingsDialog } from "./dialogs.js";

const $ = (id) => document.getElementById(id);
const elements = {
  list: $("characterList"), search: $("searchBox"), add: $("addCharacterBtn"), dialog: $("characterDialog"), title: $("dialogTitle"), name: $("characterName"), level: $("characterLevel"), exp: $("characterExp"), save: $("saveBtn"), cancel: $("cancelBtn"), remove: $("deleteBtn"),
  counts: { total: $("characterCount"), completed: $("completeCount"), remain: $("remainCount") },
};
const fields = createCharacterFields(elements);
elements.job = fields.job; elements.series = fields.series;
let editingId = null;
let settings = loadSettings();
let sortControl = null;

function refresh() {
  render({ list: elements.list, counts: elements.counts, characters: getCharacters(), keyword: elements.search.value, sortMode: settings.sortMode, onOpenDetail: (id) => detail.open(id), onToggleFavorite: toggleFavorite });
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

const daily = createDailyDialog({ find: findCharacter, addDaily, deleteDaily, moveDaily, refresh });
const detail = createDetailDialog({ find: findCharacter, setDaily, refresh, edit: openEdit, editDailies: (id) => daily.open(id) });
const settingsDialog = createSettingsDialog(() => settings, (next) => {
  const enabledToday = !settings.autoDailyReset && next.autoDailyReset;
  settings = enabledToday
    ? { ...next, lastResetDate: localDateKey() }
    : next;
  if (sortControl) sortControl.value = settings.sortMode;
  saveSettings(settings); applyAutoReset(); refresh();
});

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
  if (editingId) updateCharacter(editingId, data); else addCharacter(data);
  elements.dialog.close(); refresh();
}

function removeCharacter() {
  const character = findCharacter(editingId);
  if (!character || !confirm(`「${character.name}」を削除しますか？`)) return;
  deleteCharacter(editingId); elements.dialog.close(); refresh();
}

function createToolbar() {
  const bar = document.createElement("div"); bar.className = "tool-controls";
  const label = document.createElement("label"); label.textContent = "並び替え";
  const select = document.createElement("select"); select.setAttribute("aria-label", "並び替え"); sortControl = select;
  [["default", "登録順"], ["favorite", "お気に入り順"], ["level", "Lv順"], ["name", "名前順"]].forEach(([value, text]) => select.append(new Option(text, value)));
  select.value = settings.sortMode;
  select.addEventListener("change", () => { settings = { ...settings, sortMode: select.value }; saveSettings(settings); refresh(); });
  label.append(select);
  const backup = document.createElement("button"); backup.textContent = "JSONバックアップ"; backup.addEventListener("click", () => downloadBackup(getCharacters()));
  const restore = document.createElement("button"); restore.textContent = "JSON復元";
  const input = document.createElement("input"); input.type = "file"; input.accept = "application/json,.json"; input.hidden = true;
  restore.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    if (!input.files[0]) return;
    try { const records = await readBackup(input.files[0]); if (confirm("現在のデータを復元データで置き換えますか？")) { replaceCharacters(records); refresh(); } }
    catch { alert("JSON復元に失敗しました。"); }
    input.value = "";
  });
  const config = document.createElement("button"); config.textContent = "設定"; config.addEventListener("click", () => settingsDialog.open());
  bar.append(label, backup, restore, config, input); elements.search.insertAdjacentElement("afterend", bar);
}

elements.add.addEventListener("click", openAdd);
elements.search.addEventListener("input", refresh);
elements.save.addEventListener("click", saveForm);
elements.cancel.addEventListener("click", () => elements.dialog.close());
elements.remove.addEventListener("click", removeCharacter);
elements.level.addEventListener("input", () => { elements.level.value = normalizeLevel(elements.level.value); });
elements.exp.addEventListener("input", () => { elements.exp.value = normalizePercentage(elements.exp.value); });
elements.dialog.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.tagName !== "BUTTON") { event.preventDefault(); saveForm(); } });

loadCharacters(); applyAutoReset(); createToolbar(); refresh();
