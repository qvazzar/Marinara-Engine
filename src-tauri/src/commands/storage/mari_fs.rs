use crate::state::AppState;
use marinara_core::{AppError, AppResult};
use serde_json::{json, Map, Value};

const MAX_READ_LINES: usize = 240;
const MAX_READ_BYTES: usize = 48 * 1024;

const ROOT_MOUNTS: &[MariMount] = &[
    MariMount { dir: "characters", collection: "characters", label: "Characters", prefix: "character" },
    MariMount { dir: "character-groups", collection: "character-groups", label: "Character groups", prefix: "character-group" },
    MariMount { dir: "personas", collection: "personas", label: "Personas", prefix: "persona" },
    MariMount { dir: "persona-groups", collection: "persona-groups", label: "Persona groups", prefix: "persona-group" },
    MariMount { dir: "lorebooks", collection: "lorebooks", label: "Lorebooks", prefix: "lorebook" },
    MariMount { dir: "prompts", collection: "prompts", label: "Prompt presets", prefix: "prompt" },
];

const PROMPT_CHILD_MOUNTS: &[MariMount] = &[
    MariMount { dir: "sections", collection: "prompt-sections", label: "Prompt sections", prefix: "section" },
    MariMount { dir: "groups", collection: "prompt-groups", label: "Prompt groups", prefix: "group" },
    MariMount { dir: "variables", collection: "prompt-variables", label: "Prompt variables", prefix: "variable" },
];

const LOREBOOK_ENTRY_MOUNT: MariMount = MariMount {
    dir: "entries",
    collection: "lorebook-entries",
    label: "Lorebook entries",
    prefix: "entry",
};

struct MariMount {
    dir: &'static str,
    collection: &'static str,
    label: &'static str,
    prefix: &'static str,
}

#[derive(Clone)]
struct MariRecordRef {
    ordinal: usize,
    id: String,
    label: String,
    path: String,
}

pub(crate) fn ls(state: &AppState, path: &str) -> AppResult<Value> {
    let normalized = normalize_path(path)?;
    let parts = parts(&normalized);
    match parts.as_slice() {
        [] => Ok(json!({
            "path": "/",
            "entries": [
                { "name": "help.md", "type": "file", "path": "/help.md" },
                { "name": "library", "type": "directory", "path": "/library" },
                { "name": "schema", "type": "directory", "path": "/schema" }
            ]
        })),
        ["library"] => Ok(json!({
            "path": "/library",
            "entries": ROOT_MOUNTS.iter().map(|mount| json!({
                "name": mount.dir,
                "type": "directory",
                "path": format!("/library/{}", mount.dir),
                "label": mount.label,
                "collection": mount.collection,
            })).collect::<Vec<_>>()
        })),
        ["library", "prompts"] => ls_parent_collection(state, root_mount("prompts")?, true),
        ["library", "prompts", prompt_dir] => ls_prompt_dir(state, prompt_dir),
        ["library", "prompts", prompt_dir, child_dir] => ls_prompt_child_dir(state, prompt_dir, child_dir),
        ["library", "lorebooks"] => ls_parent_collection(state, root_mount("lorebooks")?, true),
        ["library", "lorebooks", lorebook_dir] => ls_lorebook_dir(state, lorebook_dir),
        ["library", "lorebooks", lorebook_dir, "entries"] => ls_lorebook_entries_dir(state, lorebook_dir),
        ["library", dir] => {
            let mount = root_mount(dir)?;
            ls_flat_collection(state, mount)
        }
        ["schema"] => Ok(json!({
            "path": "/schema",
            "entries": schema_entries(),
        })),
        _ => Err(AppError::not_found(format!("No such directory in Professor Mari workspace: {normalized}"))),
    }
}

pub(crate) fn read(state: &AppState, path: &str, offset: Option<usize>, limit: Option<usize>) -> AppResult<Value> {
    let normalized = normalize_path(path)?;
    let content = read_content(state, &normalized)?;
    let total_lines = content.lines().count().max(1);
    let offset = offset.unwrap_or(1).max(1);
    let limit = limit.unwrap_or(MAX_READ_LINES).min(MAX_READ_LINES).max(1);
    let mut selected = content.lines().skip(offset.saturating_sub(1)).take(limit).collect::<Vec<_>>().join("\n");
    let mut truncated = offset.saturating_sub(1) + limit < total_lines;
    if selected.len() > MAX_READ_BYTES {
        selected.truncate(MAX_READ_BYTES);
        truncated = true;
    }
    Ok(json!({
        "path": normalized,
        "offset": offset,
        "limit": limit,
        "totalLines": total_lines,
        "truncated": truncated,
        "content": selected,
    }))
}

