use keyring::{Entry, Error as KeyringError};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

const SECURE_STORE_SERVICE: &str = "com.vpsttt.webtui.chat";

#[tauri::command]
fn secure_store_get(key: String) -> Result<Option<String>, String> {
    let entry = secure_entry(&key)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("secure store get failed: {error}")),
    }
}

#[tauri::command]
fn secure_store_set(key: String, value: String) -> Result<(), String> {
    let entry = secure_entry(&key)?;
    entry
        .set_password(&value)
        .map_err(|error| format!("secure store set failed: {error}"))
}

#[tauri::command]
fn secure_store_remove(key: String) -> Result<(), String> {
    let entry = secure_entry(&key)?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("secure store remove failed: {error}")),
    }
}

fn secure_entry(key: &str) -> Result<Entry, String> {
    Entry::new(SECURE_STORE_SERVICE, key)
        .map_err(|error| format!("secure store entry failed: {error}"))
}

fn unread_tooltip(count: u32) -> String {
    if count == 0 {
        "WebTui Chat".to_string()
    } else {
        format!("WebTui Chat - {count} thong bao chua doc")
    }
}

#[tauri::command]
fn tray_set_unread_count(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    let tooltip = unread_tooltip(count);
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(&tooltip))
            .map_err(|error| format!("tray tooltip update failed: {error}"))?;
    }
    Ok(())
}

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn install_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Hiện WebTui Chat", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Ẩn cửa sổ", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    TrayIconBuilder::with_id("main")
        .tooltip("WebTui Chat")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => focus_main_window(app),
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_main_window(&tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let _ = app.emit("desktop://single-instance", argv);
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            install_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            secure_store_get,
            secure_store_set,
            secure_store_remove,
            tray_set_unread_count
        ])
        .run(tauri::generate_context!())
        .expect("failed to run WebTui Chat desktop host");
}

#[cfg(test)]
mod tests {
    use super::unread_tooltip;

    #[test]
    fn unread_tooltip_hides_count_when_zero() {
        assert_eq!(unread_tooltip(0), "WebTui Chat");
    }

    #[test]
    fn unread_tooltip_includes_unread_count() {
        assert_eq!(unread_tooltip(7), "WebTui Chat - 7 thong bao chua doc");
    }
}
