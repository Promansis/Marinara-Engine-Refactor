use marinara_core::{ensure_object, new_id, now_iso, AppError, AppResult};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};

pub const MEMORY_VERSION: &str = "1";
pub const MEMORY_DIR: &str = "memory";
pub const NOTES_FILE: &str = "notes.json";
pub const EVENTS_FILE: &str = "events.jsonl";
pub const MANIFEST_FILE: &str = "manifest.json";
pub const INDEXES_DIR: &str = "indexes";

#[derive(Debug, Clone)]
pub struct MemoryStore {
    root: PathBuf,
    lock: Arc<Mutex<()>>,
}

impl MemoryStore {
    pub fn new(data_dir: impl Into<PathBuf>) -> Self {
        Self {
            root: data_dir.into().join(MEMORY_DIR),
            lock: Arc::new(Mutex::new(())),
        }
    }

    pub fn ensure_layout(&self) -> AppResult<Value> {
        let _guard = self.lock()?;
        self.ensure_layout_locked()
    }

    pub fn list_notes(&self, options: Option<Value>) -> AppResult<Vec<Value>> {
        let _guard = self.lock()?;
        self.ensure_layout_locked()?;
        let mut notes = self.read_notes()?;
        notes.retain(|note| note_matches_options(note, options.as_ref()));
        notes.sort_by(|a, b| {
            b.get("updatedAt")
                .and_then(Value::as_str)
                .cmp(&a.get("updatedAt").and_then(Value::as_str))
        });
        if let Some(limit) = options
            .as_ref()
            .and_then(|value| value.get("limit"))
            .and_then(Value::as_u64)
            .map(|value| value as usize)
        {
            notes.truncate(limit);
        }
        Ok(notes)
    }

    pub fn get_note(&self, id: &str) -> AppResult<Option<Value>> {
        let _guard = self.lock()?;
        self.ensure_layout_locked()?;
        Ok(self
            .read_notes()?
            .into_iter()
            .find(|note| note.get("id").and_then(Value::as_str) == Some(id)))
    }

    pub fn create_note(&self, value: Value) -> AppResult<Value> {
        let _guard = self.lock()?;
        self.ensure_layout_locked()?;
        let mut notes = self.read_notes()?;
        let mut object = ensure_object(value)?;
        let id = object
            .get("id")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(new_id);
        let now = now_iso();
        object.insert("id".to_string(), Value::String(id.clone()));
        object.insert("status".to_string(), Value::String("active".to_string()));
        object
            .entry("modes".to_string())
            .or_insert_with(|| json!([]));
        object
            .entry("tags".to_string())
            .or_insert_with(|| json!([]));
        object
            .entry("links".to_string())
            .or_insert_with(|| json!([]));
        object
            .entry("createdAt".to_string())
            .or_insert_with(|| Value::String(now.clone()));
        object.insert("updatedAt".to_string(), Value::String(now));
        object.insert("version".to_string(), json!(1));
        object.insert("previousHash".to_string(), Value::Null);
        let note = Value::Object(object);
        notes.retain(|row| row.get("id").and_then(Value::as_str) != Some(id.as_str()));
        notes.push(note.clone());
        self.write_notes_and_manifest(&notes, None)?;
        Ok(note)
    }

    pub fn update_note(&self, id: &str, patch: Value) -> AppResult<Value> {
        let _guard = self.lock()?;
        self.ensure_layout_locked()?;
        let mut notes = self.read_notes()?;
        let patch = ensure_object(patch)?;
        let mut updated = None;
        for note in &mut notes {
            if note.get("id").and_then(Value::as_str) != Some(id) {
                continue;
            }
            let previous_hash = hash_value(note)?;
            let object = note
                .as_object_mut()
                .ok_or_else(|| AppError::invalid_input("Stored memory note is not an object"))?;
            for (key, value) in patch {
                object.insert(key, value);
            }
            let next_version = object
                .get("version")
                .and_then(Value::as_u64)
                .unwrap_or(1)
                .saturating_add(1);
            object.insert("updatedAt".to_string(), Value::String(now_iso()));
            object.insert("version".to_string(), json!(next_version));
            object.insert("previousHash".to_string(), Value::String(previous_hash));
            updated = Some(Value::Object(object.clone()));
            break;
        }
        let Some(note) = updated else {
            return Err(AppError::not_found(format!("memory note {id} was not found")));
        };
        self.write_notes_and_manifest(&notes, None)?;
        Ok(note)
    }

