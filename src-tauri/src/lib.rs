use tauri::webview::WebviewWindowBuilder;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

const APP_ORIGIN: &str = "https://mallaunimag.com";
const APP_HOST: &str = "mallaunimag.com";

fn is_app_url(url: &url::Url) -> bool {
    match url.scheme() {
        "https" => url
            .host_str()
            .map(|h| h == APP_HOST || h.ends_with(&format!(".{}", APP_HOST)))
            .unwrap_or(false),
        "blob" | "data" | "about" => true,
        _ => false,
    }
}

const INIT_SCRIPT: &str = r#"
(function () {
  var APP_HOST = 'mallaunimag.com';
  function isSafeUrl(u) {
    try {
      var a = new URL(u, location.href);
      if (a.protocol === 'blob:' || a.protocol === 'data:' || a.protocol === 'about:') return true;
      return a.hostname === APP_HOST || a.hostname.endsWith('.' + APP_HOST);
    } catch (e) { return true; }
  }
  function openExternal(url) {
    var ipc = window.__TAURI_INTERNALS__;
    if (ipc && ipc.invoke) { ipc.invoke('open_external', { url: String(url) }); return; }
    location.href = String(url);
  }
  var nativeOpen = window.open;
  window.open = function (u) {
    if (typeof u === 'string' && !isSafeUrl(u)) { openExternal(u); return null; }
    return nativeOpen ? nativeOpen.apply(this, arguments) : null;
  };
  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el.nodeType === 1 && el.tagName !== 'A') el = el.parentElement;
    if (!el || el.tagName !== 'A') return;
    if (!isSafeUrl(el.href)) {
      e.preventDefault();
      e.stopPropagation();
      openExternal(el.href);
    }
  }, true);
})();
"#;

#[tauri::command]
fn open_external(url: String, app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window_cfg = app.config().app.windows[0].clone();
            let handle = app.handle().clone();

            WebviewWindowBuilder::from_config(app.handle(), &window_cfg)?
                .initialization_script(INIT_SCRIPT)
                .on_navigation(move |url| {
                    if is_app_url(url) {
                        return true;
                    }
                    let _ = handle.opener().open_url(url.to_string(), None::<&str>);
                    false
                })
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![open_external])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}