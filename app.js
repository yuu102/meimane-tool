// めいまねつーる v1.0α - Character Manager

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "meimane.characters";

let characters = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let editingIndex = -1;

function saveStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
}

function updateSummary() {
    $("characterCount").textContent = characters.length;
    $("completeCount").textContent = 0;
    $("remainCount").textContent = characters.length;
}

function render() {
    const list = $("characterList");
    const keyword = $("searchBox").value.toLowerCase();

    list.innerHTML = "";

    characters
        .filter(c => c.name.toLowerCase().includes(keyword))
        .forEach((c, index) => {

            const card = document.createElement("div");
            card.className = "character-card";

            card.innerHTML = `
                <div class="character-name">${c.name}</div>
                <div class="character-level">Lv.${c.level}</div>
                <div class="daily-count">0 / 0</div>
            `;

            card.onclick = () => openEdit(index);

            list.appendChild(card);
        });

    updateSummary();
    saveStorage();
}

function openAdd() {
    editingIndex = -1;

    $("dialogTitle").textContent = "キャラクター追加";

    $("characterName").value = "";
    $("characterLevel").value = "";
    $("characterExp").value = "";

    $("deleteBtn").style.display = "none";

    $("characterDialog").showModal();
}

function openEdit(index) {

    editingIndex = index;

    const c = characters[index];

    $("dialogTitle").textContent = "キャラクター編集";

    $("characterName").value = c.name;
    $("characterLevel").value = c.level;
    $("characterExp").value = c.previousExp || "";

    $("deleteBtn").style.display = "block";

    $("characterDialog").showModal();
}

function saveCharacter() {

    const name = $("characterName").value.trim();
    const level = $("characterLevel").value.trim();
    const exp = $("characterExp").value.trim();

    if (!name) {
        alert("キャラ名を入力してください");
        return;
    }

    if (!level) {
        alert("レベルを入力してください");
        return;
    }

    const data = {
        name,
        level: Number(level),
        previousExp: exp,
        daily: {}
    };

    if (editingIndex === -1) {
        characters.push(data);
    } else {
        characters[editingIndex] = data;
    }

    $("characterDialog").close();
    render();
}

function deleteCharacter() {

    if (editingIndex === -1) return;

    if (!confirm("このキャラクターを削除しますか？")) return;

    characters.splice(editingIndex, 1);

    $("characterDialog").close();

    render();
}

window.addEventListener("DOMContentLoaded", () => {

    $("addCharacterBtn").addEventListener("click", openAdd);

    $("saveBtn").addEventListener("click", saveCharacter);

    $("cancelBtn").addEventListener("click", () => {
        $("characterDialog").close();
    });

    $("deleteBtn").addEventListener("click", deleteCharacter);

    $("searchBox").addEventListener("input", render);

    render();

});
