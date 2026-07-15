import { localDateKey, normalizeLevel, normalizePercentage } from "./utils.js";
import { seriesForJob } from "./jobs.js";
import {
  addCharacter,
  deleteCharacter,
  findCharacter,
  getCharacters,
  loadCharacters,
  replaceCharacters,
  saveCharacterOrder,
  saveCharacters,
  updateCharacter,
} from "./characters.js";
import { applyTemplateToCharacter, resetDailies, syncCompleted } from "./dailies.js";
import { loadSettings, normalizeDailyTemplate, normalizeSettings, saveSettings } from "./settings.js";
import { downloadBackup, readBackup } from "./backup.js";
import { render } from "./render.js";
import { createCharacterFields, createCharacterOrderDialog, createDetailDialog, createSettingsDialog } from "./dialogs.js";

const $ = (id) => document.getElementById(id);
const elements = {
  list: $("characterList"),
  search: $("searchBox"),
  add: $("addCharacterBtn"),
  dialog: $("characterDialog"),
  title: $("dialogTitle"),
  name: $("characterName"),
  level: $("characterLevel"),
  previousLevel: $("characterPreviousLevel"),
  exp: $("characterExp"),
  afterDailyExp: $("characterAfterDailyExp"),
  save: $("saveBtn"),
  cancel: $("cancelBtn"),
  remove: $("deleteBtn"),
  counts: { all: $("summaryAll"), completed: $("summaryCompleted"), remaining: $("summaryRemaining") },
};
const fields = createCharacterFields(elements);
elements.job = fields.job;
elements.series = fields.series;
let editingId = null;
let settings = loadSettings();
let viewMode = settings.hideCompleted ? "remaining" : "all";

function refresh() {
  render({
    list: elements.list,
    counts: elements.counts,
    characters: getCharacters(),
    keyword: elements.search.value,
    sortMode: settings.sortMode,
    viewMode,
    onOpenDetail: (id) => detail.open(id),
    onToggleFavorite: toggleFavorite,
    onChangeViewMode: (mode) => { viewMode = mode; refresh(); },
  });
}

function applyAutoReset() {
  if (!settings.autoDailyReset || settings.lastResetDate === localDateKey()) return;
  getCharacters().forEach(resetDailies);
  settings = { ...settings, lastResetDate: localDateKey() };
  saveCharacters();
  saveSettings(settings);
}

function toggleFavorite(id) {
  const character = findCharacter(id);
  if (!character) return;
  character.favorite = !character.favorite;
  saveCharacters();
  refresh();
}

function setDaily(characterId, dailyId, checked) {
  const character = findCharacter(characterId);
  const daily = character?.dailies.find((item) => item.id === dailyId);
  if (!daily) return;
  daily.checked = checked;
  syncCompleted(character);
  saveCharacters();
}

/** テンプレートのIDを軸に、変更を全キャラクターへ一括反映する。 */
function applyDailyTemplate(previousTemplate, nextTemplate) {
  getCharacters().forEach((character) => applyTemplateToCharacter(character, previousTemplate, nextTemplate));
  saveCharacters();
}

const detail = createDetailDialog({ find: findCharacter, setDaily, refresh, edit: openEdit });
const characterOrderDialog = createCharacterOrderDialog({
  characters: () => [...getCharacters()].sort((a, b) => a.order - b.order),
  save: (ids) => {
    saveCharacterOrder(ids);
    refresh();
  },
});

async function restoreBackup(file) {
  try {
    const backup = await readBackup(file);
    if (!confirm("現在のデータを復元データで置き換えますか？")) return;
    settings = backup.settings ? normalizeSettings(backup.settings) : settings;
    replaceCharacters(backup.characters, settings.dailyTemplate);
    saveSettings(settings);
    viewMode = settings.hideCompleted ? "remaining" : "all";
    applyAutoReset();
    refresh();
  } catch {
    alert("JSON復元に失敗しました。");
  }
}

