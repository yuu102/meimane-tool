"use strict";

/*
 * めいまねつーる Phase 3
 * キャラクターの追加・編集・削除・検索、完了・お気に入り状態を LocalStorage に保存します。
 */

const $ = (id) => document.getElementById(id);

// Storage and validation constants.
const STORAGE_KEY = "meimane.characters";
const LEGACY_STORAGE_KEYS = ["meimane_characters"];
const MAX_LEVEL = 999;
const DEFAULT_DAILY_GOAL = 3;
const EXP_BASE_REQUIREMENT = 100;
const EXP_PER_LEVEL = 25;
const DEFAULT_DAILY_TITLES = ["デイリー 1", "デイリー 2", "デイリー 3"];

// UI text is kept together so it is easy to change without touching rendering logic.
const EMPTY_MESSAGE = "キャラクターがいません";
const SEARCH_EMPTY_MESSAGE = "該当するキャラクターがいません";
const ADD_DIALOG_TITLE = "キャラクター追加";
const EDIT_DIALOG_TITLE = "キャラクター編集";
const COMPLETE_LABEL = "✓ 完了";
const INCOMPLETE_LABEL = "○ 未完了";
const FAVORITE_ON_LABEL = "★";
const FAVORITE_OFF_LABEL = "☆";
const SORT_DEFAULT = "default";
const SORT_FAVORITE = "favorite";
const SORT_LEVEL = "level";
const SORT_NAME = "name";
const BACKUP_VERSION = "2.0";
const BACKUP_FILE_PREFIX = "meimane-tool-backup";

const elements = {
  list: $("characterList"),
  search: $("searchBox"),
  addButton: $("addCharacterBtn"),
  dialog: $("characterDialog"),
  dialogTitle: $("dialogTitle"),
  name: $("characterName"),
  level: $("characterLevel"),
  exp: $("characterExp"),
  saveButton: $("saveBtn"),
  cancelButton: $("cancelBtn"),
  deleteButton: $("deleteBtn"),
  characterCount: $("characterCount"),
  completeCount: $("completeCount"),
  remainCount: $("remainCount"),
};

let characters = [];
let editingId = null;
let sortMode = SORT_DEFAULT;
let dailyEditingId = null;

