// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::panic;

fn write_minidump() {
    #[cfg(target_os = "windows")]
    {
        const STATUS_INVALID_PARAMETER: i32 = -1073741811;

        let mut minidump_file = std::fs::File::create("crash.dump")
            .expect("failed to create file");

        minidump_writer::minidump_writer::MinidumpWriter::dump_local_context(
            Some(STATUS_INVALID_PARAMETER),
            Some(unsafe { windows_sys::Win32::System::Threading::GetCurrentThreadId() }),
            None,
            &mut minidump_file,
        ).expect("failed to write minidump");
    }
}

fn main() {
    panic::set_hook(Box::new(|panic_info| {
        write_minidump();
    }));

    mintcat_lib::run()
}
