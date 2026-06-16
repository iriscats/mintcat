import { invoke } from '@tauri-apps/api/core';

export class ControlPlaneApi {
    static invoke<T = unknown>(command: string, payload: Record<string, unknown> = {}): Promise<T> {
        return invoke<T>('control_plane_invoke', {
            request: {
                command,
                payload,
            },
        });
    }
}