pub(crate) fn write(state: &AppState, path: &str, content: &str) -> AppResult<Value> {
    let normalized = normalize_path(path)?;
    let parsed = serde_json::from_str::<Value>(content)
        .map_err(|error| AppError::invalid_input(format!("write content must be valid JSON for {normalized}: {error}")))?;
    write_json_content(state, &normalized, parsed)
}

pub(crate) fn edit(state: &AppState, path: &str, edits: &[(String, String)]) -> AppResult<Value> {
    if edits.is_empty() {
        return Err(AppError::invalid_input("edit requires at least one replacement"));
    }
    let normalized = normalize_path(path)?;
    let mut content = read_content(state, &normalized)?;
    for (old_text, new_text) in edits {
        if old_text.is_empty() {
            return Err(AppError::invalid_input("edit oldText must not be empty"));
        }
        let count = content.matches(old_text).count();
        if count != 1 {
            return Err(AppError::invalid_input(format!(
                "edit oldText must match exactly once in {normalized}; matched {count} times"
            )));
        }
        content = content.replacen(old_text, new_text, 1);
    }
    write(state, &normalized, &content)
}

pub(crate) fn rm(state: &AppState, path: &str) -> AppResult<Value> {
    let normalized = normalize_path(path)?;
    let parts = parts(&normalized);
    let (collection, id) = match parts.as_slice() {
        ["library", "prompts", prompt_dir] | ["library", "prompts", prompt_dir, "preset.json"] => {
            let prompt = prompt_ref(state, prompt_dir)?;
            ("prompts", prompt.id)
        }
        ["library", "prompts", prompt_dir, child_dir, filename] => {
            let prompt = prompt_ref(state, prompt_dir)?;
            let mount = prompt_child_mount(child_dir)?;
            let id = resolve_record_id_from_file_name(state, mount, Some(("presetId", prompt.id.as_str())), filename)?;
            (mount.collection, id)
        }
        ["library", "lorebooks", lorebook_dir] | ["library", "lorebooks", lorebook_dir, "book.json"] => {
            let lorebook = lorebook_ref(state, lorebook_dir)?;
            ("lorebooks", lorebook.id)
        }
        ["library", "lorebooks", lorebook_dir, "entries", filename] => {
            let lorebook = lorebook_ref(state, lorebook_dir)?;
            let id = resolve_record_id_from_file_name(state, &LOREBOOK_ENTRY_MOUNT, Some(("lorebookId", lorebook.id.as_str())), filename)?;
            ("lorebook-entries", id)
        }
        ["library", dir, filename] => {
            let mount = root_mount(dir)?;
            if mount.collection == "prompts" || mount.collection == "lorebooks" {
                return Err(AppError::invalid_input("Delete prompt and lorebook parents by their directory path or parent file path"));
            }
            let id = resolve_record_id_from_file_name(state, mount, None, filename)?;
            (mount.collection, id)
        }
        _ => return Err(AppError::invalid_input(format!("Path is not deletable in Professor Mari workspace: {normalized}"))),
    };
    let deleted = state.storage.delete(collection, &id)?;
    Ok(json!({ "path": normalized, "collection": collection, "id": id, "deleted": deleted }))
}

