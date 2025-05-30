import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import path from "path"

const host = process.env.TAURI_DEV_HOST;

const ReactCompilerConfig = {
    target: '19'
};

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [
        react({
            babel: {
                plugins: [
                    ["@babel/plugin-proposal-decorators", { legacy: true }],
                    ["babel-plugin-react-compiler", ReactCompilerConfig],
                ],
            },
        }),
    ],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,

    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host,
                port: 1421,
            }
            : undefined,
        watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },

    build: {
        target: 'esnext' // 添加此配置以支持顶层 await
    },

    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext' // 同时设置 esbuild 目标
        }
    },

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
}));
