import {listen} from "@tauri-apps/api/event";

export default {
    components: {
        Layout: {
            bodyBg: 'transparent',
            footerBg: 'transparent',
            headerBg: 'transparent',
            siderBg: 'transparent'
        },
        Tree: {
            indentSize: 8
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

    if (theme === "Light") {
        const link = document.createElement('link');
        link.id = 'theme-style';
        link.rel = 'stylesheet';
        link.href = '/src/themes/light-theme.css';
        document.head.appendChild(link);
    } else if (theme === "Dark") {
        const link = document.createElement('link');
        link.id = 'theme-style';
        link.rel = 'stylesheet';
        link.href = '/src/themes/dark-theme.css';
        document.head.appendChild(link);
    }
}


try {
    listen("theme-change", (event) => {
        renderTheme();
    }).then();

} catch (_) {

}


