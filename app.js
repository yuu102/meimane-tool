"use strict";

/*
 * めいまねつーる Phase 1
 * キャラクターの作成・編集・削除・検索をブラウザの LocalStorage に保存する。
 */

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "meimane.characters";
const LEGACY_STORAGE_KEYS = ["meimane_characters"];
const MAX_LEVEL = 999;

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

/** A UUID keeps edit/delete targets stable even while the list is filtered. */
function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `character-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 11)}`;
}

/** Convert full-width digits to ASCII digits. */
function toHalfWidth(value) {
  return String(value).replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );
}

/** Return a level containing only digits, constrained to the supported range. */
function normalizeLevel(value) {
  const digits = toHalfWidth(value).replace(/[^0-9]/g, "");
  if (!digits) return "";

  const level = Math.min(MAX_LEVEL, Math.max(1, Number(digits)));
  return String(level);
}

/** Previous EXP is optional; keep it as text so existing saved values remain intact. */
function normalizeExp(value) {
  const halfWidth = toHalfWidth(value);
  const cleaned = halfWidth.replace(/[^0-9.]/g, "");
  const [integer = "", ...decimalParts] = cleaned.split(".");
  const decimal = decimalParts.join("");
  return decimalParts.length ? `${integer}.${decimal}` : integer;
}

function isRecord(value) {
  return value && typeof value === "object" && typeof value.name === "string";
}

/**
 * Normalise old records saved by earlier versions.  It deliberately retains
 * unknown properties (for example daily) so a later phase can use them.
 */
function normalizeCharacter(record) {
  const level = normalizeLevel(record.level);
  return {
    ...record,
    id: typeof record.id === "string" && record.id ? record.id : createId(),
    name: record.name.trim(),
    level: level || "1",
    previousExp: normalizeExp(record.previousExp ?? record.exp ?? ""),
    daily: record.daily && typeof record.daily === "object" ? record.daily : {},
    completed: record.completed === true,
  };
}

function saveCharacters() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
}

function readStoredCharacters() {
  const candidateKeys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];

  for (const key of candidateKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Stored data is not an array.");

      characters = parsed.filter(isRecord).map(normalizeCharacter);
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

function getSearchKeyword() {
  return elements.search.value.trim().toLocaleLowerCase("ja-JP");
}

function getVisibleCharacters() {
  const keyword = getSearchKeyword();
  if (!keyword) return characters;

  return characters.filter((character) =>
    character.name.toLocaleLowerCase("ja-JP").includes(keyword),
  );
}

function updateSummary() {
  const completed = characters.filter((character) => character.completed === true).length;
  elements.characterCount.textContent = String(characters.length);
  elements.completeCount.textContent = String(completed);
  elements.remainCount.textContent = String(characters.length - completed);
}

function createTextElement(className, text) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}

function createCharacterCard(character) {
  const card = document.createElement("div");
  card.className = "character-card";
  card.dataset.id = character.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${character.name}を編集`);

  // Existing CSS is kept unchanged; these class names preserve its layout.
  card.append(
    createTextElement("character-name", character.name),
    createTextElement("character-level", `Lv.${character.level}`),
    createTextElement("daily-count", "0 / 0"),
  );

  card.addEventListener("click", () => openEditDialog(character.id));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEditDialog(character.id);
    }
  });
  return card;
}

function render() {
  const visibleCharacters = getVisibleCharacters();
  elements.list.replaceChildren();

  if (visibleCharacters.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = characters.length === 0 ? "キャラクターがいません" : "該当するキャラクターがいません";
    elements.list.append(message);
  } else {
    visibleCharacters.forEach((character) => {
      elements.list.append(createCharacterCard(character));
    });
  }

  updateSummary();
}

function resetForm() {
  editingId = null;
  elements.dialogTitle.textContent = "キャラクター追加";
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
  elements.dialogTitle.textContent = "キャラクター編集";
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

  // Show the normalised values before closing; this also handles pasted full-width input.
  elements.level.value = data.level;
  elements.exp.value = data.previousExp;

  if (editingId) {
    const character = getCharacter(editingId);
    if (!character) {
      alert("編集するキャラクターが見つかりませんでした。");
      closeDialog();
      render();
      return;
    }
    Object.assign(character, data);
  } else {
    characters.push({
      id: createId(),
      ...data,
      daily: {},
      completed: false,
    });
  }

  saveCharacters();
  closeDialog();
  render();
}

function deleteCharacter() {
  const character = editingId ? getCharacter(editingId) : null;
  if (!character) return;

  if (!window.confirm(`「${character.name}」を削除しますか？`)) return;

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

  // Let Escape close the dialog normally.  Editing state is reset next time it opens.
}

function init() {
  readStoredCharacters();
  bindEvents();
  render();
}

init();
