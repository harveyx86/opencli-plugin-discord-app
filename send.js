// Adapted from OpenCLI before Electron removal (Apache-2.0); see NOTICE.
import { discordCommand as cli, Strategy } from './lib/connection.js';
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export async function sendMessage(page, args) {
    const text = args.text;
    if (typeof text !== 'string' || !text.trim()) throw new ArgumentError('Message text must not be empty.');
    const before = await page.evaluate(`(() => {
        const path = location.pathname;
        if (!/^\\/channels\\/(?:@me|[0-9]+)\\/[0-9]+(?:\\/[0-9]+)?$/.test(path)) throw new Error('Open the intended Discord channel first.');
        const editors = [...document.querySelectorAll('[role="textbox"][data-slate-editor="true"], [class*="slateTextArea"][contenteditable="true"]')].filter(el => el.getClientRects().length);
        if (editors.length !== 1 || document.querySelector('[role="dialog"]')) throw new Error('Expected one message composer and no open dialog.');
        const editor = editors[0];
        if ((editor.textContent || '').trim()) throw new Error('The composer contains a draft; clear or send it manually first.');
        const ids = [...document.querySelectorAll('[id^="chat-messages-"]')].map(el => el.id);
        editor.focus();
        if (!document.execCommand('insertText', false, ${JSON.stringify(text)})) throw new Error('Could not insert the message.');
        return { path, ids };
    })()`);
    // A changed channel or composer must not receive the Enter key.
    const ready = await page.evaluate(`(() => {
        const editor = document.activeElement;
        return location.pathname === ${JSON.stringify(before.path)} && !document.querySelector('[role="dialog"]') &&
            editor?.matches('[role="textbox"][data-slate-editor="true"], [class*="slateTextArea"][contenteditable="true"]') &&
            (editor.textContent || '').replace(/\\r\\n/g, '\\n') === ${JSON.stringify(text.replace(/\r\n/g, '\n'))};
    })()`);
    if (!ready) throw new CommandExecutionError('Channel/composer changed before sending. Review the draft manually; nothing was submitted by this command.');
    try {
        await page.pressKey('Enter');
        for (let attempt = 0; attempt < 20; attempt++) {
            const observed = await page.evaluate(`(() => {
                if (location.pathname !== ${JSON.stringify(before.path)}) return false;
                const oldIds = new Set(${JSON.stringify(before.ids)});
                const normalize = value => value.replace(/\\s+/g, ' ').trim();
                return [...document.querySelectorAll('[id^="chat-messages-"]')].some(el =>
                    /^chat-messages-[0-9]+-[0-9]+$/.test(el.id) && !oldIds.has(el.id) &&
                    normalize(el.querySelector('[id^="message-content-"]')?.textContent || '') === normalize(${JSON.stringify(text)}) &&
                    !/sending|failed/i.test(el.className));
            })()`);
            if (observed) return [{ Status: 'Success' }];
            await page.wait(0.25);
        }
    } catch (error) {
        throw new CommandExecutionError(`Send outcome is uncertain: ${error.message}`, 'Check Discord before retrying; the message may already have been sent.');
    }
    throw new CommandExecutionError('Send outcome is uncertain: no new matching message was observed.', 'Check Discord before retrying; no automatic retry was attempted.');
}

export const sendCommand = cli({
    site: 'discord-app', name: 'send', access: 'write',
    description: 'Send a message in the active Discord channel', domain: 'localhost',
    strategy: Strategy.UI, browser: true,
    args: [{ name: 'text', required: true, positional: true, help: 'Message to send' }],
    columns: ['Status'], func: sendMessage,
});