    pub fn archive_note(&self, id: &str) -> AppResult<Value> {
        self.update_note(id, json!({ "status": "archived" }))
    }

    pub fn append_event(&self, value: Value) -> AppResult<Value> {
        let _guard = self.lock()?;
        self.ensure_layout_locked()?;
        let mut object = ensure_object(value)?;
        object
            .entry("ts".to_string())
            .or_insert_with(|| Value::String(now_iso()));
        let event = Value::Object(object);
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.events_path())?;
        let mut line = serde_json::to_vec(&event)?;
        line.push(b'\n');
        file.write_all(&line)?;
        let notes = self.read_notes()?;
        self.write_manifest(None)?;
        self.write_notes(&notes)?;
        Ok(event)
    }

    pub fn manifest(&self) -> AppResult<Value> {
        let _guard = self.lock()?;
        self.ensure_layout_locked()?;
        self.write_manifest(None)
    }

    pub fn validate_vault(&self) -> AppResult<Value> {
        let _guard = self.lock()?;
        self.ensure_layout_locked()?;
        let mut issues = Vec::new();
        let notes = match self.read_notes() {
            Ok(notes) => notes,
            Err(error) => {
                issues.push(json!({
                    "severity": "error",
                    "path": NOTES_FILE,
                    "message": error.to_string()
                }));
                Vec::new()
            }
        };
        let events = match self.read_events() {
            Ok(events) => events,
            Err(error) => {
                issues.push(json!({
                    "severity": "error",
                    "path": EVENTS_FILE,
                    "message": error.to_string()
                }));
                Vec::new()
            }
        };
        for note in &notes {
            if note.get("id").and_then(Value::as_str).unwrap_or("").trim().is_empty() {
                issues.push(json!({
                    "severity": "error",
                    "path": NOTES_FILE,
                    "message": "Memory note is missing an id"
                }));
            }
        }
        Ok(json!({
            "ok": issues.is_empty(),
            "issues": issues,
            "staleIndexes": false,
            "counts": {
                "notes": notes.len(),
                "events": events.len()
            }
        }))
    }

    pub fn rebuild_indexes(&self, request: Option<Value>) -> AppResult<Value> {
        let _guard = self.lock()?;
        self.ensure_layout_locked()?;
        let embedding_model = request
            .as_ref()
            .and_then(|value| value.get("embeddingModel"))
            .cloned()
            .filter(|value| !value.is_null());
        let scope_options = request
            .as_ref()
            .and_then(|value| value.get("scope"))
            .map(|scope| json!({ "scope": scope }));
        let requested_note_ids = request
            .as_ref()
            .and_then(|value| value.get("noteIds"))
            .and_then(Value::as_array)
            .map(|ids| {
                ids.iter()
                    .filter_map(Value::as_str)
                    .map(ToOwned::to_owned)
                    .collect::<HashSet<_>>()
            });
        let mut notes = self.list_notes_locked(scope_options)?;
        if let Some(note_ids) = requested_note_ids {
            notes.retain(|note| {
                note.get("id")
                    .and_then(Value::as_str)
                    .is_some_and(|id| note_ids.contains(id))
            });
        }
        let reindexed_note_ids = notes
            .iter()
            .filter_map(|note| note.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
            .collect::<Vec<_>>();
        let manifest = self.write_manifest(embedding_model)?;
        Ok(json!({
            "noteCount": notes.len(),
            "eventCount": self.read_events()?.len(),
            "reindexedNoteIds": reindexed_note_ids,
            "removedNoteIds": [],
            "manifest": manifest,
            "warnings": []
        }))
    }

    fn lock(&self) -> AppResult<MutexGuard<'_, ()>> {
        self.lock
            .lock()
            .map_err(|_| AppError::new("lock_error", "Memory storage lock poisoned"))
    }

    fn ensure_layout_locked(&self) -> AppResult<Value> {
        fs::create_dir_all(self.indexes_path())?;
        if !self.notes_path().exists() {
            self.write_notes(&[])?;
        }
        if !self.events_path().exists() {
            fs::write(self.events_path(), [])?;
        }
        if !self.manifest_path().exists() {
            self.write_manifest(None)?;
        }
        Ok(self.layout_info())
    }

    fn list_notes_locked(&self, options: Option<Value>) -> AppResult<Vec<Value>> {
        let mut notes = self.read_notes()?;
        notes.retain(|note| note_matches_options(note, options.as_ref()));
        notes.sort_by(|a, b| {
            b.get("updatedAt")
                .and_then(Value::as_str)
                .cmp(&a.get("updatedAt").and_then(Value::as_str))
        });
        if let Some(limit) = options
            .as_ref()
            .and_then(|value| value.get("limit"))
            .and_then(Value::as_u64)
            .map(|value| value as usize)
        {
            notes.truncate(limit);
        }
        Ok(notes)
    }

    fn layout_info(&self) -> Value {
        json!({
            "version": MEMORY_VERSION,
            "rootPath": self.root.to_string_lossy(),
            "notesPath": self.notes_path().to_string_lossy(),
            "eventsPath": self.events_path().to_string_lossy(),
            "manifestPath": self.manifest_path().to_string_lossy(),
            "indexesPath": self.indexes_path().to_string_lossy()
        })
    }

    fn notes_path(&self) -> PathBuf {
        self.root.join(NOTES_FILE)
    }

    fn events_path(&self) -> PathBuf {
        self.root.join(EVENTS_FILE)
    }

    fn manifest_path(&self) -> PathBuf {
        self.root.join(MANIFEST_FILE)
    }

    fn indexes_path(&self) -> PathBuf {
        self.root.join(INDEXES_DIR)
    }

    fn read_notes(&self) -> AppResult<Vec<Value>> {
        read_json_array(&self.notes_path())
    }

    fn write_notes(&self, notes: &[Value]) -> AppResult<()> {
        write_json_pretty(&self.notes_path(), &Value::Array(notes.to_vec()))
    }

    fn write_notes_and_manifest(
        &self,
        notes: &[Value],
        embedding_model: Option<Value>,
    ) -> AppResult<()> {
        self.write_notes(notes)?;
        self.write_manifest(embedding_model)?;
        Ok(())
    }

    fn read_events(&self) -> AppResult<Vec<Value>> {
        let path = self.events_path();
        if !path.exists() {
            return Ok(Vec::new());
        }
        let raw = fs::read_to_string(path)?;
        raw.lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str(line).map_err(AppError::from))
            .collect()
    }

    fn write_manifest(&self, embedding_model: Option<Value>) -> AppResult<Value> {
        let notes_file = file_entry(&self.root, NOTES_FILE)?;
        let events_file = file_entry(&self.root, EVENTS_FILE)?;
        let files = vec![notes_file, events_file];
        let vault_hash = hash_value(&Value::Array(files.clone()))?;
        let embedding_model = embedding_model.unwrap_or_else(|| {
            read_json_object(&self.manifest_path())
                .ok()
                .and_then(|manifest| manifest.get("embeddingModel").cloned())
                .unwrap_or(Value::Null)
        });
        let manifest = json!({
            "version": MEMORY_VERSION,
            "embeddingModel": embedding_model,
            "generatedAt": now_iso(),
            "vaultHash": vault_hash,
            "files": files
        });
        write_json_pretty(&self.manifest_path(), &manifest)?;
        Ok(manifest)
    }
}

