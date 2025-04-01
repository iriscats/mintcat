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

    } catch (e) {
    }
}

