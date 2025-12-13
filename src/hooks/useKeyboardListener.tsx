import { useEffect } from 'react';

/**
 * Hook for registering keyboard event listeners on the window object
 * @param handler - The keyboard event handler function
 * @param options - Options for addEventListener (optional)
 */
export const useKeyboardListener = (
    handler: (event: KeyboardEvent) => void,
    options?: AddEventListenerOptions
) => {
    useEffect(() => {
        // Add the keyboard event listener
        window.addEventListener('keydown', handler, options);

        // Cleanup function to remove the listener
        return () => {
            window.removeEventListener('keydown', handler, options);
        };
    }, [handler, options]);
};

/**
 * Hook for registering keyboard shortcuts with specific key combinations
 * @param shortcut - The keyboard shortcut combination (e.g., 'ctrl+f', 'alt+a')
 * @param callback - Callback function to execute when shortcut is triggered
 * @param enabled - Whether the shortcut is enabled (default: true)
 */
export const useKeyboardShortcut = (
    shortcut: string,
    callback: () => void,
    enabled: boolean = true
) => {
    useEffect(() => {
        if (!enabled) return;

        const parseShortcut = (shortcutStr: string) => {
            const parts = shortcutStr.toLowerCase().split('+');
            const modifiers = new Set(parts.slice(0, -1));
            const key = parts[parts.length - 1];

            return {
                ctrlKey: modifiers.has('ctrl'),
                altKey: modifiers.has('alt'),
                shiftKey: modifiers.has('shift'),
                metaKey: modifiers.has('meta'),
                key,
            };
        };

        const shortcutConfig = parseShortcut(shortcut);

        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if the pressed key matches
            if (event.key.toLowerCase() !== shortcutConfig.key) return;

            // Check if all required modifiers are pressed
            const ctrlMatch = shortcutConfig.ctrlKey === event.ctrlKey;
            const altMatch = shortcutConfig.altKey === event.altKey;
            const shiftMatch = shortcutConfig.shiftKey === event.shiftKey;
            const metaMatch = shortcutConfig.metaKey === event.metaKey;

            if (ctrlMatch && altMatch && shiftMatch && metaMatch) {
                event.preventDefault();
                callback();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [shortcut, callback, enabled]);
};
