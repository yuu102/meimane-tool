"use strict";

/*
 * めいまねつーる Phase 1.1
 * キャラクターの追加・編集・削除・検索、完了・お気に入り状態を LocalStorage に保存します。
 */

const $ = (id) => document.getElementById(id);

// Storage and validation constants.
const STORAGE_KEY = "meimane.characters";
const LEGACY_STORAGE_KEYS = ["meimane_characters"];
const MAX_LEVEL = 999;

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
const BACKUP_VERSION = "1.2";
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

function isCharacterRecord(value) {
  return value && typeof value === "object" && typeof value.name === "string";
}

/**
 * Convert any older saved object to the Phase 1.1 shape.
 * Unknown fields are retained to avoid losing future-phase data such as `daily`.
 */
function normalizeCharacter(record) {
  const identity = {
    id: typeof record.id === "string" && record.id ? record.id : createId(),
    name: record.name.trim(),
  };
  const progress = {
    level: normalizeLevel(record.level) || "1",
    previousExp: normalizeExp(record.previousExp ?? record.exp ?? ""),
    daily: record.daily && typeof record.daily === "object" ? record.daily : {},
  };
  const status = {
    completed: record.completed === true,
    favorite: record.favorite === true,
  };

  return { ...record, ...identity, ...progress, ...status };
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
    character.name.toLocaleLowerCase("ja-JP").includes(keyword),
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

/** Render one card and bind controls by UUID, never by filtered array index. */
function renderCard(character) {
  const card = document.createElement("div");
  card.className = "character-card";
  card.dataset.id = character.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${character.name}を編集`);

  const header = document.createElement("div");
  header.className = "card-header";
  header.append(
    createControl(
      "favorite-toggle",
      character.favorite ? FAVORITE_ON_LABEL : FAVORITE_OFF_LABEL,
      character.favorite ? "お気に入りを解除" : "お気に入りに追加",
      () => toggleFavorite(character.id),
    ),
    createControl(
      "completed-toggle",
      character.completed ? COMPLETE_LABEL : INCOMPLETE_LABEL,
      character.completed ? "未完了に戻す" : "完了にする",
      () => toggleCompleted(character.id),
    ),
  );

  const name = document.createElement("div");
  name.className = "character-name";
  name.textContent = character.name;

  const level = document.createElement("div");
  level.className = "character-level";
  level.textContent = `Lv.${character.level}`;

  const daily = document.createElement("div");
  daily.className = "daily-count";
  daily.textContent = "0 / 0";

  card.append(header, name, level, daily);
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

/** Add Phase 1.2 controls without changing the existing HTML or CSS files. */
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
    render();
    alert(`${characters.length}件のキャラクターデータを復元しました。`);
  } catch (error) {
    console.warn("JSON復元に失敗しました。", error);
    alert("JSON復元に失敗しました。バックアップファイルを確認してください。");
  }
}

function resetForm() {
  editingId = null;
  elements.dialogTitle.textContent = ADD_DIALOG_TITLE;
  elements.name.value = "";
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
    Object.assign(character, data); // completed/favorite/daily are intentionally retained.
  } else {
    characters.push({
      id: createId(),
      ...data,
      daily: {},
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
  createToolControls();
  bindEvents();
  render();
}

init();