/** Generate a stable ID so filtering never changes an edit/delete target. */
function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `character-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Convert Japanese full-width digits to normal ASCII digits. */
function toHalfWidth(value) {
  return String(value).replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );
}

/** Keep a level as a valid 1–999 string. */
function normalizeLevel(value) {
  const digits = toHalfWidth(value).replace(/[^0-9]/g, "");
  if (!digits) return "";

  return String(Math.min(MAX_LEVEL, Math.max(1, Number(digits))));
}

/** EXP is optional; only digits and one decimal point are retained. */
function normalizeExp(value) {
  const cleaned = toHalfWidth(value).replace(/[^0-9.]/g, "");
  const [integer = "", ...decimalParts] = cleaned.split(".");
  return decimalParts.length ? `${integer}.${decimalParts.join("")}` : integer;
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function createDaily(title, checked = false) {
  return { id: createId(), title, checked: checked === true };
}

function createDefaultDailies() {
  return DEFAULT_DAILY_TITLES.map((title) => createDaily(title));
}

function normalizeDailyItem(item) {
  if (!item || typeof item !== "object" || typeof item.title !== "string") return null;
  return {
    id: typeof item.id === "string" && item.id ? item.id : createId(),
    title: item.title.trim().slice(0, 40),
    checked: item.checked === true,
  };
}

/**
 * Migrate Phase 2's { progress, goal } object to individual quest records.
 * The first `progress` migrated quests are marked complete, preserving totals.
 */
function migrateLegacyDaily(daily) {
  const source = daily && typeof daily === "object" ? daily : {};
  const goal = Math.max(1, normalizeNonNegativeInteger(source.goal ?? source.target, DEFAULT_DAILY_GOAL));
  const progress = Math.min(goal, normalizeNonNegativeInteger(source.progress ?? source.count ?? source.completed, 0));

  return Array.from({ length: goal }, (_, index) =>
    createDaily(`デイリー ${index + 1}`, index < progress),
  );
}

function normalizeDailies(record) {
  if (Array.isArray(record.dailies)) {
    const usedIds = new Set();
    return record.dailies
      .map(normalizeDailyItem)
      .filter(Boolean)
      .map((daily) => {
        if (usedIds.has(daily.id)) daily.id = createId();
        usedIds.add(daily.id);
        return daily;
      });
  }

  return migrateLegacyDaily(record.daily);
}

/** EXP needed to reach the next level. Kept in one function for future level-up rules. */
function getExpGoal(level) {
  return EXP_BASE_REQUIREMENT + Number(level) * EXP_PER_LEVEL;
}

function getExpProgress(character) {
  const current = Math.max(0, Number(character.previousExp) || 0);
  const goal = getExpGoal(character.level);
  return { current, goal, percent: Math.min(100, (current / goal) * 100) };
}

function isCharacterRecord(value) {
  return value && typeof value === "object" && typeof value.name === "string";
}

/**
 * Convert any older saved object to the Phase 2 shape.
 * Unknown fields are retained to avoid losing future-phase data such as `daily`.
 */
function normalizeCharacter(record) {
  const { daily: legacyDaily, ...recordWithoutLegacyDaily } = record;
  const identity = {
    id: typeof record.id === "string" && record.id ? record.id : createId(),
    name: record.name.trim(),
    job: typeof record.job === "string" ? record.job.trim().slice(0, 20) : "",
  };
  const progress = {
    level: normalizeLevel(record.level) || "1",
    previousExp: normalizeExp(record.previousExp ?? record.exp ?? ""),
    dailies: normalizeDailies(record),
  };
  const status = {
    completed: record.completed === true,
    favorite: record.favorite === true,
  };

  return { ...recordWithoutLegacyDaily, ...identity, ...progress, ...status };
}

/** Ensure a restored collection never contains duplicate IDs. */
function normalizeCollection(records) {
  const usedIds = new Set();

  return records.filter(isCharacterRecord).map((record) => {
    const character = normalizeCharacter(record);
    if (usedIds.has(character.id)) character.id = createId();
    usedIds.add(character.id);
    return character;
  });
}

/** Persist the complete state after every mutation. */
function saveCharacters() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
}

/** Load the current key first, then migrate the legacy key if it exists. */
function loadCharacters() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Stored data is not an array.");

      characters = normalizeCollection(parsed);
      saveCharacters();
      return;
    } catch (error) {
      console.warn("めいまねつーるの保存データを読み込めませんでした。", error);
    }
  }

  characters = [];
}

function getCharacter(id) {
  return characters.find((character) => character.id === id);
}

function getFilteredCharacters() {
  const keyword = elements.search.value.trim().toLocaleLowerCase("ja-JP");
  if (!keyword) return characters;

  return characters.filter((character) =>
    `${character.name} ${character.job}`.toLocaleLowerCase("ja-JP").includes(keyword),
  );
}

/** Sort a copy for display only; the saved creation order remains unchanged. */
function sortCharacters(records) {
  const sorted = [...records];

  if (sortMode === SORT_FAVORITE) {
    return sorted.sort((a, b) => Number(b.favorite) - Number(a.favorite));
  }
  if (sortMode === SORT_LEVEL) {
    return sorted.sort((a, b) => Number(b.level) - Number(a.level));
  }
  if (sortMode === SORT_NAME) {
    return sorted.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }

  return sorted;
}

/** Render only the three summary values. */
function renderSummary() {
  const completedCount = characters.filter((character) => character.completed).length;
  elements.characterCount.textContent = String(characters.length);
  elements.completeCount.textContent = String(completedCount);
  elements.remainCount.textContent = String(characters.length - completedCount);
}

/** Render the appropriate no-results message. */
function renderEmpty() {
  const message = document.createElement("p");
  message.className = "empty-message";
  message.textContent = characters.length === 0 ? EMPTY_MESSAGE : SEARCH_EMPTY_MESSAGE;
  elements.list.append(message);
}

function createControl(className, label, title, onClick) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = className;
  control.textContent = label;
  control.title = title;
  control.addEventListener("click", (event) => {
    event.stopPropagation(); // Controls must not open the edit dialog.
    onClick();
  });
  return control;
}

/** Render one card and bind all controls by UUID, never by filtered array index. */
function renderCard(character) {
  const card = document.createElement("div");
  card.className = "character-card";
  card.classList.toggle("is-completed", character.completed);
  card.classList.toggle("is-favorite", character.favorite);
  card.dataset.id = character.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${character.name}を編集`);

  const header = document.createElement("div");
  header.className = "card-header";
  header.append(
    createControl("favorite-toggle", character.favorite ? FAVORITE_ON_LABEL : FAVORITE_OFF_LABEL,
      character.favorite ? "お気に入りを解除" : "お気に入りに追加", () => toggleFavorite(character.id)),
    createControl("completed-toggle", character.completed ? COMPLETE_LABEL : INCOMPLETE_LABEL,
      character.completed ? "未完了に戻す" : "完了にする", () => toggleCompleted(character.id)),
  );

  const nameRow = document.createElement("div");
  nameRow.className = "character-name-row";
  const name = document.createElement("div");
  name.className = "character-name";
  name.textContent = character.name;
  nameRow.append(name);
  if (character.job) {
    const job = document.createElement("span");
    job.className = "job-badge";
    job.textContent = character.job;
    nameRow.append(job);
  }

  const level = document.createElement("div");
  level.className = "character-level";
  level.textContent = `Lv.${character.level}`;

  const exp = getExpProgress(character);
  const expSection = document.createElement("div");
  expSection.className = "exp-section";
  const expMeta = document.createElement("div");
  expMeta.className = "exp-meta";
  const expValues = document.createElement("span");
  expValues.textContent = `EXP ${exp.current} / ${exp.goal}`;
  const expPercent = document.createElement("span");
  expPercent.className = "exp-percent";
  expPercent.textContent = `${Math.round(exp.percent)}%`;
  expMeta.append(expValues, expPercent);
  const expBar = document.createElement("div");
  expBar.className = "exp-bar";
  expBar.setAttribute("role", "progressbar");
  expBar.setAttribute("aria-valuemin", "0");
  expBar.setAttribute("aria-valuemax", String(exp.goal));
  expBar.setAttribute("aria-valuenow", String(Math.min(exp.current, exp.goal)));
  const expFill = document.createElement("div");
  expFill.className = "exp-fill";
  expFill.style.width = `${exp.percent}%`;
  expBar.append(expFill);
  const nextLevel = document.createElement("div");
  nextLevel.className = "next-level";
  nextLevel.textContent = character.level === String(MAX_LEVEL)
    ? "MAX LEVEL"
    : `次のレベルまで ${Math.max(0, exp.goal - exp.current)} EXP`;
  expSection.append(expMeta, expBar, nextLevel);

  const daily = document.createElement("div");
  daily.className = "daily-quest-list";
  daily.addEventListener("click", (event) => event.stopPropagation());
  const dailyHeader = document.createElement("div");
  dailyHeader.className = "daily-quest-header";
  const dailyTitle = document.createElement("span");
  dailyTitle.textContent = "デイリー";
  dailyHeader.append(
    dailyTitle,
    createControl("daily-edit-button", "デイリー編集", "デイリー編集を開く", () => openDailyDialog(character.id)),
  );
  daily.append(dailyHeader);
  if (character.dailies.length === 0) {
    const emptyDaily = document.createElement("p");
    emptyDaily.className = "daily-empty";
    emptyDaily.textContent = "クエストがありません";
    daily.append(emptyDaily);
  } else {
    character.dailies.forEach((quest) => {
      const item = document.createElement("label");
      item.className = "daily-quest";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = quest.checked;
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => setDailyChecked(character.id, quest.id, checkbox.checked));
      const text = document.createElement("span");
      text.textContent = quest.title;
      item.append(checkbox, text);
      daily.append(item);
    });
  }

  card.append(header, nameRow, level, expSection, daily);
  card.addEventListener("click", () => openEditDialog(character.id));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEditDialog(character.id);
    }
  });
  return card;
}

