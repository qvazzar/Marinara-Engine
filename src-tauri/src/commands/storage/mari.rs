use super::llm::{llm_connection_from_value, resolve_llm_connection_for_request};
use super::mari_fs;
use crate::state::AppState;
use marinara_core::{AppError, AppResult};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MariPromptRequest {
    user_message: String,
    #[serde(default)]
    messages: Vec<MariPromptMessage>,
    #[serde(default)]
    connection_id: Option<String>,
    #[serde(default)]
    persona: Option<MariPersonaContext>,
    #[serde(default)]
    attachments: Vec<MariAttachment>,
}

#[derive(Debug, Deserialize)]
struct MariPromptMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MariPersonaContext {
    name: Option<String>,
    comment: Option<String>,
    description: Option<String>,
    personality: Option<String>,
    scenario: Option<String>,
    backstory: Option<String>,
    appearance: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MariAttachment {
    name: String,
    #[serde(default)]
    r#type: String,
    #[serde(default)]
    size: u64,
    content: String,
}

pub(crate) async fn professor_mari_prompt(state: &AppState, body: Value) -> AppResult<Value> {
    let input: MariPromptRequest = serde_json::from_value(body)
        .map_err(|error| AppError::invalid_input(error.to_string()))?;
    let connection_value = resolve_llm_connection_for_request(
        state,
        &json!({
            "connectionId": input.connection_id,
        }),
    )?;
    let connection = llm_connection_from_value(&connection_value)?;
    ensure_connection_supports_native_tools(&connection)?;

    let mut messages = vec![marinara_llm::LlmMessage {
        role: "system".to_string(),
        content: build_system_prompt(input.persona.as_ref()),
        name: None,
        images: Vec::new(),
        tool_call_id: None,
        tool_calls: None,
    }];
    messages.push(marinara_llm::LlmMessage {
        role: "user".to_string(),
        content: build_task_prompt(&input),
        name: None,
        images: Vec::new(),
        tool_call_id: None,
        tool_calls: None,
    });

    let content = run_mari_tool_loop(state, connection, messages).await?;
    Ok(json!({
        "content": content,
        "createdAt": chrono::Utc::now().to_rfc3339(),
        "action": read_only_mari_action_contract(),
    }))
}

async fn run_mari_tool_loop(
    state: &AppState,
    connection: marinara_llm::LlmConnection,
    mut messages: Vec<marinara_llm::LlmMessage>,
) -> AppResult<String> {
    const MAX_TOOL_ROUNDS: usize = 6;
    let tools = mari_tool_definitions();
    let mut last_content = String::new();

    for _ in 0..MAX_TOOL_ROUNDS {
        let response = marinara_llm::complete_rich(marinara_llm::LlmRequest {
            connection: connection.clone(),
            messages: messages.clone(),
            parameters: json!({
                "temperature": 0.35,
                "maxTokens": 2048,
            }),
            tools: tools.clone(),
        })
        .await
        .map_err(|error| {
            let debug_error = format_app_error_for_debug(&error);
            log::error!("Professor Mari LLM request failed: {debug_error}");
            AppError::new("mari_agent_failed", tool_call_error_message(&debug_error))
        })?;

        last_content = response.content.trim().to_string();
        if response.tool_calls.is_empty() {
            return Ok(if last_content.is_empty() {
                "I couldn't produce a response from the selected model.".to_string()
            } else {
                last_content
            });
        }

        messages.push(marinara_llm::LlmMessage {
            role: "assistant".to_string(),
            content: response.content,
            name: None,
            images: Vec::new(),
            tool_call_id: None,
            tool_calls: Some(Value::Array(
                response
                    .tool_calls
                    .iter()
                    .map(normalize_tool_call_for_chat_history)
                    .collect(),
            )),
        });

        for call in response.tool_calls {
            let result = execute_mari_tool_call(state, &call);
            messages.push(marinara_llm::LlmMessage {
                role: "tool".to_string(),
                content: result.to_string(),
                name: None,
                images: Vec::new(),
                tool_call_id: tool_call_id(&call),
                tool_calls: None,
            });
        }
    }

    let response = marinara_llm::complete_rich(marinara_llm::LlmRequest {
        connection,
        messages,
        parameters: json!({
            "temperature": 0.35,
            "maxTokens": 2048,
        }),
        tools: Vec::new(),
    })
    .await
    .map_err(|error| AppError::new("mari_agent_failed", format_app_error_for_debug(&error)))?;

    let final_content = response.content.trim();
    if final_content.is_empty() {
        Ok(last_content)
    } else {
        Ok(final_content.to_string())
    }
}

fn execute_mari_tool_call(state: &AppState, call: &Value) -> Value {
    let name = tool_call_name(call);
    let args = tool_call_arguments(call);
    let result = match name.as_str() {
        "bash" => {
            let command = args.get("command").and_then(Value::as_str).unwrap_or("");
            Ok(run_virtual_bash(state, command))
        }
        "ls" => {
            let path = args.get("path").and_then(Value::as_str).unwrap_or("/");
            mari_fs::ls(state, path)
        }
        "read" => {
            let path = args.get("path").and_then(Value::as_str).unwrap_or("/");
            let offset = args.get("offset").and_then(Value::as_u64).map(|value| value as usize);
            let limit = args.get("limit").and_then(Value::as_u64).map(|value| value as usize);
            mari_fs::read(state, path, offset, limit)
        }
        "edit" => {
            let path = args.get("path").and_then(Value::as_str).unwrap_or("/");
            let edits = args
                .get("edits")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| {
                            Some((
                                item.get("oldText")?.as_str()?.to_string(),
                                item.get("newText")?.as_str()?.to_string(),
                            ))
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            mari_fs::edit(state, path, &edits)
        }
        "write" => {
            let path = args.get("path").and_then(Value::as_str).unwrap_or("/");
            let content = args.get("content").and_then(Value::as_str).unwrap_or("");
            mari_fs::write(state, path, content)
        }
        _ => Err(AppError::invalid_input(format!("Unknown Professor Mari tool: {name}"))),
    };

    match result {
        Ok(value) => json!({ "ok": true, "result": value }),
        Err(error) => json!({ "ok": false, "error": error.to_string() }),
    }
}

fn mari_tool_definitions() -> Vec<Value> {
    vec![
        json!({
            "name": "bash",
            "description": "Run a safe virtual shell command in Professor Mari's Marinara workspace. This is not the host shell. Supports ls, cat/read, head, tail, grep, find, write, rm, cp, and mv with simple pipes over virtual workspace text only.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "Safe virtual shell command, e.g. ls /library, cat /library/characters/index.json, find /library -name '*makima*', grep -R Makima /library, write /library/personas/new.json {\"name\":\"New\"}." }
                },
                "required": ["command"]
            }
        }),
        json!({
            "name": "edit",
            "description": "Edit a file in Professor Mari's virtual Marinara workspace using exact text replacements. Each oldText must match exactly once in the file content returned by read.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Virtual file path to edit. Use read first, then copy exact oldText from the returned content." },
                    "edits": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "oldText": { "type": "string", "description": "Exact text to replace. Must match once." },
                                "newText": { "type": "string", "description": "Replacement text." }
                            },
                            "required": ["oldText", "newText"]
                        }
                    }
                },
                "required": ["path", "edits"]
            }
        }),
        json!({
            "name": "write",
            "description": "Write a complete JSON file in Professor Mari's virtual Marinara workspace. Existing paths update storage records; new valid library paths create records and auto-assign them to the parent folder/preset/lorebook when applicable.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Virtual file path to write." },
                    "content": { "type": "string", "description": "Complete JSON content to write." }
                },
                "required": ["path", "content"]
            }
        }),
    ]
}

