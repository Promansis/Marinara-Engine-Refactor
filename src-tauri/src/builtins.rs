pub const PROFESSOR_MARI_ID: &str = "__professor_mari__";
pub const PROFESSOR_MARI_CHAT_ID: &str = "__professor_mari_chat__";
pub const PROFESSOR_MARI_ASSISTANT_PROMPT_SETTINGS_KEY: &str = "professor-mari-assistant-prompt";
pub const PROFESSOR_MARI_AVATAR: &str = "/sprites/mari/Mari_profile.png";

pub fn is_protected_record(collection: &str, id: &str) -> bool {
    matches!(
        (collection, id),
        ("characters", PROFESSOR_MARI_ID) | ("chats", PROFESSOR_MARI_CHAT_ID)
    )
}
