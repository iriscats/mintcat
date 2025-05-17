import {ThemeConfig} from "antd";

export const getDefaultTheme = (): ThemeConfig => {
    return {
        token: {
            colorPrimary: "#1677FF",
        },
        components: {
            Layout: {
                bodyBg: 'transparent',
                footerBg: 'transparent',
                headerBg: 'transparent',
                siderBg: 'transparent'
            },
        }
    }
}


export function renderTheme(theme: string = undefined) {
    const existingLink = document.getElementById('theme-style');

    if (!theme) {
        theme = localStorage.getItem('theme');
    }

    // 移除旧样式
    if (existingLink) {
        existingLink.remove();
    }

    const link = document.createElement('link');
    link.id = 'theme-style';
    link.rel = 'stylesheet';

    const defaultTheme = getDefaultTheme();
    switch (theme) {
        case "Dark": {
            defaultTheme.token.colorPrimary = "#1677FF";
            link.href = '/themes/dark-theme.css';
        }
            break;
        case "Pink":
            defaultTheme.token.colorPrimary = "#ff69b4";
            link.href = '/themes/pink-theme.css';
            break;
        case "Light":
        default: {
            defaultTheme.token.colorPrimary = "#1677FF";
            link.href = '/themes/light-theme.css';
        }
            break;
    }
    document.head.appendChild(link);

    return defaultTheme;
}