fn write_json_content(state: &AppState, normalized: &str, content: Value) -> AppResult<Value> {
    let parts = parts(normalized);
    match parts.as_slice() {
        ["library", "prompts", prompt_dir, "preset.json"] => {
            let existing = prompt_ref(state, prompt_dir).ok();
            let id = existing.as_ref().map(|record| record.id.clone());
            let record = upsert_record(state, "prompts", id, merge_for_parent_file(state, "prompts", existing.as_ref().map(|record| record.id.as_str()), content, &["sectionOrder", "groupOrder", "variableGroups", "variableValues", "sections", "groups", "variables"])?)?;
            Ok(json!({ "path": prompt_record_path(state, &record, "preset.json")?, "record": strip_prompt_children(record) }))
        }
        ["library", "prompts", prompt_dir, child_dir, filename] => {
            let prompt = prompt_ref(state, prompt_dir)?;
            let mount = prompt_child_mount(child_dir)?;
            let existing_id = resolve_record_id_from_file_name(state, mount, Some(("presetId", prompt.id.as_str())), filename).ok();
            let mut object = ensure_json_object(content)?;
            object.insert("presetId".to_string(), Value::String(prompt.id.clone()));
            let record = upsert_record(state, mount.collection, existing_id, Value::Object(object))?;
            Ok(json!({ "path": child_record_path(state, &prompt, mount, &record)?, "record": record }))
        }
        ["library", "lorebooks", lorebook_dir, "book.json"] => {
            let existing = lorebook_ref(state, lorebook_dir).ok();
            let id = existing.as_ref().map(|record| record.id.clone());
            let record = upsert_record(state, "lorebooks", id, merge_for_parent_file(state, "lorebooks", existing.as_ref().map(|record| record.id.as_str()), content, &["entries", "folders"])?)?;
            Ok(json!({ "path": lorebook_record_path(state, &record, "book.json")?, "record": strip_lorebook_children(record) }))
        }
        ["library", "lorebooks", lorebook_dir, "entries", filename] => {
            let lorebook = lorebook_ref(state, lorebook_dir)?;
            let existing_id = resolve_record_id_from_file_name(state, &LOREBOOK_ENTRY_MOUNT, Some(("lorebookId", lorebook.id.as_str())), filename).ok();
            let mut object = ensure_json_object(content)?;
            object.insert("lorebookId".to_string(), Value::String(lorebook.id.clone()));
            let record = upsert_record(state, "lorebook-entries", existing_id, Value::Object(object))?;
            Ok(json!({ "path": child_record_path(state, &lorebook, &LOREBOOK_ENTRY_MOUNT, &record)?, "record": record }))
        }
        ["library", dir, filename] => {
            let mount = root_mount(dir)?;
            if mount.collection == "prompts" || mount.collection == "lorebooks" {
                return Err(AppError::invalid_input(format!("Write {} records through their nested parent file", mount.label)));
            }
            let existing_id = resolve_record_id_from_file_name(state, mount, None, filename).ok();
            let record = upsert_record(state, mount.collection, existing_id, content)?;
            Ok(json!({ "path": flat_record_path(state, mount, &record)?, "record": record }))
        }
        _ => Err(AppError::invalid_input(format!("Path is not writable in Professor Mari workspace: {normalized}"))),
    }
}
fn read_content(state: &AppState, normalized: &str) -> AppResult<String> {
    let parts = parts(normalized);
    match parts.as_slice() {
        ["help.md"] => Ok(help_text()),
        ["library", "prompts", "index.json"] => prompt_index_content(state),
        ["library", "prompts", prompt_dir, "preset.json"] => {
            let prompt = read_prompt_record(state, prompt_dir)?;
            pretty(strip_prompt_children(prompt))
        }
        ["library", "prompts", prompt_dir, child_dir, "index.json"] => prompt_child_index_content(state, prompt_dir, child_dir),
        ["library", "prompts", prompt_dir, child_dir, filename] => read_prompt_child_record(state, prompt_dir, child_dir, filename),
        ["library", "lorebooks", "index.json"] => lorebook_index_content(state),
        ["library", "lorebooks", lorebook_dir, "book.json"] => {
            let lorebook = read_lorebook_record(state, lorebook_dir)?;
            pretty(strip_lorebook_children(lorebook))
        }
        ["library", "lorebooks", lorebook_dir, "entries", "index.json"] => lorebook_entries_index_content(state, lorebook_dir),
        ["library", "lorebooks", lorebook_dir, "entries", filename] => read_lorebook_entry_record(state, lorebook_dir, filename),
        ["library", dir, "index.json"] => {
            let mount = root_mount(dir)?;
            flat_index_content(state, mount)
        }
        ["library", dir, filename] => {
            let mount = root_mount(dir)?;
            let id = resolve_record_id_from_file_name(state, mount, None, filename)?;
            let row = state.storage.get(mount.collection, &id)?.ok_or_else(|| AppError::not_found(format!("No record at {normalized}")))?;
            pretty(row)
        }
        ["schema", filename] => schema_content(filename),
        _ => Err(AppError::not_found(format!("No such file in Professor Mari workspace: {normalized}"))),
    }
}

fn ls_flat_collection(state: &AppState, mount: &MariMount) -> AppResult<Value> {
    let records = record_refs(state, mount, None)?;
    let mut entries = vec![json!({
        "name": "index.json",
        "type": "file",
        "path": format!("/library/{}/index.json", mount.dir),
    })];
    entries.extend(records.into_iter().map(|record| {
        let name = record.path.rsplit('/').next().unwrap_or(record.path.as_str());
        json!({
            "name": name,
            "type": "file",
            "path": record.path,
            "entity": mount.collection,
            "ref": format!("{}-{:03}", mount.prefix, record.ordinal),
            "label": record.label,
        })
    }));
    Ok(json!({ "path": format!("/library/{}", mount.dir), "entries": entries }))
}

fn ls_parent_collection(state: &AppState, mount: &MariMount, as_dirs: bool) -> AppResult<Value> {
    let records = record_refs(state, mount, None)?;
    let mut entries = vec![json!({
        "name": "index.json",
        "type": "file",
        "path": format!("/library/{}/index.json", mount.dir),
    })];
    entries.extend(records.into_iter().map(|record| {
        let name = record.path.rsplit('/').next().unwrap_or(record.path.as_str());
        json!({
            "name": name,
            "type": if as_dirs { "directory" } else { "file" },
            "path": record.path,
            "entity": mount.collection,
            "ref": format!("{}-{:03}", mount.prefix, record.ordinal),
            "label": record.label,
        })
    }));
    Ok(json!({ "path": format!("/library/{}", mount.dir), "entries": entries }))
}

