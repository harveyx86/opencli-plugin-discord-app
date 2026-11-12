import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, BrowserConnectError, CommandExecutionError, TimeoutError } from '@jackwener/opencli/errors';

export { Strategy };
const hosts = new Set(['discord.com', 'canary.discord.com', 'ptb.discord.com']);
const loopback = new Set(['127.0.0.1', 'localhost', '[::1]']);
const timeoutMs = 10000;

export function discordUrl(raw) {
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' && hosts.has(url.hostname);
    } catch { return false; }
}

export function endpointUrl(raw) {
    let url;
    try { url = new URL(raw); } catch { throw new ArgumentError('CDP endpoint must be a local HTTP URL.'); }
    if (url.protocol !== 'http:' || !loopback.has(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        throw new ArgumentError('CDP endpoint must be http://127.0.0.1:<port> (localhost or ::1 also supported).');
    }
    return url;
}

export async function connectDiscord(endpoint = process.env.OPENCLI_CDP_ENDPOINT || 'http://127.0.0.1:9232') {
    const base = endpointUrl(endpoint);
    let targets;
    try {
        const response = await fetch(new URL('/json/list', base), { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        targets = await response.json();
    } catch (error) {
        throw new BrowserConnectError(`Cannot reach Discord CDP: ${error.message}`, 'Start Discord with --remote-debugging-port=9232 and check OPENCLI_CDP_ENDPOINT.');
    }
    if (!Array.isArray(targets)) throw new CommandExecutionError('CDP target list is not an array.');
    const pages = targets.filter(target => target.type === 'page' && discordUrl(target.url));
    if (pages.length !== 1) throw new BrowserConnectError(`Expected one Discord page, found ${pages.length}.`, 'Open Discord and close extra Discord windows before retrying.');
    let wsUrl;
    try { wsUrl = new URL(pages[0].webSocketDebuggerUrl); } catch { throw new CommandExecutionError('Discord target has no valid WebSocket URL.'); }
    if (wsUrl.protocol !== 'ws:' || !loopback.has(wsUrl.hostname) || wsUrl.port !== base.port || wsUrl.username || wsUrl.password) {
        throw new CommandExecutionError('Discord target WebSocket must use the same local CDP port.');
    }
    const socket = new WebSocket(wsUrl);
    let nextId = 0;
    const pending = new Map();
    const rejectPending = () => {
        for (const item of pending.values()) {
            clearTimeout(item.timer);
            item.reject(new BrowserConnectError('Discord CDP connection closed.'));
        }
        pending.clear();
    };
    socket.addEventListener('close', rejectPending);
    socket.addEventListener('error', rejectPending);
    socket.addEventListener('message', event => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        const item = pending.get(message.id);
        if (!item) return;
        pending.delete(message.id);
        clearTimeout(item.timer);
        if (message.error) item.reject(new CommandExecutionError(message.error.message));
        else item.resolve(message.result);
    });
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.close();
            reject(new TimeoutError('Discord CDP connection', timeoutMs / 1000));
        }, timeoutMs);
        socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
        const fail = () => { clearTimeout(timer); reject(new BrowserConnectError('Could not open Discord CDP WebSocket.')); };
        socket.addEventListener('error', fail, { once: true });
        socket.addEventListener('close', fail, { once: true });
    });
    function send(method, params = {}) {
        if (socket.readyState !== WebSocket.OPEN) throw new BrowserConnectError('Discord CDP connection is not open.');
        return new Promise((resolve, reject) => {
            const id = ++nextId;
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new TimeoutError(method, timeoutMs / 1000));
            }, timeoutMs);
            pending.set(id, { resolve, reject, timer });
            try { socket.send(JSON.stringify({ id, method, params })); }
            catch (error) { pending.delete(id); clearTimeout(timer); reject(new CommandExecutionError(error.message)); }
        });
    }
    return {
        async evaluate(expression) {
            const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (result.exceptionDetails) throw new CommandExecutionError(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return result.result?.value;
        },
        async goto(url, options = {}) {
            if (!discordUrl(url)) throw new ArgumentError('Navigation is restricted to Discord HTTPS URLs.');
            const result = await send('Page.navigate', { url });
            if (result.errorText) throw new CommandExecutionError(result.errorText);
            await new Promise(resolve => setTimeout(resolve, options.settleMs ?? 1000));
        },
        wait(seconds) { return new Promise(resolve => setTimeout(resolve, seconds * 1000)); },
        async pressKey(key) {
            const keys = {
                'Meta+F': { key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70, modifiers: 4 },
                'Control+F': { key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70, modifiers: 2 },
                Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
                Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
            };
            if (!keys[key]) throw new ArgumentError(`Unsupported key: ${key}`);
            await send('Input.dispatchKeyEvent', { type: 'keyDown', ...keys[key] });
            await send('Input.dispatchKeyEvent', { type: 'keyUp', ...keys[key] });
        },
        close() { rejectPending(); socket.close(); },
    };
}

// Keep upstream command bodies unchanged while replacing its removed Electron launcher.
export function discordCommand(options) {
    return cli({
        ...options,
        strategy: Strategy.LOCAL,
        browser: false,
        async func(args) {
            const page = await connectDiscord();
            try {
                if (!discordUrl(await page.evaluate('window.location.href'))) throw new CommandExecutionError('Target navigated away from Discord.');
                return await options.func(page, args);
            } finally { page.close(); }
        },
    });
}
