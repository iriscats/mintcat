use crate::capability::hook_resolvers;
use crate::capability::ue_hook_lib::{
    FMalloc, FnFFrameStep, FnFFrameStepExplicitProperty, FnFNameCtorWchar, FnFNameToString,
    FnUObjectBaseUtilityGetPathName, TArray,
};
use crate::mod_info::Meta;

#[repr(C)]
pub struct USaveGame;

pub type FnSaveGameToMemory = unsafe extern "system" fn(*const USaveGame, *mut TArray<u8>) -> bool;

pub type FnLoadGameFromMemory = unsafe extern "system" fn(*const TArray<u8>) -> *const USaveGame;

pub(crate) static mut GLOBALS: Option<Globals> = None;
thread_local! {
   pub(crate) static LOG_GUARD: std::cell::RefCell<Option<tracing_appender::non_blocking::WorkerGuard>>  = None.into();
}

pub struct Globals {
    pub(crate) resolution: hook_resolvers::HookResolution,
    pub(crate) meta: Meta
}

impl Globals {
    pub fn gmalloc(&self) -> &FMalloc {
        unsafe { &**(self.resolution.core.as_ref().unwrap().gmalloc.0 as *const *const FMalloc) }
    }
    pub fn fframe_step(&self) -> FnFFrameStep {
        unsafe { std::mem::transmute(self.resolution.core.as_ref().unwrap().fframe_step.0) }
    }
    pub fn fframe_step_explicit_property(&self) -> FnFFrameStepExplicitProperty {
        unsafe {
            std::mem::transmute(
                self.resolution
                    .core
                    .as_ref()
                    .unwrap()
                    .fframe_step_explicit_property
                    .0,
            )
        }
    }
    pub fn fname_to_string(&self) -> FnFNameToString {
        unsafe { std::mem::transmute(self.resolution.core.as_ref().unwrap().fnametostring.0) }
    }
    pub fn fname_ctor_wchar(&self) -> FnFNameCtorWchar {
        unsafe { std::mem::transmute(self.resolution.core.as_ref().unwrap().fname_ctor_wchar.0) }
    }
    pub fn uobject_base_utility_get_path_name(&self) -> FnUObjectBaseUtilityGetPathName {
        unsafe {
            std::mem::transmute(
                self.resolution
                    .core
                    .as_ref()
                    .unwrap()
                    .uobject_base_utility_get_path_name
                    .0,
            )
        }
    }
    pub fn save_game_to_memory(&self) -> FnSaveGameToMemory {
        unsafe {
            std::mem::transmute(
                self.resolution
                    .save_game
                    .as_ref()
                    .unwrap()
                    .save_game_to_memory
                    .0,
            )
        }
    }
    pub fn load_game_from_memory(&self) -> FnLoadGameFromMemory {
        unsafe {
            std::mem::transmute(
                self.resolution
                    .save_game
                    .as_ref()
                    .unwrap()
                    .load_game_from_memory
                    .0,
            )
        }
    }
}

pub fn globals() -> &'static Globals {
    #[allow(static_mut_refs)]
    unsafe {
        GLOBALS.as_ref().unwrap()
    }
}
