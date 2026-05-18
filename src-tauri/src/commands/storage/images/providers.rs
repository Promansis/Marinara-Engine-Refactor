use super::*;
use std::collections::HashMap;
use std::io::{Cursor, Read};

const DEFAULT_OPENAI_IMAGE_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_STABILITY_BASE_URL: &str = "https://api.stability.ai/v2beta";
const DEFAULT_TOGETHER_BASE_URL: &str = "https://api.together.xyz/v1";
const DEFAULT_NOVELAI_BASE_URL: &str = "https://image.novelai.net";
const DEFAULT_OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";
const DEFAULT_XAI_BASE_URL: &str = "https://api.x.ai/v1";
const DEFAULT_HORDE_BASE_URL: &str = "https://stablehorde.net/api/v2";
const DEFAULT_AUTOMATIC1111_BASE_URL: &str = "http://localhost:7860";
const DEFAULT_COMFYUI_BASE_URL: &str = "http://127.0.0.1:8188";
const DEFAULT_NANOGPT_BASE_URL: &str = "https://nano-gpt.com/api/v1";
const DEFAULT_RUNPOD_BASE_URL: &str = "https://api.runpod.ai/v2";
const NOVELAI_V4_PROMPT_HINT: &str = "NovelAI V4/V4.5 prompts support roughly 512 T5 tokens and reject most Unicode prompt characters; try a shorter ASCII prompt without emoji or non-Latin text.";

#[derive(Clone, Debug, Default)]
pub(crate) struct ImageGenerationOptions {
    pub(crate) negative_prompt: Option<String>,
    pub(crate) reference_images: Vec<String>,
}

pub(crate) async fn generate_image_with_connection(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
) -> AppResult<(String, String)> {
    generate_image_with_options(
        connection,
        prompt,
        width,
        height,
        ImageGenerationOptions::default(),
    )
    .await
}

pub(crate) async fn generate_image_with_options(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: ImageGenerationOptions,
) -> AppResult<(String, String)> {
    if connection.get("provider").and_then(Value::as_str) != Some("image_generation") {
        return Err(AppError::invalid_input(
            "Selected connection is not an image-generation connection",
        ));
    }
    let source = image_source(connection);
    match source.as_str() {
        "pollinations" => generate_pollinations(connection, prompt, width, height).await,
        "stability" => generate_stability(connection, prompt).await,
        "automatic1111" | "drawthings" => {
            generate_automatic1111(connection, prompt, width, height, options.negative_prompt.as_deref()).await
        }
        "comfyui" => generate_comfyui(connection, prompt, width, height, &options).await,
        "runpod_comfyui" => generate_runpod_comfyui(connection, prompt, width, height, &options).await,
        "horde" => generate_horde(connection, prompt, width, height).await,
        "novelai" => generate_novelai(connection, prompt, width, height, &options).await,
        "openrouter" | "gemini_image" => generate_chat_image(connection, prompt, width, height, &options).await,
        "xai" => generate_xai(connection, prompt, width, height).await,
        "openai" | "togetherai" | "nanogpt" | "blockentropy" | "" => {
            generate_openai_compatible_image(connection, &source, prompt, width, height).await
        }
        other => Err(AppError::invalid_input(format!(
            "Unsupported image generation service: {other}"
        ))),
    }
}

fn image_source(connection: &Value) -> String {
    connection
        .get("imageGenerationSource")
        .or_else(|| connection.get("imageService"))
        .and_then(Value::as_str)
        .or_else(|| connection.get("service").and_then(Value::as_str))
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
}