fn run_virtual_bash(state: &AppState, command: &str) -> Value {
    match run_virtual_bash_result(state, command) {
        Ok(stdout) => json!({ "stdout": stdout, "stderr": "", "exitCode": 0 }),
        Err(error) => json!({ "stdout": "", "stderr": error.to_string(), "exitCode": 1 }),
    }
}

fn run_virtual_bash_result(state: &AppState, command: &str) -> AppResult<String> {
    reject_unsafe_shell(command)?;
    let mut input: Option<String> = None;
    for segment in split_pipes(command)? {
        input = Some(run_virtual_bash_segment(state, segment.trim(), input)?);
    }
    Ok(input.unwrap_or_default())
}

fn run_virtual_bash_segment(state: &AppState, segment: &str, input: Option<String>) -> AppResult<String> {
    let tokens = shell_words(segment)?;
    let Some(cmd) = tokens.first().map(String::as_str) else {
        return Ok(input.unwrap_or_default());
    };
    match cmd {
        "ls" => {
            let path = tokens.get(1).map(String::as_str).unwrap_or("/");
            let value = mari_fs::ls(state, path)?;
            Ok(format_ls_output(&value))
        }
        "cat" | "read" => {
            let path = tokens.get(1).map(String::as_str).ok_or_else(|| AppError::invalid_input("cat requires a path"))?;
            read_file_text(state, path)
        }
        "head" => {
            let (n, path) = parse_n_and_path(&tokens, 10);
            let text = match path { Some(path) => read_file_text(state, path)?, None => input.unwrap_or_default() };
            Ok(text.lines().take(n).collect::<Vec<_>>().join("\n"))
        }
        "tail" => {
            let (n, path) = parse_n_and_path(&tokens, 10);
            let text = match path { Some(path) => read_file_text(state, path)?, None => input.unwrap_or_default() };
            let lines = text.lines().collect::<Vec<_>>();
            let start = lines.len().saturating_sub(n);
            Ok(lines[start..].join("\n"))
        }
        "grep" => run_grep(state, &tokens, input),
        "find" => run_find(state, &tokens),
        "rm" => {
            let path = tokens.get(1).map(String::as_str).ok_or_else(|| AppError::invalid_input("rm requires a path"))?;
            let value = mari_fs::rm(state, path)?;
            serde_json::to_string_pretty(&value).map_err(|error| AppError::new("mari_bash_serialize_failed", error.to_string()))
        }
        "cp" => {
            let from = tokens.get(1).map(String::as_str).ok_or_else(|| AppError::invalid_input("cp requires a source path"))?;
            let to = tokens.get(2).map(String::as_str).ok_or_else(|| AppError::invalid_input("cp requires a destination path"))?;
            let content = read_file_text(state, from)?;
            let value = mari_fs::write(state, to, &content)?;
            serde_json::to_string_pretty(&value).map_err(|error| AppError::new("mari_bash_serialize_failed", error.to_string()))
        }
        "mv" => {
            let from = tokens.get(1).map(String::as_str).ok_or_else(|| AppError::invalid_input("mv requires a source path"))?;
            let to = tokens.get(2).map(String::as_str).ok_or_else(|| AppError::invalid_input("mv requires a destination path"))?;
            let content = read_file_text(state, from)?;
            let written = mari_fs::write(state, to, &content)?;
            let removed = mari_fs::rm(state, from)?;
            serde_json::to_string_pretty(&json!({ "written": written, "removed": removed })).map_err(|error| AppError::new("mari_bash_serialize_failed", error.to_string()))
        }
        "write" => run_write_command(state, segment),
        other => Err(AppError::invalid_input(format!("Unsupported virtual bash command: {other}"))),
    }
}