fn ls_prompt_dir(state: &AppState, prompt_dir: &str) -> AppResult<Value> {
    let prompt = prompt_ref(state, prompt_dir)?;
    Ok(json!({
        "path": prompt.path,
        "label": prompt.label,
        "entries": [
            { "name": "preset.json", "type": "file", "path": format!("{}/preset.json", prompt.path) },
            { "name": "sections", "type": "directory", "path": format!("{}/sections", prompt.path) },
            { "name": "groups", "type": "directory", "path": format!("{}/groups", prompt.path) },
            { "name": "variables", "type": "directory", "path": format!("{}/variables", prompt.path) }
        ]
    }))
}

fn ls_prompt_child_dir(state: &AppState, prompt_dir: &str, child_dir: &str) -> AppResult<Value> {
    let prompt = prompt_ref(state, prompt_dir)?;
    let mount = prompt_child_mount(child_dir)?;
    let records = record_refs(state, mount, Some(("presetId", prompt.id.as_str())))?;
    let base = format!("{}/{}", prompt.path, child_dir);
    let mut entries = vec![json!({ "name": "index.json", "type": "file", "path": format!("{base}/index.json") })];
    entries.extend(records.into_iter().map(|record| {
        let name = record.path.rsplit('/').next().unwrap_or(record.path.as_str());
        json!({
            "name": name,
            "type": "file",
            "path": format!("{base}/{name}"),
            "ref": format!("{}-{:03}", mount.prefix, record.ordinal),
            "label": record.label,
        })
    }));
    Ok(json!({ "path": base, "entries": entries }))
}

fn ls_lorebook_dir(state: &AppState, lorebook_dir: &str) -> AppResult<Value> {
    let lorebook = lorebook_ref(state, lorebook_dir)?;
    Ok(json!({
        "path": lorebook.path,
        "label": lorebook.label,
        "entries": [
            { "name": "book.json", "type": "file", "path": format!("{}/book.json", lorebook.path) },
            { "name": "entries", "type": "directory", "path": format!("{}/entries", lorebook.path) }
        ]
    }))
}

fn ls_lorebook_entries_dir(state: &AppState, lorebook_dir: &str) -> AppResult<Value> {
    let lorebook = lorebook_ref(state, lorebook_dir)?;
    let records = record_refs(state, &LOREBOOK_ENTRY_MOUNT, Some(("lorebookId", lorebook.id.as_str())))?;
    let base = format!("{}/entries", lorebook.path);
    let mut entries = vec![json!({ "name": "index.json", "type": "file", "path": format!("{base}/index.json") })];
    entries.extend(records.into_iter().map(|record| {
        let name = record.path.rsplit('/').next().unwrap_or(record.path.as_str());
        json!({
            "name": name,
            "type": "file",
            "path": format!("{base}/{name}"),
            "ref": format!("{}-{:03}", LOREBOOK_ENTRY_MOUNT.prefix, record.ordinal),
            "label": record.label,
        })
    }));
    Ok(json!({ "path": base, "entries": entries }))
}

fn flat_index_content(state: &AppState, mount: &MariMount) -> AppResult<String> {
    let items = record_refs(state, mount, None)?.into_iter().map(index_item).collect::<Vec<_>>();
    pretty(json!({
        "collection": mount.collection,
        "label": mount.label,
        "count": items.len(),
        "idPolicy": "Paths and refs are user-friendly aliases. Internal storage ids are hidden in listings.",
        "items": items,
    }))
}

fn prompt_index_content(state: &AppState) -> AppResult<String> {
    let mount = root_mount("prompts")?;
    let items = record_refs(state, mount, None)?.into_iter().map(|record| json!({
        "ref": format!("{}-{:03}", mount.prefix, record.ordinal),
        "label": record.label,
        "path": record.path,
        "presetPath": format!("{}/preset.json", record.path),
        "sectionsPath": format!("{}/sections", record.path),
        "groupsPath": format!("{}/groups", record.path),
        "variablesPath": format!("{}/variables", record.path),
    })).collect::<Vec<_>>();
    pretty(json!({
        "collection": "prompts",
        "label": "Prompt presets",
        "count": items.len(),
        "organization": "Prompt sections, groups, and variables are nested under each preset to avoid duplicating prompt internals at the library root.",
        "items": items,
    }))
}

