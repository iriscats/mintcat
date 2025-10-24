import {warn, debug, trace, info, error} from '@tauri-apps/plugin-log';


export function InitLog() {
    try {
        function forwardConsole(
            fnName: 'log' | 'debug' | 'info' | 'warn' | 'error',
            logger: (message: string) => Promise<void>
        ) {
            const original = console[fnName];
            console[fnName] = (...args: any[]) => {
                // 转换所有参数为字符串
                let message = args.map(arg => {
                    if (arg === null) return "null";
                    if (arg === undefined) return "undefined";
                    try {
                        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                    } catch (e) {
                        return `[Unserializable: ${e}]`;
                    }
                }).join(' ');

                original.apply(console, args);
                logger(message).catch(e => {
                    console.error('Logging failed:', e);
                });
            };
        }

        forwardConsole('log', trace);
        forwardConsole('debug', debug);
        forwardConsole('info', info);
        forwardConsole('warn', warn);
        forwardConsole('error', error);

        // 添加全局异常捕获
        setupGlobalErrorHandlers();

    } catch (e) {
    }
}

function setupGlobalErrorHandlers() {
    // 捕获未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
        const errorMessage = `Unhandled Promise Rejection: ${event.reason}`;
        console.error('[Global Error]', errorMessage, event.reason);
        error(errorMessage).catch(e => {
            console.error('Failed to log unhandled rejection:', e);
        });
    });

    // 捕获同步错误
    window.addEventListener('error', (event) => {
        const errorMessage = `Global Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
        console.error('[Global Error]', errorMessage, event.error);
        error(errorMessage).catch(e => {
            console.error('Failed to log global error:', e);
        });
    });

    // 重写 window.onerror 以获得更多错误信息
    const originalOnError = window.onerror;
    window.onerror = (message: string | Event, source?: string, lineno?: number, colno?: number, err?: Error) => {
        const errorMessage = `Window Error: ${message} at ${source}:${lineno}:${colno}`;
        console.error('[Window Error]', errorMessage, err);
        error(errorMessage).catch(e => {
            console.error('Failed to log window error:', e);
        });

        // 调用原始的错误处理器（如果存在）
        if (originalOnError) {
            return originalOnError(message, source, lineno, colno, err);
        }
        return false;
    };
}

