# Как «задеплоить» новую версию SDK с твоим program id

SDK — это обычный npm-пакет (TypeScript), его не деплоят в блокчейн. Program id уже прописан в этом репо: **B8b7tz681buonvw7mb6rV5CABPy3fTekETea8tdQj8Kb** (в `sdk/src/pda.ts`, `sdk/src/fixed_vault.json`, `sdk/src/idl.ts`). Чтобы другой фронт использовал именно эту версию, есть два варианта.

### Где vault SDK на GitHub

| Что | Ссылка |
|-----|--------|
| Репозиторий | [github.com/Yumi-Finance/YumiSolanaVault](https://github.com/Yumi-Finance/YumiSolanaVault) |
| Папка **`sdk/`** (исходники `@yumi-finance/vault-sdk`) | […/tree/main/sdk](https://github.com/Yumi-Finance/YumiSolanaVault/tree/main/sdk) |

Пакет в реестре: **`@yumi-finance/vault-sdk`** → публикуется из этой папки `sdk/` после `npm run build` и `npm publish` (GitHub Packages).

---

## Вариант 1: Подключить SDK по пути (без публикации)

В проекте **другого фронта** в `package.json`:

```json
{
  "dependencies": {
    "@yumi-finance/vault-sdk": "file:../YumiSolanaVault/sdk"
  }
}
```

Замени `../YumiSolanaVault/sdk` на реальный путь до папки `sdk` этого репо (от корня другого проекта).

Дальше:

1. В корне **YumiSolanaVault** собери SDK:
   ```bash
   cd sdk && npm run build && cd ..
   ```
2. В проекте другого фронта:
   ```bash
   npm install
   ```
   (или `yarn`). Подтянется локальная копия SDK с твоим program id.

После любых правок в SDK снова делай `npm run build` в папке `sdk` и при необходимости в другом проекте переустанови зависимость (`npm install` / `yarn`).

---

## Вариант 2: Опубликовать пакет в реестр

Если хочешь ставить пакет через `npm install @yumi-finance/vault-sdk`.

### 1. Поднять версию

В `sdk/package.json` смени версию, например:

```json
"version": "0.2.0"
```

### 2. Собрать

```bash
cd sdk
npm run build
```

### 3. Опубликовать

- **npm (публичный):**  
  В `sdk/package.json` убери или измени `publishConfig`, чтобы пакет шёл в npm:
  ```json
  "publishConfig": { "access": "public" }
  ```
  Затем из папки `sdk`:
  ```bash
  npm login
  npm publish
  ```

- **GitHub Packages** (как сейчас в `publishConfig`) — **полная цепочка:**

  **Шаг 0 — токен GitHub**  
  [Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) → создать token (classic или fine-grained). Нужны права **`write:packages`** (и **`read:packages`**). Для приватного репо пакета иногда нужен ещё доступ к репозиторию — смотри доку GitHub.

  **Шаг 1 — код в Git**  
  Закоммить и запушить изменения в `YumiSolanaVault` (версию в `sdk/package.json` уже поднял, например `0.2.0`).

  **Шаг 2 — сборка** (из корня репо):
  ```bash
  cd sdk
  npm install
  npm run build
  ```
  Должна появиться папка `sdk/dist/` и `sdk/dist/esm/`.

  **Шаг 3 — логин в реестр GitHub** (один раз на машину или пока не истечёт токен):
  ```bash
  npm login --registry=https://npm.pkg.github.com
  ```
  - **Username:** твой логин GitHub (не email).  
  - **Password:** вставь **только PAT**, не пароль от аккаунта.  
  - **Email:** любой валидный.

  **Шаг 4 — публикация** (обязательно из папки **`sdk/`**, где лежит `package.json` пакета):
  ```bash
  cd /path/to/YumiSolanaVault/sdk
  npm publish
  ```
  Реестр подтянется из `publishConfig` → пакет уйдёт на `npm.pkg.github.com`.

  Проверка без публикации:
  ```bash
  npm publish --dry-run
  ```

  Если **`403`** или **`404`**: у аккаунта нет прав публиковать в org **Yumi-Finance**, или scope пакета не совпадает с владельцем на GitHub (должно быть `@yumi-finance/...` и доступ в организации).

В другом проекте тогда:

```bash
npm install @yumi-finance/vault-sdk@0.2.0
```

(или без версии — возьмётся последняя опубликованная).

---

## Итог

- **Program id** в SDK уже твой (**B8b7tz68...**), менять ничего не нужно.
- «Новая версия» = либо путь `file:...` к собранному `sdk`, либо новая версия в `package.json` и `npm publish`.
- Для одного своего фронта обычно достаточно **Варианта 1** (локальный путь к папке `sdk`).