fn lorebook_index_content(state: &AppState) -> AppResult<String> {
    let mount = root_mount("lorebooks")?;
    let items = record_refs(state, mount, None)?.into_iter().map(|record| json!({
        "ref": format!("{}-{:03}", mount.prefix, record.ordinal),
        "label": record.label,
        "path": record.path,
        "bookPath": format!("{}/book.json", record.path),
        "entriesPath": format!("{}/entries", record.path),
    })).collect::<Vec<_>>();
    pretty(json!({
        "collection": "lorebooks",
        "label": "Lorebooks",
        "count": items.len(),
        "organization": "Lorebook entries are nested under their owning lorebook to avoid duplicating child records at the library root.",
        "items": items,
    }))
}

fn prompt_child_index_content(state: &AppState, prompt_dir: &str, child_dir: &str) -> AppResult<String> {
    let prompt = prompt_ref(state, prompt_dir)?;
    let mount = prompt_child_mount(child_dir)?;
    let base = format!("{}/{}", prompt.path, child_dir);
    let items = record_refs(state, mount, Some(("presetId", prompt.id.as_str())))?.into_iter().map(|record| {
        let name = record.path.rsplit('/').next().unwrap_or(record.path.as_str());
        json!({
            "ref": format!("{}-{:03}", mount.prefix, record.ordinal),
            "label": record.label,
            "path": format!("{base}/{name}"),
        })
    }).collect::<Vec<_>>();
    pretty(json!({
        "collection": mount.collection,
        "parentPreset": prompt.label,
        "count": items.len(),
        "items": items,
    }))
}

fn lorebook_entries_index_content(state: &AppState, lorebook_dir: &str) -> AppResult<String> {
    let lorebook = lorebook_ref(state, lorebook_dir)?;
    let base = format!("{}/entries", lorebook.path);
    let items = record_refs(state, &LOREBOOK_ENTRY_MOUNT, Some(("lorebookId", lorebook.id.as_str())))?.into_iter().map(|record| {
        let name = record.path.rsplit('/').next().unwrap_or(record.path.as_str());
        json!({
            "ref": format!("{}-{:03}", LOREBOOK_ENTRY_MOUNT.prefix, record.ordinal),
            "label": record.label,
            "path": format!("{base}/{name}"),
        })
    }).collect::<Vec<_>>();
    pretty(json!({
        "collection": LOREBOOK_ENTRY_MOUNT.collection,
        "parentLorebook": lorebook.label,
        "count": items.len(),
        "items": items,
    }))
}

fn read_prompt_record(state: &AppState, prompt_dir: &str) -> AppResult<Value> {
    let prompt = prompt_ref(state, prompt_dir)?;
    state.storage.get("prompts", &prompt.id)?.ok_or_else(|| AppError::not_found(format!("No prompt preset at {}", prompt.path)))
}

fn read_lorebook_record(state: &AppState, lorebook_dir: &str) -> AppResult<Value> {
    let lorebook = lorebook_ref(state, lorebook_dir)?;
    state.storage.get("lorebooks", &lorebook.id)?.ok_or_else(|| AppError::not_found(format!("No lorebook at {}", lorebook.path)))
}

fn read_prompt_child_record(state: &AppState, prompt_dir: &str, child_dir: &str, filename: &str) -> AppResult<String> {
    let prompt = prompt_ref(state, prompt_dir)?;
    let mount = prompt_child_mount(child_dir)?;
    let id = resolve_record_id_from_file_name(state, mount, Some(("presetId", prompt.id.as_str())), filename)?;
    let row = state.storage.get(mount.collection, &id)?.ok_or_else(|| AppError::not_found(format!("No prompt child record for {filename}")))?;
    if row.get("presetId").and_then(Value::as_str) != Some(prompt.id.as_str()) {
        return Err(AppError::not_found(format!("No {child_dir} record named {filename} under {}", prompt.label)));
    }
    pretty(row)
}

fn read_lorebook_entry_record(state: &AppState, lorebook_dir: &str, filename: &str) -> AppResult<String> {
    let lorebook = lorebook_ref(state, lorebook_dir)?;
    let id = resolve_record_id_from_file_name(state, &LOREBOOK_ENTRY_MOUNT, Some(("lorebookId", lorebook.id.as_str())), filename)?;
    let row = state.storage.get("lorebook-entries", &id)?.ok_or_else(|| AppError::not_found(format!("No lorebook entry record for {filename}")))?;
    if row.get("lorebookId").and_then(Value::as_str) != Some(lorebook.id.as_str()) {
        return Err(AppError::not_found(format!("No entry named {filename} under {}", lorebook.label)));
    }
    pretty(row)
}