fn read_file_text(state: &AppState, path: &str) -> AppResult<String> {
    let value = mari_fs::read(state, path, Some(1), Some(240))?;
    Ok(value.get("content").and_then(Value::as_str).unwrap_or("").to_string())
}

fn run_write_command(state: &AppState, segment: &str) -> AppResult<String> {
    let rest = segment.trim_start_matches("write").trim();
    let mut split = rest.splitn(2, char::is_whitespace);
    let path = split.next().filter(|value| !value.trim().is_empty()).ok_or_else(|| AppError::invalid_input("write requires a path"))?;
    let content = split.next().unwrap_or("").trim();
    if content.is_empty() {
        return Err(AppError::invalid_input("write requires JSON content after the path"));
    }
    let value = mari_fs::write(state, path, content)?;
    serde_json::to_string_pretty(&value).map_err(|error| AppError::new("mari_bash_serialize_failed", error.to_string()))
}

fn run_grep(state: &AppState, tokens: &[String], input: Option<String>) -> AppResult<String> {
    let mut case_sensitive = true;
    let mut recursive = false;
    let mut args = Vec::new();
    for token in tokens.iter().skip(1) {
        match token.as_str() {
            "-i" => case_sensitive = false,
            "-R" | "-r" => recursive = true,
            other => args.push(other.to_string()),
        }
    }
    let pattern = args.first().ok_or_else(|| AppError::invalid_input("grep requires a pattern"))?;
    let needle = if case_sensitive { pattern.clone() } else { pattern.to_ascii_lowercase() };
    if let Some(text) = input {
        return Ok(text.lines().filter(|line| {
            let haystack = if case_sensitive { (*line).to_string() } else { line.to_ascii_lowercase() };
            haystack.contains(&needle)
        }).collect::<Vec<_>>().join("\n"));
    }
    let path = args.get(1).map(String::as_str).unwrap_or("/");
    let files = if recursive { collect_paths(state, path, true, None, None)? } else { vec![path.to_string()] };
    let mut out = Vec::new();
    for file in files {
        let Ok(text) = read_file_text(state, &file) else { continue; };
        for (index, line) in text.lines().enumerate() {
            let haystack = if case_sensitive { line.to_string() } else { line.to_ascii_lowercase() };
            if haystack.contains(&needle) {
                out.push(format!("{file}:{}:{line}", index + 1));
            }
        }
    }
    Ok(out.join("\n"))
}