fn connection_model(connection: &Value, fallback: &str) -> String {
    connection
        .get("model")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn connection_api_key(connection: &Value) -> String {
    connection
        .get("apiKey")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn connection_base_url(connection: &Value, source: &str) -> String {
    let fallback = match source {
        "stability" => DEFAULT_STABILITY_BASE_URL,
        "togetherai" => DEFAULT_TOGETHER_BASE_URL,
        "novelai" => DEFAULT_NOVELAI_BASE_URL,
        "openrouter" | "gemini_image" => DEFAULT_OPENROUTER_BASE_URL,
        "xai" => DEFAULT_XAI_BASE_URL,
        "horde" => DEFAULT_HORDE_BASE_URL,
        "automatic1111" | "drawthings" => DEFAULT_AUTOMATIC1111_BASE_URL,
        "comfyui" => DEFAULT_COMFYUI_BASE_URL,
        "runpod_comfyui" => DEFAULT_RUNPOD_BASE_URL,
        "nanogpt" => DEFAULT_NANOGPT_BASE_URL,
        _ => DEFAULT_OPENAI_IMAGE_BASE_URL,
    };
    connection
        .get("baseUrl")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback)
        .trim_end_matches('/')
        .to_string()
}

#[derive(Clone, Debug)]
struct ComfyDefaults {
    prompt_prefix: String,
    negative_prompt_prefix: String,
    sampler: String,
    scheduler: String,
    steps: u64,
    cfg_scale: f64,
    denoising_strength: f64,
    clip_skip: Option<u64>,
}

#[derive(Clone, Debug)]
struct NovelAiDefaults {
    prompt_prefix: String,
    negative_prompt_prefix: String,
    sampler: String,
    noise_schedule: String,
    steps: u64,
    prompt_guidance: f64,
    prompt_guidance_rescale: f64,
    undesired_content_preset: u64,
}

fn default_parameters_root(connection: &Value) -> Option<Value> {
    match connection.get("defaultParameters")? {
        Value::String(raw) => serde_json::from_str::<Value>(raw).ok(),
        Value::Object(_) => connection.get("defaultParameters").cloned(),
        _ => None,
    }
}

fn image_defaults_profile(connection: &Value, service: &str) -> Option<Value> {
    let profile = default_parameters_root(connection)?
        .get("imageGeneration")
        .cloned()?;
    profile
        .get("service")
        .and_then(Value::as_str)
        .filter(|value| *value == service)?;
    Some(profile)
}

fn read_string(value: Option<&Value>, fallback: &str) -> String {
    value
        .and_then(Value::as_str)
        .filter(|raw| !raw.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn read_u64(value: Option<&Value>, fallback: u64, min: u64, max: u64) -> u64 {
    value
        .and_then(Value::as_u64)
        .unwrap_or(fallback)
        .clamp(min, max)
}

fn read_f64(value: Option<&Value>, fallback: f64, min: f64, max: f64) -> f64 {
    value
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
        .unwrap_or(fallback)
        .clamp(min, max)
}

fn resolve_seed(connection: &Value) -> u64 {
    default_parameters_root(connection)
        .and_then(|root| {
            root.get("imageGeneration")
                .and_then(|profile| profile.get("seed"))
                .and_then(Value::as_i64)
        })
        .filter(|seed| *seed >= 0)
        .map(|seed| seed as u64)
        .unwrap_or_else(|| now_millis() as u64 % 4_294_967_295)
}

fn resolve_comfy_defaults(connection: &Value) -> ComfyDefaults {
    let defaults = image_defaults_profile(connection, "comfyui")
        .and_then(|profile| profile.get("comfyui").cloned())
        .unwrap_or(Value::Null);
    ComfyDefaults {
        prompt_prefix: read_string(defaults.get("promptPrefix"), ""),
        negative_prompt_prefix: read_string(defaults.get("negativePromptPrefix"), ""),
        sampler: read_string(defaults.get("sampler"), "euler_ancestral"),
        scheduler: read_string(defaults.get("scheduler"), "normal"),
        steps: read_u64(defaults.get("steps"), 20, 1, 150),
        cfg_scale: read_f64(defaults.get("cfgScale"), 7.0, 0.0, 30.0),
        denoising_strength: read_f64(defaults.get("denoisingStrength"), 1.0, 0.0, 1.0),
        clip_skip: defaults
            .get("clipSkip")
            .and_then(Value::as_u64)
            .filter(|value| (1..=12).contains(value)),
    }
}

fn resolve_novelai_defaults(connection: &Value) -> NovelAiDefaults {
    let defaults = image_defaults_profile(connection, "novelai")
        .and_then(|profile| profile.get("novelai").cloned())
        .unwrap_or(Value::Null);
    NovelAiDefaults {
        prompt_prefix: read_string(defaults.get("promptPrefix"), ""),
        negative_prompt_prefix: read_string(defaults.get("negativePromptPrefix"), ""),
        sampler: read_string(defaults.get("sampler"), "k_euler_ancestral"),
        noise_schedule: read_string(defaults.get("noiseSchedule"), "karras"),
        steps: read_u64(defaults.get("steps"), 28, 1, 150),
        prompt_guidance: read_f64(defaults.get("promptGuidance"), 6.0, 0.0, 30.0),
        prompt_guidance_rescale: read_f64(defaults.get("promptGuidanceRescale"), 0.0, 0.0, 1.0),
        undesired_content_preset: read_u64(defaults.get("undesiredContentPreset"), 0, 0, 4),
    }
}

fn merge_prompt(prefix: &str, prompt: &str) -> String {
    let prefix = prefix.trim();
    let prompt = prompt.trim();
    match (prefix.is_empty(), prompt.is_empty()) {
        (true, _) => prompt.to_string(),
        (_, true) => prefix.to_string(),
        _ => format!("{prefix}, {prompt}"),
    }
}

fn merge_negative_prompt(prefix: &str, prompt: Option<&str>) -> String {
    merge_prompt(prefix, prompt.unwrap_or(""))
}

fn http_client(timeout_secs: u64) -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|error| AppError::new("image_client_error", error.to_string()))
}

fn bearer(request: reqwest::RequestBuilder, api_key: &str) -> reqwest::RequestBuilder {
    if api_key.trim().is_empty() {
        request
    } else {
        request.bearer_auth(api_key)
    }
}

async fn response_json(response: reqwest::Response, provider: &str) -> AppResult<Value> {
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| AppError::new("image_response_error", error.to_string()))?;
    if !status.is_success() {
        return Err(AppError::new(
            "image_provider_error",
            format!("{provider} returned HTTP {status}: {}", sanitize_error(&text)),
        ));
    }
    serde_json::from_str::<Value>(&text).map_err(|error| {
        AppError::new(
            "image_response_error",
            format!("{provider} returned invalid JSON: {error}"),
        )
    })
}

