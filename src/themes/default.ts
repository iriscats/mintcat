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
    if (theme === "Light") {
        window.document.documentElement.style.filter = "none";
        // Remove dark mode style tag if exists
        const darkStyle = document.getElementById('dark-theme-style');
        darkStyle?.remove();
    } else if (theme === "Dark") {
        window.document.documentElement.style.filter = "invert(100%)";
        // Create new style element with unique ID
        const style = document.createElement('style');
        style.id = 'dark-theme-style';
        style.textContent = 'img { filter: brightness(0.8) invert(100%); }';
        document.head.appendChild(style);
    }

}

try {
    listen("theme-change", (event) => {
        renderTheme();
    }).then();

}catch(_) {

}