fn run_find(state: &AppState, tokens: &[String]) -> AppResult<String> {
    let root = tokens.get(1).map(String::as_str).unwrap_or("/");
    let mut name_pattern: Option<String> = None;
    let mut entry_type: Option<String> = None;
    let mut max_depth: Option<usize> = None;
    let mut index = 2;
    while index < tokens.len() {
        match tokens[index].as_str() {
            "-name" => { name_pattern = tokens.get(index + 1).cloned(); index += 2; }
            "-type" => { entry_type = tokens.get(index + 1).cloned(); index += 2; }
            "-maxdepth" => { max_depth = tokens.get(index + 1).and_then(|v| v.parse().ok()); index += 2; }
            _ => index += 1,
        }
    }
    Ok(collect_paths(state, root, entry_type.as_deref() != Some("d"), name_pattern.as_deref(), max_depth)?.join("\n"))
}

fn collect_paths(state: &AppState, root: &str, files: bool, pattern: Option<&str>, max_depth: Option<usize>) -> AppResult<Vec<String>> {
    fn walk(state: &AppState, path: &str, depth: usize, files: bool, pattern: Option<&str>, max_depth: Option<usize>, out: &mut Vec<String>) -> AppResult<()> {
        if max_depth.is_some_and(|max| depth > max) { return Ok(()); }
        let listing = mari_fs::ls(state, path)?;
        for entry in listing.get("entries").and_then(Value::as_array).into_iter().flatten() {
            let entry_path = entry.get("path").and_then(Value::as_str).unwrap_or("");
            let entry_name = entry.get("name").and_then(Value::as_str).unwrap_or("");
            let entry_type = entry.get("type").and_then(Value::as_str).unwrap_or("file");
            let matches = pattern.map(|pat| wildcard_match(pat, entry_name) || wildcard_match(pat, entry_path)).unwrap_or(true);
            if ((files && entry_type == "file") || (!files && entry_type == "directory")) && matches {
                out.push(entry_path.to_string());
            }
            if entry_type == "directory" {
                let _ = walk(state, entry_path, depth + 1, files, pattern, max_depth, out);
            }
        }
        Ok(())
    }
    let mut out = Vec::new();
    walk(state, root, 0, files, pattern, max_depth, &mut out)?;
    Ok(out)
}

fn parse_n_and_path(tokens: &[String], default_n: usize) -> (usize, Option<&str>) {
    if tokens.get(1).map(String::as_str) == Some("-n") {
        (tokens.get(2).and_then(|v| v.parse().ok()).unwrap_or(default_n), tokens.get(3).map(String::as_str))
    } else {
        (default_n, tokens.get(1).map(String::as_str))
    }
}

fn format_ls_output(value: &Value) -> String {
    value.get("entries").and_then(Value::as_array).map(|entries| {
        entries.iter().filter_map(|entry| entry.get("path").and_then(Value::as_str)).collect::<Vec<_>>().join("\n")
    }).unwrap_or_else(|| value.to_string())
}