async fn image_response_base64(response: reqwest::Response, provider: &str) -> AppResult<(String, String)> {
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("image/png")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| AppError::new("image_response_error", error.to_string()))?;
    if !status.is_success() {
        let text = String::from_utf8_lossy(&bytes);
        return Err(AppError::new(
            "image_provider_error",
            format!("{provider} returned HTTP {status}: {}", sanitize_error(&text)),
        ));
    }
    Ok((general_purpose::STANDARD.encode(bytes), content_type))
}

fn sanitize_error(text: &str) -> String {
    text.replace(['\n', '\r', '\t'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(300)
        .collect()
}

fn strip_data_url(value: &str) -> (&str, &str) {
    if let Some((meta, base64)) = value.split_once(',') {
        if meta.starts_with("data:") {
            let mime = meta
                .strip_prefix("data:")
                .and_then(|rest| rest.split(';').next())
                .unwrap_or("image/png");
            return (base64, mime);
        }
    }
    (value, "image/png")
}

fn detect_image_mime_type(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        return "image/png";
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return "image/jpeg";
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return "image/webp";
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return "image/gif";
    }
    "image/png"
}

fn detect_base64_mime_type(base64: &str) -> String {
    let sample = base64.trim().chars().take(96).collect::<String>();
    general_purpose::STANDARD
        .decode(sample)
        .ok()
        .map(|bytes| detect_image_mime_type(&bytes).to_string())
        .unwrap_or_else(|| "image/png".to_string())
}

async fn response_bytes(
    response: reqwest::Response,
    provider: &str,
) -> AppResult<(Vec<u8>, String)> {
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| AppError::new("image_response_error", error.to_string()))?
        .to_vec();
    if !status.is_success() {
        let text = String::from_utf8_lossy(&bytes);
        return Err(AppError::new(
            "image_provider_error",
            format!("{provider} returned HTTP {status}: {}", sanitize_error(&text)),
        ));
    }
    Ok((bytes, content_type))
}

async fn fetch_image_url(client: &reqwest::Client, url: &str) -> AppResult<(String, String)> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| AppError::new("image_network_error", error.to_string()))?;
    image_response_base64(response, "image URL").await
}

async fn generate_pollinations(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
) -> AppResult<(String, String)> {
    let base = connection
        .get("baseUrl")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("https://image.pollinations.ai")
        .trim_end_matches('/');
    let encoded_prompt = percent_encode_component(prompt);
    let seed = now_millis() % 1_000_000_000;
    let url = format!("{base}/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&seed={seed}");
    fetch_image_url(&http_client(120)?, &url).await
}

