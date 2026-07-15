import { createJobSelect, seriesForJob } from "./jobs.js";

export function createCharacterFields(elements) {
  const form = elements.name.closest(".form"); const anchor = elements.level.previousElementSibling;
  const jobLabel = document.createElement("label"); jobLabel.textContent = "職業"; const job = createJobSelect(); job.id = "characterJob";
  const seriesLabel = document.createElement("label"); seriesLabel.textContent = "系列"; const series = document.createElement("input"); series.id = "characterSeries"; series.readOnly = true; series.placeholder = "職業を選ぶと自動設定";
  form.insertBefore(jobLabel, anchor); form.insertBefore(job, anchor); form.insertBefore(seriesLabel, anchor); form.insertBefore(series, anchor);
  job.addEventListener("change", () => { series.value = seriesForJob(job.value); }); return { job, series };
}

export function createDailyDialog(actions) {
  const dialog = document.createElement("dialog"); dialog.className = "daily-dialog"; dialog.innerHTML = "<h2>デイリー編集</h2><p class='daily-editor-hint'>クエストを追加・削除・並び替えできます。</p><div class='daily-editor-add'><input placeholder='クエスト名' maxlength='40'><button type='button'>追加</button></div><ol class='daily-editor-list'></ol><button class='daily-editor-close' type='button'>閉じる</button>"; document.body.append(dialog);
  const input = dialog.querySelector("input"), add = dialog.querySelector(".daily-editor-add button"), list = dialog.querySelector("ol"); let characterId = null;
  const draw = () => { const character = actions.find(characterId); list.replaceChildren(); if (!character) return; character.dailies.forEach((daily, index) => { const item = document.createElement("li"); const label = document.createElement("span"); label.textContent = daily.title; const controls = document.createElement("span"); controls.className = "daily-editor-item-controls"; [["↑", -1], ["↓", 1]].forEach(([text, move]) => { const b = document.createElement("button"); b.textContent = text; b.disabled = move < 0 ? index === 0 : index === character.dailies.length - 1; b.addEventListener("click", () => { actions.moveDaily(characterId, daily.id, move); draw(); actions.refresh(); }); controls.append(b); }); const del = document.createElement("button"); del.textContent = "削除"; del.addEventListener("click", () => { actions.deleteDaily(characterId, daily.id); draw(); actions.refresh(); }); controls.append(del); item.append(label, controls); list.append(item); }); };
  const addDaily = () => { if (!input.value.trim()) return input.focus(); actions.addDaily(characterId, input.value.trim()); input.value = ""; draw(); actions.refresh(); input.focus(); };
  add.addEventListener("click", addDaily); dialog.querySelector(".daily-editor-close").addEventListener("click", () => dialog.close()); input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addDaily(); } });
  return { open(id) { characterId = id; draw(); dialog.showModal(); input.focus(); } };
}

export function createDetailDialog(actions) {
  const dialog = document.createElement("dialog"); dialog.className = "character-detail-dialog"; dialog.innerHTML = "<h2></h2><div class='character-detail-body'></div><div class='character-detail-actions'><button type='button'>キャラ編集</button><button type='button'>デイリー編集</button><button type='button'>閉じる</button></div>"; document.body.append(dialog);
  const title = dialog.querySelector("h2"), body = dialog.querySelector(".character-detail-body"), [edit, daily, close] = dialog.querySelectorAll(".character-detail-actions button"); let characterId = null;
  const draw = () => { const character = actions.find(characterId); body.replaceChildren(); if (!character) return; title.textContent = `${character.name}の詳細`; const status = document.createElement("p"); status.className = `detail-status ${character.completed ? "is-completed" : ""}`; status.textContent = character.completed ? "✓ 完了" : "○ 未完了"; const h = document.createElement("h3"); h.textContent = "デイリー"; body.append(status, h); if (!character.dailies.length) { body.append(Object.assign(document.createElement("p"), { textContent: "クエストがありません", className: "daily-empty" })); return; } const list = document.createElement("div"); list.className = "detail-daily-list"; character.dailies.forEach((quest) => { const item = document.createElement("label"); item.className = "detail-daily-item"; const check = document.createElement("input"); check.type = "checkbox"; check.checked = quest.checked; check.addEventListener("change", () => { actions.setDaily(characterId, quest.id, check.checked); draw(); actions.refresh(); }); item.append(check, Object.assign(document.createElement("span"), { textContent: quest.title })); list.append(item); }); body.append(list); };
  close.addEventListener("click", () => dialog.close()); edit.addEventListener("click", () => { dialog.close(); actions.edit(characterId); }); daily.addEventListener("click", () => { dialog.close(); actions.editDailies(characterId); });
  return { open(id) { characterId = id; draw(); dialog.showModal(); }, close: () => dialog.close(), refresh: draw };
}

export function createSettingsDialog(settings, onSave, actions) {
  const dialog = document.createElement("dialog");
  dialog.className = "settings-dialog";
  dialog.innerHTML = "<h2>設定</h2><h3>表示設定</h3><label><input class='hide-completed' type='checkbox'> 完了したキャラを非表示</label><h3>並び替え</h3><label>並び替え <select><option value='default'>登録順</option><option value='favorite'>お気に入り順</option><option value='level'>Lv順</option><option value='name'>名前順</option></select></label><h3>デイリー</h3><label><input class='auto-reset' type='checkbox'> デイリー自動リセット</label><p>ONの場合、日付が変わって最初に開いたとき、デイリーのチェックをリセットします。</p><h3>データ管理</h3><div class='settings-data'><button class='backup' type='button'>💾 バックアップ</button><button class='restore' type='button'>📂 復元</button><input type='file' accept='application/json,.json' hidden></div><div><button class='save-settings' type='button'>保存</button><button class='cancel-settings' type='button'>キャンセル</button></div>";
  document.body.append(dialog);
  const select = dialog.querySelector("select");
  const hide = dialog.querySelector(".hide-completed");
  const reset = dialog.querySelector(".auto-reset");
  const input = dialog.querySelector("input[type=file]");
  dialog.querySelector(".backup").addEventListener("click", actions.onBackup);
  dialog.querySelector(".restore").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { if (input.files[0]) actions.onRestore(input.files[0]); input.value = ""; });
  dialog.querySelector(".save-settings").addEventListener("click", () => { onSave({ ...settings(), sortMode: select.value, autoDailyReset: reset.checked, hideCompleted: hide.checked }); dialog.close(); });
  dialog.querySelector(".cancel-settings").addEventListener("click", () => dialog.close());
  return { open() { const value = settings(); select.value = value.sortMode; reset.checked = value.autoDailyReset; hide.checked = value.hideCompleted; dialog.showModal(); } };
}
