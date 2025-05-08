import {ThemeConfig} from "antd";

export const defaultTheme: ThemeConfig = {
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
        Tree: {
            indentSize: 4
        }
    }
};

export function renderTheme() {
    const theme = localStorage.getItem('theme');
    const existingLink = document.getElementById('theme-style');

    // 移除旧样式
    if (existingLink) {
        existingLink.remove();
    }

    const link = document.createElement('link');
    link.id = 'theme-style';
    link.rel = 'stylesheet';
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


}