async fn generate_openai_compatible_image(
    connection: &Value,
    source: &str,
    prompt: &str,
    width: u64,
    height: u64,
) -> AppResult<(String, String)> {
    let source = if source.is_empty() { "openai" } else { source };
    let base = connection_base_url(connection, source);
    let model = connection_model(
        connection,
        match source {
            "xai" => "grok-2-image",
            "togetherai" => "black-forest-labs/FLUX.1-schnell",
            _ => "gpt-image-1",
        },
    );
    let client = http_client(180)?;
    let mut endpoint = format!("{base}/images/generations");
    if source == "nanogpt" {
        endpoint = nanogpt_images_url(&base);
    }
    let payload = json!({
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": format!("{width}x{height}"),
        "response_format": "b64_json"
    });
    let response = bearer(
        client.post(endpoint).json(&payload),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", error.to_string()))?;
    let json = response_json(response, source).await?;
    parse_image_json(&client, &json)
        .await
        .ok_or_else(|| AppError::new("image_response_error", format!("{source} returned no image data")))
}

async fn generate_xai(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "xai");
    let model = connection_model(connection, "grok-2-image");
    let client = http_client(180)?;
    let payload = json!({
        "model": model,
        "prompt": prompt,
        "n": 1,
        "aspect_ratio": closest_xai_aspect_ratio(width, height),
        "response_format": "b64_json"
    });
    let response = bearer(
        client.post(format!("{base}/images/generations")).json(&payload),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", error.to_string()))?;
    let json = response_json(response, "xai").await?;
    parse_image_json(&client, &json)
        .await
        .ok_or_else(|| AppError::new("image_response_error", "xAI returned no image data"))
}

fn closest_xai_aspect_ratio(width: u64, height: u64) -> &'static str {
    let ratio = width as f64 / height.max(1) as f64;
    [
        ("1:1", 1.0),
        ("16:9", 16.0 / 9.0),
        ("9:16", 9.0 / 16.0),
        ("4:3", 4.0 / 3.0),
        ("3:4", 3.0 / 4.0),
        ("3:2", 3.0 / 2.0),
        ("2:3", 2.0 / 3.0),
        ("2:1", 2.0),
        ("1:2", 0.5),
    ]
    .into_iter()
    .min_by(|a, b| {
        (a.1 - ratio)
            .abs()
            .partial_cmp(&(b.1 - ratio).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    })
    .map(|item| item.0)
    .unwrap_or("1:1")
}

fn nanogpt_images_url(base: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    if trimmed.ends_with("/images/generations") {
        return trimmed.to_string();
    }
    if trimmed.ends_with("/api/v1") {
        return format!(
            "{}/v1/images/generations",
            trimmed.trim_end_matches("/api/v1")
        );
    }
    if trimmed.ends_with("/v1") {
        return format!("{trimmed}/images/generations");
    }
    if trimmed.ends_with("/api") {
        return format!("{}/v1/images/generations", trimmed.trim_end_matches("/api"));
    }
    format!("{trimmed}/images/generations")
}

async fn generate_chat_image(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let source = image_source(connection);
    let base = connection_base_url(connection, &source);
    let model = connection_model(connection, "google/gemini-2.5-flash-image");
    let client = http_client(180)?;
    let prompt = match options.negative_prompt.as_deref().filter(|value| !value.trim().is_empty()) {
        Some(negative) => format!("{prompt}\n\nAvoid in the image: {negative}"),
        None => prompt.to_string(),
    };
    let content = if options.reference_images.is_empty() {
        Value::String(prompt)
    } else {
        let mut parts = options
            .reference_images
            .iter()
            .map(|image| json!({ "type": "image_url", "image_url": { "url": image_data_url(image) } }))
            .collect::<Vec<_>>();
        parts.push(json!({ "type": "text", "text": prompt }));
        Value::Array(parts)
    };
    let payload = json!({
        "model": model,
        "messages": [{ "role": "user", "content": content }],
        "modalities": ["image", "text"],
        "stream": false,
        "image_config": { "aspect_ratio": closest_openrouter_aspect_ratio(width, height) }
    });
    let response = bearer(
        client.post(format!("{base}/chat/completions")).json(&payload),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", error.to_string()))?;
    let json = response_json(response, &source).await?;
    parse_image_json(&client, &json)
        .await
        .ok_or_else(|| AppError::new("image_response_error", format!("{source} returned no image data")))
}

async fn parse_image_json(client: &reqwest::Client, json: &Value) -> Option<(String, String)> {
    if let Some(base64) = json
        .pointer("/data/0/b64_json")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
    {
        return Some((base64.to_string(), "image/png".to_string()));
    }
    if let Some(url) = json
        .pointer("/data/0/url")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
    {
        if url.starts_with("data:image/") {
            let (base64, mime) = strip_data_url(url);
            return Some((base64.to_string(), mime.to_string()));
        }
        return fetch_image_url(client, url).await.ok();
    }
    if let Some(value) = find_image_string(json) {
        if value.starts_with("data:image/") {
            let (base64, mime) = strip_data_url(value);
            return Some((base64.to_string(), mime.to_string()));
        }
        if is_http_image_url(value) {
            return fetch_image_url(client, value).await.ok();
        }
    }
    None
}

fn find_image_string(value: &Value) -> Option<&str> {
    match value {
        Value::String(raw) if raw.starts_with("data:image/") => Some(raw),
        Value::String(raw) => find_image_reference_in_text(raw),
        Value::Array(items) => items.iter().find_map(find_image_string),
        Value::Object(map) => map.values().find_map(find_image_string),
        _ => None,
    }
}

fn find_image_reference_in_text(raw: &str) -> Option<&str> {
    if let Some(start) = raw.find("data:image/") {
        let rest = &raw[start..];
        let end = rest
            .find(|ch: char| ch.is_whitespace() || ch == ')' || ch == '"' || ch == '\'')
            .unwrap_or(rest.len());
        return Some(&rest[..end]);
    }
    if let Some(start) = raw.find("http://").or_else(|| raw.find("https://")) {
        let rest = &raw[start..];
        let end = rest
            .find(|ch: char| ch.is_whitespace() || ch == ')' || ch == '"' || ch == '\'' || ch == '<')
            .unwrap_or(rest.len());
        let candidate = &rest[..end];
        if is_http_image_url(candidate) {
            return Some(candidate);
        }
    }
    None
}

fn is_http_image_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    (lower.starts_with("http://") || lower.starts_with("https://"))
        && [".png", ".jpg", ".jpeg", ".webp", ".gif"]
            .iter()
            .any(|ext| lower.contains(ext))
}

fn closest_openrouter_aspect_ratio(width: u64, height: u64) -> &'static str {
    let ratio = width as f64 / height.max(1) as f64;
    [
        ("21:9", 21.0 / 9.0),
        ("16:9", 16.0 / 9.0),
        ("3:2", 3.0 / 2.0),
        ("5:4", 5.0 / 4.0),
        ("4:3", 4.0 / 3.0),
        ("1:1", 1.0),
        ("3:4", 3.0 / 4.0),
        ("4:5", 4.0 / 5.0),
        ("2:3", 2.0 / 3.0),
        ("9:16", 9.0 / 16.0),
    ]
    .into_iter()
    .min_by(|a, b| {
        (a.1 - ratio)
            .abs()
            .partial_cmp(&(b.1 - ratio).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    })
    .map(|item| item.0)
    .unwrap_or("1:1")
}

fn image_data_url(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.starts_with("data:") || trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return trimmed.to_string();
    }
    format!("data:{};base64,{}", detect_base64_mime_type(trimmed), trimmed)
}