fn record_refs(state: &AppState, mount: &MariMount, filter: Option<(&str, &str)>) -> AppResult<Vec<MariRecordRef>> {
    let mut rows = filtered_rows(state, mount.collection, filter)?;
    rows.sort_by(|a, b| {
        let a_display = record_label(a, mount).unwrap_or_else(|| row_id(a).unwrap_or_default()).to_ascii_lowercase();
        let b_display = record_label(b, mount).unwrap_or_else(|| row_id(b).unwrap_or_default()).to_ascii_lowercase();
        a_display.cmp(&b_display).then_with(|| row_id(a).cmp(&row_id(b)))
    });
    Ok(rows.iter().enumerate().map(|(index, row)| {
        let ordinal = index + 1;
        let id = row_id(row).unwrap_or_else(|| format!("missing-id-{ordinal}"));
        let label = record_label(row, mount).unwrap_or_else(|| format!("{} {}", singular_label(mount.label), ordinal));
        let path = format!("/library/{}/{}", mount.dir, alias_name(mount, ordinal, &label, false));
        MariRecordRef { ordinal, id, label, path }
    }).collect())
}

fn filtered_rows(state: &AppState, collection: &str, filter: Option<(&str, &str)>) -> AppResult<Vec<Value>> {
    let rows = state.storage.list(collection)?;
    Ok(match filter {
        Some((key, expected)) => rows.into_iter().filter(|row| row.get(key).and_then(Value::as_str) == Some(expected)).collect(),
        None => rows,
    })
}

fn prompt_ref(state: &AppState, prompt_dir: &str) -> AppResult<MariRecordRef> {
    resolve_parent_ref(state, root_mount("prompts")?, prompt_dir)
}

fn lorebook_ref(state: &AppState, lorebook_dir: &str) -> AppResult<MariRecordRef> {
    resolve_parent_ref(state, root_mount("lorebooks")?, lorebook_dir)
}

fn resolve_parent_ref(state: &AppState, mount: &MariMount, dir_name: &str) -> AppResult<MariRecordRef> {
    let records = record_refs(state, mount, None)?;
    if let Some(ordinal) = alias_ordinal(dir_name, mount.prefix) {
        return records.into_iter().find(|record| record.ordinal == ordinal).ok_or_else(|| AppError::not_found(format!("No {} record for alias {}-{:03}", mount.label, mount.prefix, ordinal)));
    }
    records.into_iter().find(|record| record.id == dir_name).ok_or_else(|| AppError::not_found(format!("No {} record named {dir_name}", mount.label)))
}

fn resolve_record_id_from_file_name(state: &AppState, mount: &MariMount, filter: Option<(&str, &str)>, filename: &str) -> AppResult<String> {
    let without_ext = filename.strip_suffix(".json").unwrap_or(filename);
    if let Some(ordinal) = alias_ordinal(without_ext, mount.prefix) {
        return record_refs(state, mount, filter)?.into_iter().find(|record| record.ordinal == ordinal).map(|record| record.id).ok_or_else(|| AppError::not_found(format!("No {} record for alias {}-{:03}", mount.label, mount.prefix, ordinal)));
    }
    let id = without_ext.rsplit_once("__").map(|(_, id)| id).unwrap_or(without_ext).trim();
    if id.is_empty() {
        return Err(AppError::invalid_input("read path is missing a record alias"));
    }
    Ok(id.to_string())
}

fn upsert_record(state: &AppState, collection: &str, id: Option<String>, content: Value) -> AppResult<Value> {
    let mut object = ensure_json_object(content)?;
    if let Some(id) = id.filter(|id| !id.trim().is_empty()) {
        object.insert("id".to_string(), Value::String(id.clone()));
        state.storage.upsert_with_id(collection, &id, Value::Object(object))
    } else {
        state.storage.create(collection, Value::Object(object))
    }
}

fn merge_for_parent_file(state: &AppState, collection: &str, id: Option<&str>, content: Value, preserve_keys: &[&str]) -> AppResult<Value> {
    let mut next = ensure_json_object(content)?;
    if let Some(id) = id {
        if let Some(existing) = state.storage.get(collection, id)? {
            if let Some(existing_object) = existing.as_object() {
                for key in preserve_keys {
                    if let Some(value) = existing_object.get(*key) {
                        next.insert((*key).to_string(), value.clone());
                    }
                }
            }
        }
    }
    Ok(Value::Object(next))
}

fn ensure_json_object(value: Value) -> AppResult<Map<String, Value>> {
    match value {
        Value::Object(object) => Ok(object),
        _ => Err(AppError::invalid_input("write content must be a JSON object")),
    }
}

fn flat_record_path(state: &AppState, mount: &MariMount, row: &Value) -> AppResult<String> {
    let id = row_id(row).ok_or_else(|| AppError::invalid_input("written record is missing an id"))?;
    record_refs(state, mount, None)?.into_iter().find(|record| record.id == id).map(|record| record.path).ok_or_else(|| AppError::not_found("written record path could not be resolved"))
}