fn split_pipes(command: &str) -> AppResult<Vec<&str>> {
    let mut parts = Vec::new();
    let mut start = 0;
    let mut quote: Option<char> = None;
    for (index, ch) in command.char_indices() {
        match ch {
            '\'' | '"' if quote == Some(ch) => quote = None,
            '\'' | '"' if quote.is_none() => quote = Some(ch),
            '|' if quote.is_none() => { parts.push(command[start..index].trim()); start = index + 1; }
            _ => {}
        }
    }
    if quote.is_some() { return Err(AppError::invalid_input("Unclosed quote in virtual bash command")); }
    parts.push(command[start..].trim());
    Ok(parts.into_iter().filter(|part| !part.is_empty()).collect())
}

fn shell_words(segment: &str) -> AppResult<Vec<String>> {
    let mut words = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    for ch in segment.chars() {
        match ch {
            '\'' | '"' if quote == Some(ch) => quote = None,
            '\'' | '"' if quote.is_none() => quote = Some(ch),
            ch if ch.is_whitespace() && quote.is_none() => {
                if !current.is_empty() { words.push(std::mem::take(&mut current)); }
            }
            _ => current.push(ch),
        }
    }
    if quote.is_some() { return Err(AppError::invalid_input("Unclosed quote in virtual bash command")); }
    if !current.is_empty() { words.push(current); }
    Ok(words)
}

fn reject_unsafe_shell(command: &str) -> AppResult<()> {
    let blocked = [";", "&&", "||", "`", "$(", ">", "<", " sudo ", " curl ", " wget ", " powershell", " cmd", " python", " node", " chmod", " chown"];
    let padded = format!(" {} ", command.to_ascii_lowercase());
    if let Some(token) = blocked.iter().find(|token| padded.contains(**token)) {
        return Err(AppError::invalid_input(format!("Unsupported or unsafe virtual bash syntax: {token}")));
    }
    Ok(())
}

fn wildcard_match(pattern: &str, value: &str) -> bool {
    let pattern = pattern.to_ascii_lowercase();
    let value = value.to_ascii_lowercase();
    if pattern == "*" { return true; }
    let parts = pattern.split('*').collect::<Vec<_>>();
    if parts.len() == 1 { return value.contains(&pattern); }
    let mut remainder = value.as_str();
    for (index, part) in parts.iter().filter(|part| !part.is_empty()).enumerate() {
        if let Some(pos) = remainder.find(part) {
            if index == 0 && !pattern.starts_with('*') && pos != 0 { return false; }
            remainder = &remainder[pos + part.len()..];
        } else { return false; }
    }
    pattern.ends_with('*') || parts.last().is_some_and(|last| remainder.is_empty() || last.is_empty())
}

fn normalize_tool_call_for_chat_history(call: &Value) -> Value {
    let name = tool_call_name(call);
    let arguments = call
        .get("function")
        .and_then(|function| function.get("arguments"))
        .or_else(|| call.get("arguments"))
        .and_then(Value::as_str)
        .unwrap_or("{}")
        .to_string();
    json!({
        "id": tool_call_id(call).unwrap_or_else(|| "mari_tool_call".to_string()),
        "type": "function",
        "function": {
            "name": name,
            "arguments": arguments,
        }
    })
}

