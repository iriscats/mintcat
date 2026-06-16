import { invoke } from '@tauri-apps/api/core';

export class BackendRuntimeApi {
    static invoke<T = unknown>(command: string, payload: Record<string, unknown> = {}): Promise<T> {
        return invoke<T>('backend_invoke', { command, payload });
    }
}
