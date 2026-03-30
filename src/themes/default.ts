import {theme as antdTheme, type ThemeConfig} from "antd";

import type {ThemePackageSummary} from "@/types/ThemePackage.ts";

const THEME_LINK_ID = "theme-package-style";

export const getDefaultTheme = (): ThemeConfig => {
    return {
        token: {
            colorPrimary: "#804bcc",
        },
        components: {
            Layout: {
                bodyBg: "transparent",
                footerBg: "transparent",
                headerBg: "transparent",
                siderBg: "transparent",
            },
        },
    };
};

function resetThemeDocumentState(): void {
    document.documentElement.classList.remove("dark-theme");
    document.body.classList.remove("dark-theme");
    document.documentElement.removeAttribute("data-theme-package");
}

export async function renderTheme(themePackage?: ThemePackageSummary, cssHref?: string | null): Promise<ThemeConfig> {
    const existingLink = document.getElementById(THEME_LINK_ID);
    if (existingLink) {
        existingLink.remove();
    }

    resetThemeDocumentState();

    const nextTheme = getDefaultTheme();
    if (!themePackage) {
        return nextTheme;
    }

    if (themePackage.tokens?.colorPrimary) {
        nextTheme.token = {
            ...nextTheme.token,
            colorPrimary: themePackage.tokens.colorPrimary,
        };
    }

    if (themePackage.tokens?.mode === "dark") {
        nextTheme.algorithm = antdTheme.darkAlgorithm;
        document.documentElement.classList.add("dark-theme");
        document.body.classList.add("dark-theme");
    }

    document.documentElement.setAttribute("data-theme-package", themePackage.id);

    if (cssHref) {
        const link = document.createElement("link");
        link.id = THEME_LINK_ID;
        link.rel = "stylesheet";
        link.href = cssHref;
        document.head.appendChild(link);
    }

    return nextTheme;
}