fn prompt_record_path(state: &AppState, row: &Value, file_name: &str) -> AppResult<String> {
    let prompt_mount = root_mount("prompts")?;
    Ok(format!("{}/{}", flat_record_path(state, prompt_mount, row)?, file_name))
}

fn lorebook_record_path(state: &AppState, row: &Value, file_name: &str) -> AppResult<String> {
    let lorebook_mount = root_mount("lorebooks")?;
    Ok(format!("{}/{}", flat_record_path(state, lorebook_mount, row)?, file_name))
}

fn child_record_path(state: &AppState, parent: &MariRecordRef, mount: &MariMount, row: &Value) -> AppResult<String> {
    let id = row_id(row).ok_or_else(|| AppError::invalid_input("written child record is missing an id"))?;
    let parent_key = if mount.collection == "lorebook-entries" { "lorebookId" } else { "presetId" };
    let base = format!("{}/{}", parent.path, mount.dir);
    record_refs(state, mount, Some((parent_key, parent.id.as_str())))?
        .into_iter()
        .find(|record| record.id == id)
        .and_then(|record| record.path.rsplit('/').next().map(|name| format!("{base}/{name}")))
        .ok_or_else(|| AppError::not_found("written child record path could not be resolved"))
}

fn index_item(record: MariRecordRef) -> Value {
    let prefix = record.path.rsplit('/').next().and_then(|name| name.split('-').next()).unwrap_or("record");
    json!({
        "ref": format!("{}-{:03}", prefix, record.ordinal),
        "label": record.label,
        "path": record.path,
    })
}

fn strip_prompt_children(value: Value) -> Value {
    strip_keys(value, &["sectionOrder", "groupOrder", "variableGroups", "variableValues", "sections", "groups", "variables"])
}

fn strip_lorebook_children(value: Value) -> Value {
    strip_keys(value, &["entries", "folders"])
}

fn strip_keys(value: Value, keys: &[&str]) -> Value {
    match value {
        Value::Object(mut object) => {
            for key in keys {
                object.remove(*key);
            }
            Value::Object(object)
        }
        other => other,
    }
}

fn schema_entries() -> Vec<Value> {
    vec![
        json!({ "name": "characters.json", "path": "/schema/characters.json", "type": "file" }),
        json!({ "name": "character-groups.json", "path": "/schema/character-groups.json", "type": "file" }),
        json!({ "name": "personas.json", "path": "/schema/personas.json", "type": "file" }),
        json!({ "name": "persona-groups.json", "path": "/schema/persona-groups.json", "type": "file" }),
        json!({ "name": "lorebooks.json", "path": "/schema/lorebooks.json", "type": "file" }),
        json!({ "name": "lorebook-entries.json", "path": "/schema/lorebook-entries.json", "type": "file" }),
        json!({ "name": "prompts.json", "path": "/schema/prompts.json", "type": "file" }),
        json!({ "name": "prompt-sections.json", "path": "/schema/prompt-sections.json", "type": "file" }),
        json!({ "name": "prompt-groups.json", "path": "/schema/prompt-groups.json", "type": "file" }),
        json!({ "name": "prompt-variables.json", "path": "/schema/prompt-variables.json", "type": "file" }),
    ]
}

fn schema_content(filename: &str) -> AppResult<String> {
    let stem = filename.strip_suffix(".json").ok_or_else(|| AppError::not_found(format!("No schema file: /schema/{filename}")))?;
    let notes = match stem {
        "prompts" => "Prompt presets are directories. Read preset.json for preset metadata; sections, groups, and variables are nested child directories and are not duplicated in preset.json.",
        "lorebooks" => "Lorebooks are directories. Read book.json for book metadata; entries are nested under entries/ and are not duplicated in book.json.",
        "prompt-sections" | "prompt-groups" | "prompt-variables" => "Prompt internals are only listed under their owning preset at /library/prompts/<prompt>/.",
        "lorebook-entries" => "Lorebook entries are only listed under their owning lorebook at /library/lorebooks/<lorebook>/entries/.",
        _ => "Records are exposed through user-friendly alias paths. This workspace is read-only.",
    };
    pretty(json!({ "schema": stem, "notes": notes }))
}

fn normalize_path(path: &str) -> AppResult<String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Ok("/".to_string());
    }
    if trimmed.contains('\\') || trimmed.contains(':') || trimmed.split('/').any(|part| part == "..") {
        return Err(AppError::invalid_input("Professor Mari paths must stay inside the virtual workspace"));
    }
    let normalized = format!("/{}", trimmed.trim_matches('/'));
    Ok(if normalized == "/" { "/".to_string() } else { normalized })
}

fn parts(path: &str) -> Vec<&str> {
    path.trim_matches('/').split('/').filter(|part| !part.is_empty()).collect()
}

