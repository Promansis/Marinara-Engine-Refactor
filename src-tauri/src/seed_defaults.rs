use crate::builtins::{
    PROFESSOR_MARI_ASSISTANT_PROMPT_SETTINGS_KEY, PROFESSOR_MARI_AVATAR, PROFESSOR_MARI_CHAT_ID,
    PROFESSOR_MARI_ID,
};
use marinara_core::{now_iso, AppResult};
use marinara_storage::FileStorage;
use serde_json::{json, Map, Value};
use std::path::Path;

const MARINARA_PRESET_ID: &str = "7huDl_SOx3a5EZtMeKqSR";
const MARINARA_PRESET_NAME: &str = "Marinara's Universal Preset";
const LEGACY_MARINARA_PRESET_NAME: &str = "Default";
const MARINARA_PRESET_AUTHOR: &str = "Marinara";

pub fn seed_bundled_defaults(storage: &FileStorage, default_data: &Path) -> AppResult<()> {
    let db_root = default_data.join("db");
    seed_professor_mari(storage, &db_root)?;
    seed_professor_mari_chat(storage, &db_root)?;
    seed_marinara_preset(storage, &db_root)?;
    seed_default_chat_presets(storage)?;
    seed_default_regex_scripts(storage)?;
    seed_default_ui_settings(storage)?;
    Ok(())
}

fn seed_professor_mari(storage: &FileStorage, db_root: &Path) -> AppResult<()> {
    let character_path = db_root.join("professor-mari-character.json");
    if !character_path.exists() {
        return Ok(());
    }

    let character_data: Value = serde_json::from_str(&std::fs::read_to_string(character_path)?)?;
    let serialized = serde_json::to_string(&character_data)?;
    let record = json!({
        "id": PROFESSOR_MARI_ID,
        "data": serialized,
        "comment": "",
        "avatarPath": PROFESSOR_MARI_AVATAR,
        "spriteFolderPath": Value::Null
    });

    match storage.get("characters", PROFESSOR_MARI_ID)? {
        Some(existing)
            if existing.get("data").and_then(Value::as_str) == Some(serialized.as_str())
                && existing.get("avatarPath").and_then(Value::as_str)
                    == Some(PROFESSOR_MARI_AVATAR) => {}
        Some(_) => {
            storage.patch(
                "characters",
                PROFESSOR_MARI_ID,
                json!({ "data": serialized, "avatarPath": PROFESSOR_MARI_AVATAR }),
            )?;
        }
        None => {
            storage.create("characters", record)?;
        }
    }

    let prompt_path = db_root.join("professor-mari-assistant-prompt.txt");
    if prompt_path.exists() {
        storage.upsert_with_id(
            "app-settings",
            PROFESSOR_MARI_ASSISTANT_PROMPT_SETTINGS_KEY,
            json!({ "value": std::fs::read_to_string(prompt_path)? }),
        )?;
    }

    Ok(())
}