async fn generate_stability(connection: &Value, prompt: &str) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "stability");
    let model = connection_model(connection, "stable-image-core");
    let endpoint = if model.contains("ultra") {
        "stable-image/generate/ultra"
    } else if model.contains("core") {
        "stable-image/generate/core"
    } else {
        "stable-image/generate/sd3"
    };
    let mut form = reqwest::multipart::Form::new()
        .text("prompt", prompt.to_string())
        .text("output_format", "png".to_string());
    if endpoint.ends_with("sd3") {
        form = form.text("model", model).text("mode", "text-to-image".to_string());
    }
    let response = bearer(
        http_client(180)?
            .post(format!("{base}/{endpoint}"))
            .header(reqwest::header::ACCEPT, "image/*")
            .multipart(form),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", error.to_string()))?;
    image_response_base64(response, "stability").await
}

async fn generate_automatic1111(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    negative_prompt: Option<&str>,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "automatic1111");
    let model = connection
        .get("model")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty());
    let defaults = image_defaults_profile(connection, "automatic1111")
        .and_then(|profile| profile.get("automatic1111").cloned())
        .unwrap_or(Value::Null);
    let prompt = merge_prompt(&read_string(defaults.get("promptPrefix"), ""), prompt);
    let negative_prompt = merge_negative_prompt(
        &read_string(defaults.get("negativePromptPrefix"), ""),
        negative_prompt,
    );
    let steps = read_u64(defaults.get("steps"), 20, 1, 150);
    let cfg_scale = read_f64(defaults.get("cfgScale"), 7.0, 0.0, 30.0);
    let sampler = read_string(defaults.get("sampler"), "Euler a");
    let scheduler = read_string(defaults.get("scheduler"), "");
    let restore_faces = defaults
        .get("restoreFaces")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let seed = resolve_seed(connection);
    let mut payload = json!({
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": width,
        "height": height,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "sampler_name": sampler,
        "restore_faces": restore_faces,
        "seed": seed
    });
    if !scheduler.trim().is_empty() {
        payload["scheduler"] = Value::String(scheduler);
    }
    if let Some(clip_skip) = defaults.get("clipSkip").and_then(Value::as_u64) {
        payload["override_settings"] = json!({ "CLIP_stop_at_last_layers": clip_skip });
    }
    if let Some(model) = model {
        if !payload
            .get("override_settings")
            .and_then(Value::as_object)
            .is_some()
        {
            payload["override_settings"] = json!({});
        }
        let settings = payload
            .get_mut("override_settings")
            .and_then(Value::as_object_mut)
            .expect("override_settings is object when present");
        settings.insert("sd_model_checkpoint".to_string(), Value::String(model.to_string()));
    }
    let response = http_client(180)?
        .post(format!("{base}/sdapi/v1/txt2img"))
        .json(&payload)
        .send()
        .await
        .map_err(|error| AppError::new("image_network_error", error.to_string()))?;
    let json = response_json(response, "automatic1111").await?;
    let image = json
        .get("images")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("image_response_error", "AUTOMATIC1111 returned no image"))?;
    let (base64, mime) = strip_data_url(image);
    Ok((base64.to_string(), mime.to_string()))
}

async fn generate_horde(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "horde");
    let api_key = connection_api_key(connection);
    let client = http_client(240)?;
    let mut request = client.post(format!("{base}/generate/async")).json(&json!({
        "prompt": prompt,
        "params": { "width": width, "height": height, "n": 1 },
        "nsfw": true,
        "trusted_workers": false,
        "slow_workers": true
    }));
    request = request.header("apikey", if api_key.trim().is_empty() { "0000000000" } else { &api_key });
    let submit = response_json(
        request
            .send()
            .await
            .map_err(|error| AppError::new("image_network_error", error.to_string()))?,
        "horde",
    )
    .await?;
    let id = submit
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("image_response_error", "Stable Horde did not return a request id"))?
        .to_string();
    for _ in 0..120 {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let status = response_json(
            client
                .get(format!("{base}/generate/status/{id}"))
                .header("apikey", if api_key.trim().is_empty() { "0000000000" } else { &api_key })
                .send()
                .await
                .map_err(|error| AppError::new("image_network_error", error.to_string()))?,
            "horde",
        )
        .await?;
        if let Some(img) = status
            .get("generations")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("img"))
            .and_then(Value::as_str)
        {
            if img.starts_with("http://") || img.starts_with("https://") {
                return fetch_image_url(&client, img).await;
            }
            let (base64, mime) = strip_data_url(img);
            return Ok((base64.to_string(), mime.to_string()));
        }
        if status.get("done").and_then(Value::as_bool).unwrap_or(false) {
            break;
        }
    }
    Err(AppError::new(
        "image_timeout",
        "Stable Horde did not finish image generation before the timeout",
    ))
}