const settingsDialog = createSettingsDialog(
  () => settings,
  (next) => {
    const previousTemplate = settings.dailyTemplate;
    const normalized = normalizeSettings({ ...next, dailyTemplate: normalizeDailyTemplate(next.dailyTemplate) });
    const enabledToday = !settings.autoDailyReset && normalized.autoDailyReset;
    settings = enabledToday ? { ...normalized, lastResetDate: localDateKey() } : normalized;
    applyDailyTemplate(previousTemplate, settings.dailyTemplate);
    saveSettings(settings);
    applyAutoReset();
    refresh();
  },
  {
    onBackup: () => downloadBackup(getCharacters(), settings),
    onRestore: restoreBackup,
    onOpenCharacterOrder: () => characterOrderDialog.open(),
  },
);

function openAdd() {
  editingId = null;
  elements.title.textContent = "キャラクター追加";
  elements.name.value = "";
  elements.job.value = "";
  elements.series.value = "";
  elements.level.value = "";
  elements.previousLevel.value = "";
  elements.exp.value = "";
  elements.afterDailyExp.value = "";
  elements.remove.hidden = true;
  elements.dialog.showModal();
  elements.name.focus();
}

function openEdit(id) {
  const character = findCharacter(id);
  if (!character) return;
  editingId = id;
  elements.title.textContent = "キャラクター編集";
  elements.name.value = character.name;
  if (!Array.from(elements.job.options).some((option) => option.value === character.job)) {
    elements.job.insertBefore(new Option(`既存職業: ${character.job}`, character.job), elements.job.children[1]);
  }
  elements.job.value = character.job;
  elements.series.value = seriesForJob(character.job, character.series);
  elements.level.value = character.level;
  elements.previousLevel.value = character.previousLevel;
  elements.exp.value = character.previousExp;
  elements.afterDailyExp.value = character.afterDailyExp;
  elements.remove.hidden = false;
  elements.dialog.showModal();
}

function saveForm() {
  const name = elements.name.value.trim();
  const level = normalizeLevel(elements.level.value);
  const previousLevel = normalizeLevel(elements.previousLevel.value) || level;
  const previousExp = normalizePercentage(elements.exp.value);
  const afterDailyExp = normalizePercentage(elements.afterDailyExp.value);
  if (!name || !level) {
    alert("キャラ名とレベルを入力してください。");
    return;
  }
  const data = {
    name,
    job: elements.job.value,
    series: seriesForJob(elements.job.value, elements.series.value),
    level,
    previousLevel,
    previousExp,
    afterDailyExp,
  };
  if (editingId) updateCharacter(editingId, data);
  else addCharacter(data, settings.dailyTemplate);
  elements.dialog.close();
  refresh();
}

function removeCharacter() {
  const character = findCharacter(editingId);
  if (!character || !confirm(`「${character.name}」を削除しますか？`)) return;
  deleteCharacter(editingId);
  elements.dialog.close();
  refresh();
}

function createToolbar() {
  const config = document.createElement("button");
  config.type = "button";
  config.textContent = "設定";
  config.addEventListener("click", () => settingsDialog.open());
  const bar = document.createElement("div");
  bar.className = "tool-controls";
  bar.append(config);
  elements.search.insertAdjacentElement("afterend", bar);
}

elements.add.addEventListener("click", openAdd);
elements.search.addEventListener("input", refresh);
elements.save.addEventListener("click", saveForm);
elements.cancel.addEventListener("click", () => elements.dialog.close());
elements.remove.addEventListener("click", removeCharacter);
elements.level.addEventListener("input", () => { elements.level.value = normalizeLevel(elements.level.value); });
elements.previousLevel.addEventListener("input", () => { elements.previousLevel.value = normalizeLevel(elements.previousLevel.value); });
elements.exp.addEventListener("blur", () => { elements.exp.value = normalizePercentage(elements.exp.value); });
elements.afterDailyExp.addEventListener("blur", () => { elements.afterDailyExp.value = normalizePercentage(elements.afterDailyExp.value); });
elements.dialog.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.tagName !== "BUTTON") {
    event.preventDefault();
    saveForm();
  }
});

// Version 1.2.0: 設定を先に読み込み、旧キャラクターデータへtemplateIdとorderを補完する。
saveSettings(settings);
loadCharacters(settings.dailyTemplate);
applyAutoReset();
createToolbar();
refresh();