fn tool_call_name(call: &Value) -> String {
    call.get("function")
        .and_then(|function| function.get("name"))
        .or_else(|| call.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn tool_call_arguments(call: &Value) -> Value {
    let raw = call
        .get("function")
        .and_then(|function| function.get("arguments"))
        .or_else(|| call.get("arguments"));
    match raw {
        Some(Value::String(text)) => serde_json::from_str(text).unwrap_or_else(|_| json!({})),
        Some(Value::Object(_)) => raw.cloned().unwrap_or_else(|| json!({})),
        _ => json!({}),
    }
}

fn tool_call_id(call: &Value) -> Option<String> {
    call.get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
        .or_else(|| call.get("call_id").and_then(Value::as_str))
        .map(str::to_string)
}

fn read_only_mari_action_contract() -> Value {
    json!({
        "type": "none",
        "capability": "read_only",
        "reason": "Professor Mari v1 can inspect the creative library but cannot create or edit records.",
    })
}

fn build_system_prompt(persona: Option<&MariPersonaContext>) -> String {
    let mut parts = vec![
        "You are Professor Mari, a standalone assistant inside Marinara Engine.".to_string(),
        "You have a virtual workspace with two tools: bash and edit.".to_string(),
        "Use bash for safe virtual shell commands: ls, cat/read, head, tail, grep, find, write, rm, cp, and mv. Use edit for exact structured oldText/newText replacements. Treat paths as virtual Marinara workspace paths, not host filesystem paths.".to_string(),
        "The workspace exposes creative-library records only: characters, character groups, personas, persona groups, lorebooks with nested entries, and prompt presets with nested sections/groups/variables.".to_string(),
        "You may edit and write records in this workspace. edit uses exact oldText/newText replacements against read output. write writes complete JSON content to a writable virtual file and stores it in Marinara.".to_string(),
        "You cannot delete records, run shell commands, access network resources, access chats/messages/memories, or view secrets/connections/API keys.".to_string(),
        "If the user asks about library data, inspect it with ls/read before answering. Do not invent data. Answer plainly after using any needed tools.".to_string(),
    ];
    if let Some(persona) = persona {
        let persona_text = [
            ("Name", persona.name.as_deref()),
            ("Comment", persona.comment.as_deref()),
            ("Description", persona.description.as_deref()),
            ("Personality", persona.personality.as_deref()),
            ("Scenario", persona.scenario.as_deref()),
            ("Backstory", persona.backstory.as_deref()),
            ("Appearance", persona.appearance.as_deref()),
        ]
        .into_iter()
        .filter_map(|(label, value)| {
            let value = value?.trim();
            (!value.is_empty()).then(|| format!("{label}: {value}"))
        })
        .collect::<Vec<_>>()
        .join("\n");
        if !persona_text.is_empty() {
            parts.push(format!("The user's selected persona is:\n{persona_text}"));
        }
    }
    parts.join("\n\n")
}

fn build_task_prompt(input: &MariPromptRequest) -> String {
    let mut sections = Vec::new();
    let history = input
        .messages
        .iter()
        .rev()
        .take(16)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .filter_map(|message| {
            let content = message.content.trim();
            (!content.is_empty()).then(|| format!("{}: {content}", message.role))
        })
        .collect::<Vec<_>>()
        .join("\n");
    if !history.is_empty() {
        sections.push(format!("Conversation history:\n{history}"));
    }
    if !input.attachments.is_empty() {
        let attachments = input
            .attachments
            .iter()
            .map(|attachment| {
                format!(
                    "File: {}\nType: {}\nSize: {}\nContent:\n{}",
                    attachment.name, attachment.r#type, attachment.size, attachment.content
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n---\n\n");
        sections.push(format!(
            "Attached files for the latest user turn:\n{attachments}"
        ));
    }
    sections.push(format!(
        "Latest user message:\n{}",
        input.user_message.trim()
    ));
    sections.join("\n\n")
}

fn ensure_connection_supports_native_tools(connection: &marinara_llm::LlmConnection) -> AppResult<()> {
    match connection.provider.as_str() {
        "openai" | "openai_chatgpt" | "openrouter" | "custom" | "xai" | "mistral" | "cohere" | "nanogpt" => Ok(()),
        provider => Err(AppError::invalid_input(format!(
            "Professor Mari requires a connection with native tool-call support. The selected provider '{provider}' is not enabled for native tools in Marinara's Rust LLM transport yet. Use an OpenAI-compatible, OpenRouter, OpenAI, xAI, Mistral, Cohere, NanoGPT, or custom OpenAI-compatible connection with a tool-capable chat model."
        ))),
    }
}

fn tool_call_error_message(message: &str) -> String {
    if message.contains("Provider response did not contain assistant text or tool calls") {
        return "The selected model/provider did not return a native tool call or assistant message. Professor Mari's read-library path requires native tool calling; choose a tool-capable chat model on the selected connection.".to_string();
    }
    message.to_string()
}

fn format_app_error_for_debug(error: &AppError) -> String {
    let mut message = error.to_string();
    if let Some(details) = &error.details {
        let details = serde_json::to_string_pretty(details)
            .unwrap_or_else(|serialize_error| format!("Could not serialize error details: {serialize_error}"));
        message.push_str("\nProvider debug details:\n");
        message.push_str(&details.chars().take(12_000).collect::<String>());
    }
    message
}
