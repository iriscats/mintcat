import {warn, debug, trace, info, error} from '@tauri-apps/plugin-log';


function InitLog() {
    try {
        function forwardConsole(
            fnName: 'log' | 'debug' | 'info' | 'warn' | 'error',
            logger: (message: string) => Promise<void>
        ) {
            const original = console[fnName];
            console[fnName] = (message) => {
                if (message === null) {
                    message = "null";
                } else if (message === undefined) {
                    message = "undefined";
                }
                original(message);
                logger(message).then(_ => {
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