/** Render cards and summary from the single source of truth. */
function render() {
  const visibleCharacters = sortCharacters(getFilteredCharacters());
  elements.list.replaceChildren();

  if (visibleCharacters.length === 0) {
    renderEmpty();
  } else {
    visibleCharacters.forEach((character) => elements.list.append(renderCard(character)));
  }

  renderSummary();
}

function toggleFavorite(id) {
  const character = getCharacter(id);
  if (!character) return;

  character.favorite = !character.favorite;
  saveCharacters();
  render();
}

function toggleCompleted(id) {
  const character = getCharacter(id);
  if (!character) return;

  character.completed = !character.completed;
  saveCharacters();
  render();
}

/** Toggle one quest without opening the character editing dialog. */
function setDailyChecked(characterId, dailyId, checked) {
  const character = getCharacter(characterId);
  const daily = character?.dailies.find((item) => item.id === dailyId);
  if (!daily) return;

  daily.checked = checked;
  saveCharacters();
  render();
}

/** Add sorting and backup controls without changing the existing HTML file. */
function createToolControls() {
  const toolbar = document.createElement("div");
  toolbar.className = "tool-controls";

  const sortLabel = document.createElement("label");
  sortLabel.textContent = "並び替え: ";

  const sortSelect = document.createElement("select");
  sortSelect.setAttribute("aria-label", "並び替え");
  [
    [SORT_DEFAULT, "登録順"],
    [SORT_FAVORITE, "お気に入り順"],
    [SORT_LEVEL, "Lv順"],
    [SORT_NAME, "名前順"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    sortSelect.append(option);
  });
  sortSelect.value = sortMode;
  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    render();
  });
  sortLabel.append(sortSelect);

  const backupButton = document.createElement("button");
  backupButton.type = "button";
  backupButton.textContent = "JSONバックアップ";
  backupButton.addEventListener("click", exportBackup);

  const restoreButton = document.createElement("button");
  restoreButton.type = "button";
  restoreButton.textContent = "JSON復元";

  const restoreInput = document.createElement("input");
  restoreInput.type = "file";
  restoreInput.accept = "application/json,.json";
  restoreInput.hidden = true;
  restoreButton.addEventListener("click", () => restoreInput.click());
  restoreInput.addEventListener("change", () => {
    const [file] = restoreInput.files;
    restoreInput.value = ""; // The same backup can be selected again after an error.
    if (file) importBackup(file);
  });

  toolbar.append(sortLabel, backupButton, restoreButton, restoreInput);
  elements.search.insertAdjacentElement("afterend", toolbar);
}

