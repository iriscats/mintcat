use std::ffi::{c_char, c_void, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::ptr;

use anyhow::{Context, Result};
use mintcat_integrator_api::{
    CheckForeignPaksRequest, CheckInstalledRequest, CheckModConflictsRequest, FindGamePakRequest,
    InstallEvent, InstallProgress, InstallRequest, PathRequest, UninstallModsRequest,
};
use mintcat_integrator_core::{
    check_foreign_paks_by_game_path, check_installed_by_game_path, check_mod_conflicts_from_json,
    find_game_pak_by_name, install_mods_with_progress, is_valid_mod_directory, is_valid_zip,
    uninstall_mods_by_game_path,
};
use serde::de::DeserializeOwned;
use serde::Serialize;

const ABI_VERSION: u32 = 1;

type MintCatProgressCallback =
    unsafe extern "C" fn(event_json: *const c_char, user_data: *mut c_void);

struct FfiProgress {
    callback: Option<MintCatProgressCallback>,
    user_data: *mut c_void,
}

unsafe impl Send for FfiProgress {}
unsafe impl Sync for FfiProgress {}

impl InstallProgress for FfiProgress {
    fn emit(&self, event: InstallEvent) -> Result<()> {
        let Some(callback) = self.callback else {
            return Ok(());
        };
        let json = serde_json::to_string(&event).context("failed to serialize progress event")?;
        let event_json = string_to_c(json);
        unsafe {
            callback(event_json.as_ptr(), self.user_data);
        }
        Ok(())
    }
}

#[no_mangle]
pub extern "C" fn mintcat_integrator_abi_version() -> u32 {
    ABI_VERSION
}

#[no_mangle]
pub unsafe extern "C" fn mintcat_integrator_install(
    request_json: *const c_char,
    callback: Option<MintCatProgressCallback>,
    user_data: *mut c_void,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32 {
    clear_out(response_json);
    clear_out(error_message);

    match catch_unwind(AssertUnwindSafe(|| {
        install_inner(request_json, callback, user_data, response_json)
    })) {
        Ok(Ok(())) => 0,
        Ok(Err(error)) => {
            set_out(error_message, format!("{error:#}"));
            1
        }
        Err(_) => {
            set_out(error_message, "integrator panic".to_string());
            2
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn mintcat_integrator_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        drop(CString::from_raw(ptr));
    }
}

#[no_mangle]
pub unsafe extern "C" fn mintcat_integrator_uninstall_mods(
    request_json: *const c_char,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32 {
    command_entry(
        request_json,
        response_json,
        error_message,
        |request: UninstallModsRequest| {
            uninstall_mods_by_game_path(request.game_path, request.is_delete_ue4ss)
        },
    )
}

#[no_mangle]
pub unsafe extern "C" fn mintcat_integrator_check_installed(
    request_json: *const c_char,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32 {
    command_entry(
        request_json,
        response_json,
        error_message,
        |request: CheckInstalledRequest| {
            check_installed_by_game_path(request.game_path, request.install_time)
        },
    )
}

#[no_mangle]
pub unsafe extern "C" fn mintcat_integrator_find_game_pak(
    request_json: *const c_char,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32 {
    command_entry(
        request_json,
        response_json,
        error_message,
        |request: FindGamePakRequest| Ok(find_game_pak_by_name(request.game_name.as_deref())),
    )
}

#[no_mangle]
pub unsafe extern "C" fn mintcat_integrator_check_foreign_paks(
    request_json: *const c_char,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32 {
    command_entry(
        request_json,
        response_json,
        error_message,
        |request: CheckForeignPaksRequest| check_foreign_paks_by_game_path(&request.game_path),
    )
}

#[no_mangle]
pub unsafe extern "C" fn mintcat_integrator_is_valid_unpacked_mod(
    request_json: *const c_char,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32 {
    command_entry(
        request_json,
        response_json,
        error_message,
        |request: PathRequest| Ok(is_valid_mod_directory(&request.path)),
    )
}

#[no_mangle]
pub unsafe extern "C" fn mintcat_integrator_check_mod_conflicts(
    request_json: *const c_char,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32 {
    command_entry(
        request_json,
        response_json,
        error_message,
        |request: CheckModConflictsRequest| {
            check_mod_conflicts_from_json(&request.mod_list_json, request.game_name.as_deref())
                .map_err(anyhow::Error::msg)
        },
    )
}

#[no_mangle]
pub unsafe extern "C" fn mintcat_integrator_validate_zip_file(
    request_json: *const c_char,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32 {
    command_entry(
        request_json,
        response_json,
        error_message,
        |request: PathRequest| Ok(is_valid_zip(&request.path)),
    )
}

unsafe fn install_inner(
    request_json: *const c_char,
    callback: Option<MintCatProgressCallback>,
    user_data: *mut c_void,
    response_json: *mut *mut c_char,
) -> Result<()> {
    if request_json.is_null() {
        anyhow::bail!("request_json is null");
    }

    let request = CStr::from_ptr(request_json)
        .to_str()
        .context("request_json is not valid UTF-8")?;
    let request: InstallRequest =
        serde_json::from_str(request).context("invalid install request JSON")?;
    let progress = FfiProgress {
        callback,
        user_data,
    };

    install_mods_with_progress(&progress, request)?;
    set_out(response_json, r#"{"ok":true}"#.to_string());
    Ok(())
}

unsafe fn command_entry<T, R, F>(
    request_json: *const c_char,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
    handler: F,
) -> i32
where
    T: DeserializeOwned,
    R: Serialize,
    F: FnOnce(T) -> Result<R>,
{
    clear_out(response_json);
    clear_out(error_message);

    match catch_unwind(AssertUnwindSafe(|| {
        if request_json.is_null() {
            anyhow::bail!("request_json is null");
        }
        let request = CStr::from_ptr(request_json)
            .to_str()
            .context("request_json is not valid UTF-8")?;
        let request: T = serde_json::from_str(request).context("invalid request JSON")?;
        let response = handler(request)?;
        let response = serde_json::to_string(&response).context("failed to serialize response")?;
        set_out(response_json, response);
        Ok(())
    })) {
        Ok(Ok(())) => 0,
        Ok(Err(error)) => {
            set_out(error_message, format!("{error:#}"));
            1
        }
        Err(_) => {
            set_out(error_message, "integrator panic".to_string());
            2
        }
    }
}

unsafe fn clear_out(target: *mut *mut c_char) {
    if !target.is_null() {
        *target = ptr::null_mut();
    }
}

unsafe fn set_out(target: *mut *mut c_char, value: String) {
    if !target.is_null() {
        *target = string_to_c(value).into_raw();
    }
}

fn string_to_c(value: String) -> CString {
    CString::new(value).unwrap_or_else(|error| {
        let bytes = error
            .into_vec()
            .into_iter()
            .filter(|byte| *byte != 0)
            .collect::<Vec<_>>();
        CString::new(bytes).expect("nul bytes were removed")
    })
}
