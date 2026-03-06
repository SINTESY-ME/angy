use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

struct PtyInstance {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

static PTY_MAP: once_cell::sync::Lazy<Mutex<HashMap<u32, PtyInstance>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(HashMap::new()));

static NEXT_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1);

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    shell: String,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");

    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave); // Release slave side

    let id = NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    // Spawn reader thread that emits events to frontend
    let app_clone = app.clone();
    let pty_id = id;
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(&format!("pty-data-{}", pty_id), data);
                }
                Err(_) => break,
            }
        }
        let _ = app_clone.emit(&format!("pty-exit-{}", pty_id), ());
    });

    let instance = PtyInstance {
        master: pair.master,
        writer,
    };
    PTY_MAP.lock().unwrap().insert(id, instance);

    Ok(id)
}

#[tauri::command]
pub fn pty_write(id: u32, data: String) -> Result<(), String> {
    let mut map = PTY_MAP.lock().unwrap();
    let instance = map.get_mut(&id).ok_or("PTY not found")?;
    instance
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    instance.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_resize(id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let map = PTY_MAP.lock().unwrap();
    let instance = map.get(&id).ok_or("PTY not found")?;
    instance
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_kill(id: u32) -> Result<(), String> {
    let mut map = PTY_MAP.lock().unwrap();
    map.remove(&id); // Dropping master kills the PTY
    Ok(())
}