async fn generate_comfyui(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let defaults = resolve_comfy_defaults(connection);
    let prompt = merge_prompt(&defaults.prompt_prefix, prompt);
    let negative_prompt = merge_negative_prompt(
        &defaults.negative_prompt_prefix,
        options.negative_prompt.as_deref(),
    );
    let workflow = connection
        .get("comfyuiWorkflow")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(|raw| {
            serde_json::from_str::<Value>(raw)
                .map_err(|error| AppError::invalid_input(format!("Invalid ComfyUI workflow JSON: {error}")))
        })
        .transpose()?
        .unwrap_or_else(|| default_comfyui_workflow(&defaults));
    let replacements = comfy_replacements(
        connection,
        &defaults,
        &prompt,
        &negative_prompt,
        width,
        height,
        options.reference_images.first().map(String::as_str),
    );
    let prompt_json = replace_workflow_placeholders(workflow, &replacements);
    let base = connection_base_url(connection, "comfyui");
    let client = http_client(240)?;
    let response = response_json(
        client
            .post(format!("{base}/prompt"))
            .json(&json!({ "prompt": prompt_json }))
            .send()
            .await
            .map_err(|error| AppError::new("image_network_error", error.to_string()))?,
        "comfyui",
    )
    .await?;
    let prompt_id = response
        .get("prompt_id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("image_response_error", "ComfyUI did not return a prompt id"))?
        .to_string();
    for _ in 0..120 {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let history = response_json(
            client
                .get(format!("{base}/history/{prompt_id}"))
                .send()
                .await
                .map_err(|error| AppError::new("image_network_error", error.to_string()))?,
            "comfyui",
        )
        .await?;
        if let Some(image) = find_comfyui_image(&history, &prompt_id) {
            let filename = image.get("filename").and_then(Value::as_str).unwrap_or("");
            let subfolder = image.get("subfolder").and_then(Value::as_str).unwrap_or("");
            let kind = image.get("type").and_then(Value::as_str).unwrap_or("output");
            if !filename.is_empty() {
                let url = format!(
                    "{base}/view?filename={}&subfolder={}&type={}",
                    percent_encode_component(filename),
                    percent_encode_component(subfolder),
                    percent_encode_component(kind)
                );
                return fetch_image_url(&client, &url).await;
            }
        }
    }
    Err(AppError::new(
        "image_timeout",
        "ComfyUI did not finish image generation before the timeout",
    ))
}

fn default_comfyui_workflow(defaults: &ComfyDefaults) -> Value {
    json!({
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": "%seed%",
                "steps": defaults.steps,
                "cfg": defaults.cfg_scale,
                "sampler_name": defaults.sampler,
                "scheduler": defaults.scheduler,
                "denoise": defaults.denoising_strength,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            }
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": { "ckpt_name": "%model%" }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": { "width": "%width%", "height": "%height%", "batch_size": 1 }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": { "text": "%prompt%", "clip": ["4", 1] }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": { "text": "%negative_prompt%", "clip": ["4", 1] }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": { "filename_prefix": "marinara", "images": ["8", 0] }
        }
    })
}

fn comfy_replacements(
    connection: &Value,
    defaults: &ComfyDefaults,
    prompt: &str,
    negative_prompt: &str,
    width: u64,
    height: u64,
    reference_image: Option<&str>,
) -> HashMap<String, Value> {
    let mut replacements = HashMap::from([
        ("%prompt%".to_string(), Value::String(prompt.to_string())),
        (
            "%negative_prompt%".to_string(),
            Value::String(negative_prompt.to_string()),
        ),
        ("%width%".to_string(), json!(width)),
        ("%height%".to_string(), json!(height)),
        ("%seed%".to_string(), json!(resolve_seed(connection))),
        ("%steps%".to_string(), json!(defaults.steps)),
        ("%cfg%".to_string(), json!(defaults.cfg_scale)),
        ("%cfg_scale%".to_string(), json!(defaults.cfg_scale)),
        ("%scale%".to_string(), json!(defaults.cfg_scale)),
        ("%sampler%".to_string(), Value::String(defaults.sampler.clone())),
        ("%scheduler%".to_string(), Value::String(defaults.scheduler.clone())),
        ("%denoise%".to_string(), json!(defaults.denoising_strength)),
        (
            "%denoising_strength%".to_string(),
            json!(defaults.denoising_strength),
        ),
        ("%clip_skip%".to_string(), json!(defaults.clip_skip.unwrap_or(0))),
    ]);
    if let Some(model) = connection
        .get("model")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        replacements.insert("%model%".to_string(), Value::String(model.to_string()));
    }
    if let Some(reference) = reference_image {
        replacements.insert(
            "%reference_image%".to_string(),
            Value::String(image_data_url(reference)),
        );
    }
    replacements
}

fn replace_workflow_placeholders(value: Value, replacements: &HashMap<String, Value>) -> Value {
    match value {
        Value::String(raw) => {
            if let Some(exact) = replacements.get(&raw) {
                return exact.clone();
            }
            let replaced = replacements.iter().fold(raw, |current, (token, replacement)| {
                let replacement = replacement
                    .as_str()
                    .map(str::to_string)
                    .unwrap_or_else(|| replacement.to_string());
                current.replace(token, &replacement)
            });
            Value::String(replaced)
        }
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .map(|item| replace_workflow_placeholders(item, replacements))
                .collect(),
        ),
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, item)| (key, replace_workflow_placeholders(item, replacements)))
                .collect(),
        ),
        other => other,
    }
}