fn root_mount(dir: &str) -> AppResult<&'static MariMount> {
    ROOT_MOUNTS.iter().find(|mount| mount.dir == dir).ok_or_else(|| AppError::not_found(format!("No such Professor Mari library directory: {dir}")))
}

fn prompt_child_mount(dir: &str) -> AppResult<&'static MariMount> {
    PROMPT_CHILD_MOUNTS.iter().find(|mount| mount.dir == dir).ok_or_else(|| AppError::not_found(format!("No such prompt child directory: {dir}")))
}

fn row_id(row: &Value) -> Option<String> {
    row.get("id").and_then(Value::as_str).filter(|id| !id.trim().is_empty()).map(str::to_string)
}

fn record_label(row: &Value, mount: &MariMount) -> Option<String> {
    let candidates: &[&[&str]] = match mount.collection {
        "characters" => &[&["data", "name"]],
        "personas" | "persona-groups" | "character-groups" | "lorebooks" | "lorebook-entries" | "prompts" | "prompt-sections" | "prompt-groups" => &[&["name"]],
        "prompt-variables" => &[&["label"], &["name"], &["variableName"]],
        _ => &[&["name"]],
    };
    candidates.iter().find_map(|path| nested_string_value(row, path)).map(|value| value.trim().to_string()).filter(|value| !value.is_empty()).filter(|value| !looks_like_internal_id(value)).map(|value| value.to_string())
}

fn nested_string_value(value: &Value, path: &[&str]) -> Option<String> {
    if path.is_empty() {
        return value.as_str().map(str::to_string);
    }
    let mut current = value;
    for (index, key) in path.iter().enumerate() {
        current = current.get(*key)?;
        if let Value::String(text) = current {
            if index + 1 == path.len() {
                return Some(text.clone());
            }
            let parsed = serde_json::from_str::<Value>(text).ok()?;
            return nested_string_value(&parsed, &path[index + 1..]);
        }
    }
    current.as_str().map(str::to_string)
}

fn alias_name(mount: &MariMount, ordinal: usize, label: &str, extension: bool) -> String {
    let base = format!("{}-{:03}-{}", mount.prefix, ordinal, slug(label));
    if extension { format!("{base}.json") } else { base }
}

fn alias_ordinal(value: &str, prefix: &str) -> Option<usize> {
    let rest = value.strip_prefix(prefix)?.strip_prefix('-')?;
    let digits = rest.chars().take_while(|ch| ch.is_ascii_digit()).collect::<String>();
    if digits.is_empty() { None } else { digits.parse::<usize>().ok().filter(|ordinal| *ordinal > 0) }
}

fn slug(value: &str) -> String {
    let slug = value.chars().map(|ch| if ch.is_ascii_alphanumeric() { ch.to_ascii_lowercase() } else { '-' }).collect::<String>().split('-').filter(|part| !part.is_empty()).collect::<Vec<_>>().join("-");
    if slug.is_empty() { "record".to_string() } else { slug.chars().take(48).collect() }
}

fn looks_like_internal_id(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.len() >= 20 && trimmed.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_') {
        let has_digit = trimmed.chars().any(|ch| ch.is_ascii_digit());
        let has_alpha = trimmed.chars().any(|ch| ch.is_ascii_alphabetic());
        return has_digit && has_alpha && !trimmed.contains(' ');
    }
    false
}

fn singular_label(label: &str) -> String {
    match label {
        "Characters" => "Character".to_string(),
        "Personas" => "Persona".to_string(),
        "Lorebooks" => "Lorebook".to_string(),
        "Lorebook entries" => "Lorebook entry".to_string(),
        "Prompt presets" => "Prompt preset".to_string(),
        "Prompt sections" => "Prompt section".to_string(),
        "Prompt groups" => "Prompt group".to_string(),
        "Prompt variables" => "Prompt variable".to_string(),
        "Character groups" => "Character group".to_string(),
        "Persona groups" => "Persona group".to_string(),
        other => other.trim_end_matches('s').to_string(),
    }
}

fn pretty(value: Value) -> AppResult<String> {
    serde_json::to_string_pretty(&value).map_err(|error| AppError::new("mari_fs_serialize_failed", error.to_string()))
}

fn help_text() -> String {
    "# Professor Mari virtual workspace\n\nThis is a read-only virtual filesystem backed by Marinara's creative library.\n\nAvailable commands:\n- ls({ path }) lists directories.\n- read({ path, offset?, limit? }) reads JSON or markdown files.\n\nTop-level library folders are characters, character-groups, personas, persona-groups, lorebooks, and prompts. Prompt sections/groups/variables live under their owning prompt preset. Lorebook entries live under their owning lorebook. Parent files such as preset.json and book.json intentionally omit child records to avoid duplication.\n".to_string()
}