fn read_json_object(path: &Path) -> AppResult<Map<String, Value>> {
    if !path.exists() {
        return Ok(Map::new());
    }
    let raw = fs::read_to_string(path)?;
    if raw.trim().is_empty() {
        return Ok(Map::new());
    }
    match serde_json::from_str(&raw)? {
        Value::Object(value) => Ok(value),
        _ => Err(AppError::invalid_input(format!(
            "{} did not contain a JSON object",
            path.display()
        ))),
    }
}

fn read_json_array(path: &Path) -> AppResult<Vec<Value>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path)?;
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    match serde_json::from_str(&raw)? {
        Value::Array(values) => Ok(values),
        _ => Err(AppError::invalid_input(format!(
            "{} did not contain a JSON array",
            path.display()
        ))),
    }
}

fn write_json_pretty(path: &Path, value: &Value) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(value)?)?;
    fs::rename(tmp, path)?;
    Ok(())
}

fn file_entry(root: &Path, relative: &str) -> AppResult<Value> {
    let path = root.join(relative);
    if !path.exists() {
        return Ok(json!({
            "path": relative,
            "hash": "",
            "bytes": 0
        }));
    }
    let bytes = fs::read(&path)?;
    let updated_at = fs::metadata(&path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .map(chrono_like_system_time)
        .unwrap_or_else(now_iso);
    Ok(json!({
        "path": relative,
        "hash": hex_sha256(&bytes),
        "bytes": bytes.len(),
        "updatedAt": updated_at
    }))
}

fn note_matches_options(note: &Value, options: Option<&Value>) -> bool {
    let include_archived = options
        .and_then(|value| value.get("includeArchived"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !include_archived && note.get("status").and_then(Value::as_str) == Some("archived") {
        return false;
    }
    if let Some(status) = options
        .and_then(|value| value.get("status"))
        .and_then(Value::as_str)
    {
        if note.get("status").and_then(Value::as_str) != Some(status) {
            return false;
        }
    }
    if let Some(types) = options
        .and_then(|value| value.get("types"))
        .and_then(Value::as_array)
    {
        if !string_array_contains(types, note.get("type").and_then(Value::as_str)) {
            return false;
        }
    }
    if let Some(modes) = options
        .and_then(|value| value.get("modes"))
        .and_then(Value::as_array)
    {
        let note_modes = note
            .get("modes")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if !modes
            .iter()
            .filter_map(Value::as_str)
            .any(|mode| string_array_contains(&note_modes, Some(mode)))
        {
            return false;
        }
    }
    if let Some(tags) = options
        .and_then(|value| value.get("tags"))
        .and_then(Value::as_array)
    {
        let note_tags = note
            .get("tags")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if !tags
            .iter()
            .filter_map(Value::as_str)
            .all(|tag| string_array_contains(&note_tags, Some(tag)))
        {
            return false;
        }
    }
    if let Some(scope) = options
        .and_then(|value| value.get("scope"))
        .and_then(Value::as_object)
    {
        let note_scope = note.get("scope").and_then(Value::as_object);
        if !matches_scope(note_scope, scope) {
            return false;
        }
    }
    true
}

fn matches_scope(note_scope: Option<&Map<String, Value>>, expected: &Map<String, Value>) -> bool {
    expected.iter().all(|(key, value)| {
        value.is_null() || note_scope.and_then(|scope| scope.get(key)) == Some(value)
    })
}

fn string_array_contains(values: &[Value], expected: Option<&str>) -> bool {
    let Some(expected) = expected else {
        return false;
    };
    values.iter().any(|value| value.as_str() == Some(expected))
}

fn hash_value(value: &Value) -> AppResult<String> {
    Ok(hex_sha256(&serde_json::to_vec(value)?))
}

fn hex_sha256(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn chrono_like_system_time(time: std::time::SystemTime) -> String {
    let duration = time
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("unix:{}", duration.as_secs())
}