async fn generate_runpod_comfyui(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let endpoint_id = connection
        .get("imageEndpointId")
        .or_else(|| connection.get("image_endpoint_id"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            AppError::invalid_input(
                "RunPod ComfyUI requires an endpoint ID on the image connection",
            )
        })?;
    let endpoint_id = normalize_runpod_endpoint_id(endpoint_id)?;
    let workflow = connection
        .get("comfyuiWorkflow")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            AppError::invalid_input(
                "RunPod ComfyUI requires a workflow JSON on the image connection",
            )
        })?;
    let defaults = resolve_comfy_defaults(connection);
    let prompt = merge_prompt(&defaults.prompt_prefix, prompt);
    let negative_prompt = merge_negative_prompt(
        &defaults.negative_prompt_prefix,
        options.negative_prompt.as_deref(),
    );
    let workflow = serde_json::from_str::<Value>(workflow)
        .map_err(|error| AppError::invalid_input(format!("Invalid ComfyUI workflow JSON: {error}")))?;
    let workflow = replace_workflow_placeholders(
        workflow,
        &comfy_replacements(
            connection,
            &defaults,
            &prompt,
            &negative_prompt,
            width,
            height,
            options.reference_images.first().map(String::as_str),
        ),
    );
    let base = connection_base_url(connection, "runpod_comfyui");
    let client = http_client(30)?;
    let api_key = connection_api_key(connection);
    let submit = response_json(
        bearer(
            client
                .post(runpod_url(&base, &endpoint_id, &["run"]))
                .json(&json!({ "input": { "workflow": workflow } })),
            &api_key,
        )
        .send()
        .await
        .map_err(|error| AppError::new("image_network_error", error.to_string()))?,
        "runpod",
    )
    .await?;
    let job_id = submit
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("image_response_error", "RunPod did not return a job id"))?
        .to_string();
    let poll_client = http_client(210)?;
    for _ in 0..90 {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let status = response_json(
            bearer(
                poll_client.get(runpod_url(&base, &endpoint_id, &["status", &job_id])),
                &api_key,
            )
            .send()
            .await
            .map_err(|error| AppError::new("image_network_error", error.to_string()))?,
            "runpod",
        )
        .await?;
        match status.get("status").and_then(Value::as_str).unwrap_or("") {
            "COMPLETED" => return extract_runpod_image(&status),
            "FAILED" => {
                return Err(AppError::new(
                    "image_provider_error",
                    format!(
                        "RunPod generation failed: {}",
                        status
                            .get("error")
                            .and_then(Value::as_str)
                            .unwrap_or("Unknown error")
                    ),
                ));
            }
            "CANCELLED" => {
                return Err(AppError::new(
                    "image_provider_error",
                    "RunPod generation was cancelled",
                ));
            }
            _ => {}
        }
    }
    Err(AppError::new(
        "image_timeout",
        "RunPod generation timed out after 3 minutes",
    ))
}

fn normalize_runpod_endpoint_id(value: &str) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty()
        || !trimmed
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(AppError::invalid_input(
            "RunPod endpoint ID may only contain letters, numbers, underscores, and dashes",
        ));
    }
    Ok(trimmed.to_string())
}

fn runpod_url(base: &str, endpoint_id: &str, path: &[&str]) -> String {
    let mut url = format!("{}/{}", base.trim_end_matches('/'), endpoint_id);
    for segment in path {
        url.push('/');
        url.push_str(&percent_encode_component(segment));
    }
    url
}

