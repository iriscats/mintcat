import {ThemeConfig} from "antd";

export const defaultTheme :ThemeConfig= {
    token:{
        colorPrimary: "#FFFFFF",
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
        case "Light": {
            defaultTheme.token.colorPrimary = "#1677FF";
            link.href = '/src/themes/light-theme.css';
        }
            break;
        case "Dark": {
            defaultTheme.token.colorPrimary = "#1677FF";
            link.href = '/src/themes/dark-theme.css';
        }
            break;
        case "Pink":
            defaultTheme.token.colorPrimary = "#ff69b4";
            link.href = '/src/themes/pink-theme.css';
            break;
    }
    document.head.appendChild(link);


}



