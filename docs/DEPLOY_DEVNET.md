# Деплой волта на Devnet со своим Bootstrap Authority

Чтобы управлять волтом (создавать пулы, repay, enable_withdrawals и т.д.), authority в ProtocolConfig должен быть твой. Сейчас только bootstrap authority может вызвать `init_config` и стать первым authority. Ниже — как задеплоить программу с твоим кошельком как bootstrap.

---

## Куда менять адрес (bootstrap = твой кошелёк)

**Файл:** `programs/fixed-vault/src/lib.rs`  
**Строка 13:** внутри `pubkey!("...")` замени строку на **публичный адрес** своего Phantom (короткий, как в админке «Connected as»). Длинная строка из Phantom — это **приватный ключ**, его в код не подставлять.

```rust
pub const BOOTSTRAP_AUTHORITY: Pubkey = pubkey!("ТВОЙ_ПУБЛИЧНЫЙ_АДРЕС");
```

Один адрес — только здесь. Дальше по шагам ниже либо апгрейд текущей программы, либо свой деплой с новым program id.

---

## Длинная строка из Phantom (приватный ключ) → id.json

Если Phantom отдал **длинную** base58 строку (приватный ключ), из неё можно собрать `~/.config/solana/id.json` для деплоя:

```bash
cd /path/to/YumiSolanaVault
npm install
PRIVATE_KEY_BASE58="вставь_сюда_длинную_строку" node scripts/phantom-secret-to-idjson.js
```

Или: `node scripts/phantom-secret-to-idjson.js "вставь_длинную_строку"`.  
Проверка: `solana address` — должен совпасть с адресом в Phantom. Ключ в репо не коммить.

## Вариант A: У тебя есть upgrade authority текущей программы

Если программа `1hV5chUTbSWcaGH76TpXq8iCFQrjKPACGF6eD68nT53` уже на devnet и ключ upgrade у тебя:

1. В `programs/fixed-vault/src/lib.rs` замени `BOOTSTRAP_AUTHORITY` на свой публичный ключ (адрес Phantom):
   ```rust
   pub const BOOTSTRAP_AUTHORITY: Pubkey = pubkey!("ТВОЙ_АДРЕС_PHANTOM");
   ```
2. Собери и обнови программу:
   ```bash
   anchor build
   anchor upgrade target/deploy/fixed_vault.so --program-id 1hV5chUTbSWcaGH76TpXq8iCFQrjKPACGF6eD68nT53 --provider.cluster devnet
   ```
3. Подключи Phantom к фронту, выбери Devnet, вызови на программе `init_config` (если конфиг ещё не создан). После этого authority = твой кошелёк.

---

## Вариант B: Свой деплой (новый program id)

Если upgrade key нет или нужна своя копия программы:

### 1. Bootstrap authority

В `programs/fixed-vault/src/lib.rs` замени значение `BOOTSTRAP_AUTHORITY` на адрес своего кошелька (Phantom):

```rust
pub const BOOTSTRAP_AUTHORITY: Pubkey = pubkey!("ТВОЙ_ПУБЛИЧНЫЙ_КЛЮЧ_BASE58");
```

### 2. Новый keypair программы

```bash
mkdir -p target/deploy
solana-keygen new -o target/deploy/fixed_vault-keypair.json --no-bip39-passphrase
solana-keygen pubkey target/deploy/fixed_vault-keypair.json
```

Скопируй выведенный pubkey (например `Abc123...`).

### 3. Подставить новый program id в проект

Замени **везде** старый id `1hV5chUTbSWcaGH76TpXq8iCFQrjKPACGF6eD68nT53` на новый (из шага 2):

- `programs/fixed-vault/src/lib.rs` — строка с `declare_id!("...");`
- `Anchor.toml` — в секции `[programs.localnet]` и в добавленной `[programs.devnet]` (см. ниже)
- `sdk/src/pda.ts` — константа `FIXED_VAULT_PROGRAM_ID`
- `app/src/lib/constants.ts` — константа `PROGRAM_ID`

В `Anchor.toml` добавь (или измени) секцию для devnet:

```toml
[programs.devnet]
fixed_vault = "НОВЫЙ_PROGRAM_ID_ИЗ_ШАГА_2"
```

И для деплоя используй devnet и кошелёк с SOL:

```toml
[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

(или передавай `--provider.cluster devnet` и `--provider.wallet ...` в командах.)

### 4. Сборка и деплой

```bash
anchor build
cp target/idl/fixed_vault.json sdk/src/fixed_vault.json
anchor deploy --provider.cluster devnet
```

Деплой списывает SOL с кошелька из `provider.wallet` (или из `--provider.wallet`). На devnet SOL можно взять с крана: https://faucet.solana.com

### 5. Инициализация конфига

После деплоя открой фронт (app), подключи Phantom (тот же кошелёк, что указан в `BOOTSTRAP_AUTHORITY`), выбери Devnet. В админке вызови инициализацию конфига (кнопка/действие для `init_config`). Один раз выполнится создание ProtocolConfig, и authority станет твой кошелёк. Дальше можешь создавать пулы и управлять ими.

---

## Кратко

- **Bootstrap** задаётся в коде константой `BOOTSTRAP_AUTHORITY` в `programs/fixed-vault/src/lib.rs`. Только этот кошелёк может вызвать `init_config`.
- После вызова `init_config` в ProtocolConfig записывается authority = подписант (bootstrap), дальше админские действия может делать уже этот authority (и тот, кому передадут через propose/accept).
- Для devnet в конфиге должен быть devnet (Anchor.toml / provider) и при новом деплое — новый program id везде (lib.rs, Anchor.toml, sdk, app).