fn extract_runpod_image(status: &Value) -> AppResult<(String, String)> {
    let images = status
        .pointer("/output/images")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            AppError::new(
                "image_response_error",
                "RunPod returned COMPLETED but output.images was empty or missing",
            )
        })?;
    for image in images {
        let candidate = image
            .get("data")
            .or_else(|| image.get("base64"))
            .or_else(|| image.get("image"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let Some(value) = candidate {
            if value.starts_with("data:") {
                let (base64, mime) = strip_data_url(value);
                return Ok((base64.to_string(), mime.to_string()));
            }
            return Ok((value.to_string(), detect_base64_mime_type(value)));
        }
    }
    Err(AppError::new(
        "image_response_error",
        "Could not extract image data from RunPod output",
    ))
}

async fn generate_novelai(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "novelai");
    if !base.to_ascii_lowercase().contains("novelai.net") {
        return generate_chat_image(connection, prompt, width, height, options).await;
    }
    let model = connection_model(connection, "nai-diffusion-4-5-full");
    let is_v4 = is_novelai_v4_model(&model);
    let defaults = resolve_novelai_defaults(connection);
    let prompt = prepare_novelai_prompt(
        &merge_prompt(&defaults.prompt_prefix, prompt),
        "prompt",
        &model,
    )?;
    let negative_prompt = prepare_novelai_prompt(
        &merge_negative_prompt(
            &defaults.negative_prompt_prefix,
            options.negative_prompt.as_deref(),
        ),
        "negative prompt",
        &model,
    )?;
    let mut parameters = json!({
        "width": width,
        "height": height,
        "n_samples": 1,
        "ucPreset": defaults.undesired_content_preset,
        "negative_prompt": negative_prompt,
        "seed": resolve_seed(connection),
        "scale": defaults.prompt_guidance,
        "steps": defaults.steps,
        "sampler": defaults.sampler
    });
    if !defaults.noise_schedule.trim().is_empty() {
        parameters["noise_schedule"] = Value::String(defaults.noise_schedule);
    }
    if is_v4 {
        parameters["cfg_rescale"] = json!(defaults.prompt_guidance_rescale);
        parameters["params_version"] = json!(3);
        parameters["v4_prompt"] = json!({
            "caption": { "base_caption": prompt, "char_captions": [] },
            "use_coords": false,
            "use_order": true
        });
        parameters["v4_negative_prompt"] = json!({
            "caption": { "base_caption": negative_prompt, "char_captions": [] },
            "use_coords": false,
            "use_order": true
        });
        let refs = options
            .reference_images
            .iter()
            .map(|image| image_data_url(image))
            .collect::<Vec<_>>();
        parameters["reference_image_multiple"] = json!(refs);
        parameters["reference_information_extracted_multiple"] =
            json!(vec![1; options.reference_images.len()]);
        parameters["reference_strength_multiple"] = json!(vec![0.6; options.reference_images.len()]);
    }
    let body = json!({
        "input": prompt,
        "model": model,
        "action": "generate",
        "parameters": parameters
    });
    let client = http_client(300)?;
    let response = bearer(
        client
            .post(format!("{base}/ai/generate-image"))
            .json(&body),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", error.to_string()))?;
    let (bytes, content_type) = response_bytes(response, "novelai").await?;
    parse_novelai_image_response(&client, bytes, &content_type).await
}

fn is_novelai_v4_model(model: &str) -> bool {
    let model = model.trim().to_ascii_lowercase();
    model.starts_with("nai-diffusion-4")
}

fn prepare_novelai_prompt(value: &str, field_name: &str, model: &str) -> AppResult<String> {
    if !is_novelai_v4_model(model) {
        return Ok(value.to_string());
    }
    let sanitized = sanitize_novelai_v4_prompt(value);
    if !value.trim().is_empty() && sanitized.is_empty() {
        return Err(AppError::invalid_input(format!(
            "NovelAI {field_name} contains only unsupported V4/V4.5 prompt characters. {NOVELAI_V4_PROMPT_HINT}"
        )));
    }
    Ok(sanitized)
}

fn sanitize_novelai_v4_prompt(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            '\u{2018}' | '\u{2019}' | '\u{201A}' | '\u{201B}' => '\'',
            '\u{201C}' | '\u{201D}' | '\u{201E}' | '\u{201F}' => '"',
            '\u{2010}'..='\u{2015}' | '\u{2212}' => '-',
            '\u{00A0}' => ' ',
            '\u{2026}' => '.',
            '\t' | '\n' | '\r' => ch,
            '\u{20}'..='\u{7E}' => ch,
            _ => ' ',
        })
        .collect::<String>()
        .split('\n')
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

async fn parse_novelai_image_response(
    client: &reqwest::Client,
    bytes: Vec<u8>,
    content_type: &str,
) -> AppResult<(String, String)> {
    if bytes.starts_with(b"PK") || content_type.to_ascii_lowercase().contains("zip") {
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes.clone()))
            .map_err(|error| AppError::new("image_response_error", error.to_string()))?;
        for index in 0..archive.len() {
            let mut file = archive
                .by_index(index)
                .map_err(|error| AppError::new("image_response_error", error.to_string()))?;
            if file.is_dir() {
                continue;
            }
            let mut image = Vec::new();
            file.read_to_end(&mut image)
                .map_err(|error| AppError::new("image_response_error", error.to_string()))?;
            let mime = detect_image_mime_type(&image).to_string();
            return Ok((general_purpose::STANDARD.encode(image), mime));
        }
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G'])
        || bytes.starts_with(&[0xff, 0xd8, 0xff])
        || (bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP")
    {
        let mime = detect_image_mime_type(&bytes).to_string();
        return Ok((general_purpose::STANDARD.encode(bytes), mime));
    }
    if let Ok(json) = serde_json::from_slice::<Value>(&bytes) {
        if let Some(result) = parse_image_json(client, &json).await {
            return Ok(result);
        }
    }
    Err(AppError::new(
        "image_response_error",
        "Could not parse NovelAI image response",
    ))
}

fn find_comfyui_image<'a>(history: &'a Value, prompt_id: &str) -> Option<&'a Value> {
    history
        .get(prompt_id)
        .and_then(|value| value.get("outputs"))
        .and_then(Value::as_object)
        .and_then(|outputs| {
            outputs.values().find_map(|output| {
                output
                    .get("images")
                    .and_then(Value::as_array)
                    .and_then(|images| images.first())
            })
        })
}