fn seed_professor_mari_chat(storage: &FileStorage, db_root: &Path) -> AppResult<()> {
    let character_path = db_root.join("professor-mari-character.json");
    if !character_path.exists() {
        return Ok(());
    }

    let character_data: Value = serde_json::from_str(&std::fs::read_to_string(character_path)?)?;
    let first_message = character_data
        .get("data")
        .and_then(|data| data.get("first_mes"))
        .or_else(|| character_data.get("first_mes"))
        .and_then(Value::as_str)
        .unwrap_or("Hey! Welcome to Marinara Engine. I'm Mari, your built-in assistant.")
        .trim()
        .to_string();
    let now = now_iso();

    match storage.get("chats", PROFESSOR_MARI_CHAT_ID)? {
        Some(existing) => {
            let mut patch = Map::new();
            patch.insert("mode".to_string(), json!("conversation"));
            patch.insert("characterIds".to_string(), json!([PROFESSOR_MARI_ID]));
            patch.insert("protected".to_string(), json!(true));
            patch.insert("isBuiltIn".to_string(), json!(true));
            if existing.get("metadata").is_none() {
                patch.insert("metadata".to_string(), professor_mari_chat_metadata());
            }
            storage.patch("chats", PROFESSOR_MARI_CHAT_ID, Value::Object(patch))?;
        }
        None => {
            storage.create(
                "chats",
                json!({
                    "id": PROFESSOR_MARI_CHAT_ID,
                    "name": "Professor Mari",
                    "mode": "conversation",
                    "characterIds": [PROFESSOR_MARI_ID],
                    "groupId": Value::Null,
                    "personaId": Value::Null,
                    "promptPresetId": Value::Null,
                    "connectionId": Value::Null,
                    "connectedChatId": Value::Null,
                    "folderId": Value::Null,
                    "sortOrder": -1000,
                    "metadata": professor_mari_chat_metadata(),
                    "gameState": {},
                    "protected": true,
                    "isBuiltIn": true,
                    "lastMessageAt": now,
                }),
            )?;
        }
    }

    if storage.get("messages", "professor-mari-welcome")?.is_none() {
        storage.create(
            "messages",
            json!({
                "id": "professor-mari-welcome",
                "chatId": PROFESSOR_MARI_CHAT_ID,
                "role": "assistant",
                "characterId": PROFESSOR_MARI_ID,
                "content": first_message.clone(),
                "extra": {
                    "displayText": Value::Null,
                    "isGenerated": false,
                    "tokenCount": Value::Null,
                    "generationInfo": Value::Null,
                    "isConversationStart": true
                },
                "activeSwipeIndex": 0,
                "swipes": [{ "content": first_message.clone() }],
            }),
        )?;
    }

    Ok(())
}

fn professor_mari_chat_metadata() -> Value {
    json!({
        "summary": Value::Null,
        "tags": ["built-in", "assistant"],
        "enableAgents": true,
        "agentOverrides": {},
        "activeAgentIds": [],
        "activeToolIds": [],
        "presetChoices": {},
        "enableMemoryRecall": true,
        "characterCommands": true,
        "conversationSchedulesEnabled": false,
        "isBuiltInAssistant": true,
        "protected": true
    })
}

fn seed_marinara_preset(storage: &FileStorage, db_root: &Path) -> AppResult<()> {
    let preset_path = db_root.join("default-preset.json");
    if !preset_path.exists() {
        return Ok(());
    }

    let envelope: Value = serde_json::from_str(&std::fs::read_to_string(preset_path)?)?;
    let data = envelope.get("data").cloned().unwrap_or(Value::Null);
    let Some(preset) = data.get("preset").and_then(Value::as_object) else {
        return Ok(());
    };

    rename_legacy_default_preset(storage)?;

    let has_bundled = storage.get("prompts", MARINARA_PRESET_ID)?.is_some()
        || storage.list("prompts")?.into_iter().any(|row| {
            row.get("name").and_then(Value::as_str) == Some(MARINARA_PRESET_NAME)
                && row.get("author").and_then(Value::as_str) == Some(MARINARA_PRESET_AUTHOR)
        });
    if !has_bundled {
        storage.create("prompts", Value::Object(preset.clone()))?;
    }

    seed_related_prompt_rows_if_missing(storage, "prompt-groups", data.get("groups"))?;
    seed_related_prompt_rows_if_missing(storage, "prompt-sections", data.get("sections"))?;
    seed_related_prompt_rows_if_missing(storage, "prompt-variables", data.get("choiceBlocks"))?;
    Ok(())
}

fn rename_legacy_default_preset(storage: &FileStorage) -> AppResult<()> {
    let legacy = storage.list("prompts")?.into_iter().find(|row| {
        row.get("name").and_then(Value::as_str) == Some(LEGACY_MARINARA_PRESET_NAME)
            && row.get("author").and_then(Value::as_str) == Some(MARINARA_PRESET_AUTHOR)
    });
    if let Some(legacy) = legacy {
        if let Some(id) = legacy.get("id").and_then(Value::as_str) {
            storage.patch(
                "prompts",
                id,
                json!({
                    "name": MARINARA_PRESET_NAME,
                    "description": "Marinara's universal roleplay preset. Serves as a good base."
                }),
            )?;
        }
    }
    Ok(())
}

fn seed_related_prompt_rows_if_missing(
    storage: &FileStorage,
    collection: &str,
    rows: Option<&Value>,
) -> AppResult<()> {
    let Some(rows) = rows.and_then(Value::as_array) else {
        return Ok(());
    };
    for row in rows {
        if let Some(id) = row.get("id").and_then(Value::as_str) {
            if storage.get(collection, id)?.is_some() {
                continue;
            }
        }
        storage.create(collection, row.clone())?;
    }
    Ok(())
}

