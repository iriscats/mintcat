export const UE4SS_SETTING_ENABLED = "Enabled";
export const UE4SS_SETTING_DISABLED = "Disabled";

export type Ue4ssSetting = typeof UE4SS_SETTING_ENABLED | typeof UE4SS_SETTING_DISABLED;

export function normalizeUe4ssSetting(value?: string | null): Ue4ssSetting {
    return value === UE4SS_SETTING_DISABLED ? UE4SS_SETTING_DISABLED : UE4SS_SETTING_ENABLED;
}

export function isUe4ssEnabled(value?: string | null): boolean {
    return normalizeUe4ssSetting(value) === UE4SS_SETTING_ENABLED;
}