/** Download a complete, portable snapshot of the current character data. */
function exportBackup() {
  const backup = {
    app: "meimane-tool",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    characters,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `${BACKUP_FILE_PREFIX}-${timestamp}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("ファイルを読み込めませんでした。"));
    reader.readAsText(file, "UTF-8");
  });
}

/** Restore a Phase 1 backup object or a legacy plain character array. */
async function importBackup(file) {
  try {
    const parsed = JSON.parse(await readFileAsText(file));
    const records = Array.isArray(parsed) ? parsed : parsed?.characters;

    if (!Array.isArray(records) || !records.every(isCharacterRecord)) {
      throw new Error("キャラクター一覧を含むJSONではありません。");
    }
    if (!window.confirm("現在のキャラクターデータを復元データで置き換えます。よろしいですか？")) {
      return;
    }

    characters = normalizeCollection(records);
    editingId = null;
    saveCharacters();
    closeDialog();
    closeDailyDialog();
    render();
    alert(`${characters.length}件のキャラクターデータを復元しました。`);
  } catch (error) {
    console.warn("JSON復元に失敗しました。", error);
    alert("JSON復元に失敗しました。バックアップファイルを確認してください。");
  }
}

/** Add the optional job field to the existing character dialog without editing index.html. */
function createCharacterFormExtensions() {
  const form = elements.name.closest(".form");
  const levelLabel = elements.level.previousElementSibling;
  const jobLabel = document.createElement("label");
  jobLabel.htmlFor = "characterJob";
  jobLabel.textContent = "職業";
  const jobInput = document.createElement("input");
  jobInput.id = "characterJob";
  jobInput.type = "text";
  jobInput.maxLength = 20;
  jobInput.autocomplete = "off";
  jobInput.placeholder = "例: 戦士";
  form.insertBefore(jobLabel, levelLabel);
  form.insertBefore(jobInput, levelLabel);
  elements.job = jobInput;
}

const dailyEditor = {};

/** Build a dedicated quest editor dialog; it is separate from character editing. */
function createDailyEditor() {
  const dialog = document.createElement("dialog");
  dialog.id = "dailyDialog";
  dialog.className = "daily-dialog";
  const title = document.createElement("h2");
  title.textContent = "デイリー編集";
  const hint = document.createElement("p");
  hint.className = "daily-editor-hint";
  hint.textContent = "クエストを追加・削除・並び替えできます。";
  const addRow = document.createElement("div");
  addRow.className = "daily-editor-add";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 40;
  input.placeholder = "クエスト名";
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.textContent = "追加";
  const list = document.createElement("ol");
  list.className = "daily-editor-list";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "daily-editor-close";
  closeButton.textContent = "閉じる";

  addRow.append(input, addButton);
  dialog.append(title, hint, addRow, list, closeButton);
  document.body.append(dialog);
  Object.assign(dailyEditor, { dialog, input, addButton, list, closeButton });

  addButton.addEventListener("click", addDaily);
  closeButton.addEventListener("click", closeDailyDialog);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target === input) {
      event.preventDefault();
      addDaily();
    }
  });
}

function openDailyDialog(id) {
  if (!getCharacter(id)) return;
  dailyEditingId = id;
  renderDailyEditor();
  dailyEditor.dialog.showModal();
  dailyEditor.input.focus();
}

function closeDailyDialog() {
  if (dailyEditor.dialog.open) dailyEditor.dialog.close();
  dailyEditingId = null;
}

function renderDailyEditor() {
  const character = getCharacter(dailyEditingId);
  dailyEditor.list.replaceChildren();
  if (!character) return;

  character.dailies.forEach((daily, index) => {
    const item = document.createElement("li");
    const title = document.createElement("span");
    title.textContent = daily.title;
    const controls = document.createElement("span");
    controls.className = "daily-editor-item-controls";
    const up = createControl("daily-editor-move", "↑", "上へ移動", () => moveDaily(daily.id, -1));
    const down = createControl("daily-editor-move", "↓", "下へ移動", () => moveDaily(daily.id, 1));
    up.disabled = index === 0;
    down.disabled = index === character.dailies.length - 1;
    controls.append(
      up,
      down,
      createControl("daily-editor-delete", "削除", "クエストを削除", () => deleteDaily(daily.id)),
    );
    item.append(title, controls);
    dailyEditor.list.append(item);
  });
}

function addDaily() {
  const character = getCharacter(dailyEditingId);
  const title = dailyEditor.input.value.trim();
  if (!character || !title) {
    dailyEditor.input.focus();
    return;
  }

  character.dailies.push(createDaily(title));
  dailyEditor.input.value = "";
  saveCharacters();
  renderDailyEditor();
  render();
  dailyEditor.input.focus();
}

function deleteDaily(dailyId) {
  const character = getCharacter(dailyEditingId);
  if (!character) return;

  character.dailies = character.dailies.filter((daily) => daily.id !== dailyId);
  saveCharacters();
  renderDailyEditor();
  render();
}

function moveDaily(dailyId, direction) {
  const character = getCharacter(dailyEditingId);
  if (!character) return;
  const index = character.dailies.findIndex((daily) => daily.id === dailyId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= character.dailies.length) return;

  [character.dailies[index], character.dailies[targetIndex]] =
    [character.dailies[targetIndex], character.dailies[index]];
  saveCharacters();
  renderDailyEditor();
  render();
}

function resetForm() {
  editingId = null;
  elements.dialogTitle.textContent = ADD_DIALOG_TITLE;
  elements.name.value = "";
  elements.job.value = "";
  elements.level.value = "";
  elements.exp.value = "";
  elements.deleteButton.hidden = true;
}

function openAddDialog() {
  resetForm();
  elements.dialog.showModal();
  elements.name.focus();
}

function openEditDialog(id) {
  const character = getCharacter(id);
  if (!character) return;

  editingId = character.id;
  elements.dialogTitle.textContent = EDIT_DIALOG_TITLE;
  elements.name.value = character.name;
  elements.job.value = character.job;
  elements.level.value = character.level;
  elements.exp.value = character.previousExp;
  elements.deleteButton.hidden = false;
  elements.dialog.showModal();
  elements.name.focus();
}

function closeDialog() {
  if (elements.dialog.open) elements.dialog.close();
}

function readForm() {
  return {
    name: elements.name.value.trim(),
    job: elements.job.value.trim(),
    level: normalizeLevel(elements.level.value),
    previousExp: normalizeExp(elements.exp.value),
  };
}

function validateForm(data) {
  if (!data.name) {
    alert("キャラクター名を入力してください。");
    elements.name.focus();
    return false;
  }
  if (!data.level) {
    alert("レベルを1〜999の数字で入力してください。");
    elements.level.focus();
    return false;
  }
  return true;
}

function saveCharacter() {
  const data = readForm();
  if (!validateForm(data)) return;

  if (editingId) {
    const character = getCharacter(editingId);
    if (!character) return;
    Object.assign(character, data); // completed/favorite/dailies are intentionally retained.
  } else {
    characters.push({
      id: createId(),
      ...data,
      dailies: createDefaultDailies(),
      completed: false,
      favorite: false,
    });
  }

  saveCharacters();
  closeDialog();
  render();
}

function deleteCharacter() {
  const character = editingId ? getCharacter(editingId) : null;
  if (!character || !window.confirm(`「${character.name}」を削除しますか？`)) return;

  characters = characters.filter((item) => item.id !== character.id);
  saveCharacters();
  closeDialog();
  render();
}

function bindEvents() {
  elements.addButton.addEventListener("click", openAddDialog);
  elements.search.addEventListener("input", render);
  elements.saveButton.addEventListener("click", saveCharacter);
  elements.cancelButton.addEventListener("click", closeDialog);
  elements.deleteButton.addEventListener("click", deleteCharacter);
  elements.level.addEventListener("input", () => {
    elements.level.value = normalizeLevel(elements.level.value);
  });
  elements.exp.addEventListener("input", () => {
    elements.exp.value = normalizeExp(elements.exp.value);
  });
  elements.dialog.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.tagName !== "BUTTON") {
      event.preventDefault();
      saveCharacter();
    }
  });
}

function init() {
  loadCharacters();
  createCharacterFormExtensions();
  createDailyEditor();
  createToolControls();
  bindEvents();
  render();
}

init();