fn seed_default_chat_presets(storage: &FileStorage) -> AppResult<()> {
    for mode in ["conversation", "roleplay", "visual_novel"] {
        let id = format!("default-chat-preset-{mode}");
        if storage.get("chat-presets", &id)?.is_none() {
            let has_mode_rows = storage
                .list("chat-presets")?
                .into_iter()
                .any(|row| row.get("mode").and_then(Value::as_str) == Some(mode));
            storage.create(
                "chat-presets",
                json!({
                    "id": id,
                    "name": "Default",
                    "mode": mode,
                    "settings": {},
                    "isDefault": true,
                    "default": true,
                    "isActive": !has_mode_rows,
                    "active": !has_mode_rows
                }),
            )?;
        }

        let rows = storage.list("chat-presets")?;
        let has_active = rows.iter().any(|row| {
            row.get("mode").and_then(Value::as_str) == Some(mode)
                && (is_truthy(row.get("isActive")) || is_truthy(row.get("active")))
        });
        if !has_active {
            storage.patch(
                "chat-presets",
                &id,
                json!({
                    "isActive": true,
                    "active": true
                }),
            )?;
        }
    }
    Ok(())
}

fn seed_default_regex_scripts(storage: &FileStorage) -> AppResult<()> {
    let scripts = [
        json!({
            "id": "default-clean-html",
            "name": "Clean HTML (Outgoing Prompt)",
            "enabled": true,
            "findRegex": r#"[ \t]?<(?!--)(?!\/?(?:font|lie|filter)\b)(?:"[^"]*"|'[^']*'|[^'">])*>"#,
            "replaceString": "",
            "trimStrings": [],
            "placement": ["user_input", "ai_output"],
            "flags": "g",
            "promptOnly": true,
            "order": 0,
            "sortOrder": 0,
            "minDepth": Value::Null,
            "maxDepth": Value::Null
        }),
        json!({
            "id": "default-collapse-newlines",
            "name": "Collapse Excess Newlines",
            "enabled": true,
            "findRegex": r#"\n{3,}"#,
            "replaceString": "\n\n",
            "trimStrings": [],
            "placement": ["user_input", "ai_output"],
            "flags": "g",
            "promptOnly": false,
            "order": 10,
            "sortOrder": 10,
            "minDepth": Value::Null,
            "maxDepth": Value::Null
        }),
    ];

    for script in scripts {
        let Some(id) = script
            .get("id")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
        else {
            continue;
        };
        if storage.get("regex-scripts", &id)?.is_none() {
            storage.create("regex-scripts", script)?;
        }
    }
    Ok(())
}

fn seed_default_ui_settings(storage: &FileStorage) -> AppResult<()> {
    let defaults = [
        ("imageBackgroundWidth", json!(1280)),
        ("imageBackgroundHeight", json!(720)),
        ("imagePortraitWidth", json!(1024)),
        ("imagePortraitHeight", json!(1024)),
        ("imageSelfieWidth", json!(896)),
        ("imageSelfieHeight", json!(1152)),
    ];

    let mut ui = storage
        .get("app-settings", "ui")?
        .and_then(|record| record.get("value").cloned())
        .and_then(parse_settings_object)
        .unwrap_or_default();

    let mut changed = false;
    for (key, value) in defaults {
        if !ui.contains_key(key) {
            ui.insert(key.to_string(), value);
            changed = true;
        }
    }
    if changed || storage.get("app-settings", "ui")?.is_none() {
        ui.insert("updatedAt".to_string(), json!(now_iso()));
        storage.upsert_with_id("app-settings", "ui", json!({ "value": Value::Object(ui) }))?;
    }
    Ok(())
}

fn parse_settings_object(value: Value) -> Option<Map<String, Value>> {
    match value {
        Value::Object(object) => Some(object),
        Value::String(raw) => serde_json::from_str::<Value>(&raw)
            .ok()
            .and_then(parse_settings_object),
        _ => None,
    }
}

fn is_truthy(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(value)) => value == "true",
        _ => false,
    }
}
