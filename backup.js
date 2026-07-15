function validateCharacters(records) {
  return Array.isArray(records) && records.every((record) => record && typeof record === "object" && typeof record.name === "string");
}

export function downloadBackup(characters, settings) {
  const payload = {
    app: "meimane-tool",
    version: "1.3.1",
    exportedAt: new Date().toISOString(),
    characters,
    settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `meimane-tool-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 配列・旧 {characters}・現行 {characters, settings} のすべてを受け入れる。 */
export function readBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const records = Array.isArray(parsed) ? parsed : parsed?.characters;
        if (!validateCharacters(records)) throw new Error("Invalid character records");
        const settings = parsed && !Array.isArray(parsed) && parsed.settings && typeof parsed.settings === "object" ? parsed.settings : null;
        resolve({ characters: records, settings });
      } catch {
        reject(new Error("JSONが正しくありません。"));
      }
    };
    reader.onerror = () => reject(new Error("ファイルを読み込めません。"));
    reader.readAsText(file, "UTF-8");
  });
}
