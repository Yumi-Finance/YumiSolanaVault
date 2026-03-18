/**
 * Конвертирует приватный ключ Phantom (длинная base58 строка) в ~/.config/solana/id.json
 * Запуск: PRIVATE_KEY_BASE58="твой_ключ_base58" node scripts/phantom-secret-to-idjson.js
 * или: node scripts/phantom-secret-to-idjson.js "твой_ключ_base58"
 * Не коммить ключ в репо. Скрипт не логирует ключ.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const base58 = process.env.PRIVATE_KEY_BASE58 || process.argv[2];
if (!base58 || typeof base58 !== "string") {
  console.error("Передай приватный ключ (base58): PRIVATE_KEY_BASE58=... node scripts/phantom-secret-to-idjson.js");
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");
const bs58Path = path.join(projectRoot, "node_modules", "bs58");
let bytes;
try {
  const bs58 = require(bs58Path).default || require(bs58Path);
  bytes = bs58.decode(base58.trim());
} catch (e) {
  console.error("Ошибка:", e.message);
  console.error("Убедись, что в корне проекта выполнен: npm install (или yarn)");
  process.exit(1);
}

if (bytes.length !== 64) {
  console.error("Ожидается 64 байта после декода, получено:", bytes.length);
  process.exit(1);
}

const dir = path.join(os.homedir(), ".config", "solana");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
const outPath = path.join(dir, "id.json");
fs.writeFileSync(outPath, JSON.stringify(Array.from(bytes)), "utf8");
console.log("Записано:", outPath);
console.log("Проверка адреса: solana address");
