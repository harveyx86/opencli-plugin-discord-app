import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { getRegistry } from '@jackwener/opencli/registry';
import { connectDiscord, endpointUrl, discordUrl } from '../lib/connection.js';
import { buildReadMessagesScript, buildListChannelsScript, parsePositiveInt, parseDiscordChannelUrl, assertDiscordMessageRowsBelongToTarget } from '../lib/utils.js';

for (const name of ['status', 'servers', 'channels', 'members', 'read', 'search', 'goto', 'threads', 'thread-read', 'send', 'delete']) await import(`../${name}.js`);

test('eleven commands register without the removed Electron host', () => {
    const commands = [...getRegistry().values()].filter(c => c.site === 'discord-app');
    assert.equal(commands.length, 11);
    assert.ok(commands.every(c => c.browser === false && c.strategy === 'local'));
    assert.deepEqual(commands.filter(c => c.access === 'write').map(c => c.name).sort(), ['delete', 'send']);
});

test('all command names, access, arguments and columns match the pre-removal commit', () => {
    const baseline = JSON.parse(readFileSync(new URL('./fixtures/upstream-surface.json', import.meta.url)));
    const fields = ['name', 'type', 'required', 'positional', 'default'];
    const actual = [...getRegistry().values()].filter(c => c.site === 'discord-app').map(c => ({
        name: c.name, access: c.access, columns: c.columns,
        args: c.args.map(a => Object.fromEntries(fields.filter(k => a[k] !== undefined).map(k => [k, a[k]]))),
    })).sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(actual, baseline.commands);
});

test('reject remote endpoints, deceptive Discord URLs and invalid counts', () => {
    for (const url of ['https://127.0.0.1:9232', 'http://example.com:9232', 'http://user:pass@localhost:9232', 'http://localhost:9232/path']) {
        assert.throws(() => endpointUrl(url), { code: 'ARGUMENT' });
    }
    assert.equal(endpointUrl('http://127.0.0.1:9232').port, '9232');
    assert.equal(discordUrl('https://discord.com.evil.test/channels/@me'), false);
    assert.equal(parseDiscordChannelUrl('javascript://discord.com/channels/123/456'), null);
    for (const count of ['0', '-1', '2.5', 'Infinity', '9007199254740992']) assert.throws(() => parsePositiveInt(count, 20, 'count'));
    assert.equal(parsePositiveInt('3', 20, 'count'), 3);
});

test('message extraction keeps full text, deduplicates IDs, and enforces target identity', () => {
    const message = 'synthetic message '.repeat(40);
    const node = {
        getAttribute: () => 'chat-messages-123-456',
        querySelector(selector) {
            if (selector.startsWith('[id^="message-content')) return { textContent: message };
            if (selector.startsWith('[class*="username')) return { textContent: 'Synthetic Author' };
            if (selector === 'time') return { getAttribute: () => '2026-11-12T00:00:00Z' };
            return null;
        },
    };
    const rows = JSON.parse(JSON.stringify(vm.runInNewContext(buildReadMessagesScript(20), {
        document: { querySelectorAll: () => [node, node] },
    })));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].Message, message.trim());
    assert.deepEqual(Object.keys(rows[0]), ['Author', 'Time', 'Message', 'channel_id', 'message_id']);
    assertDiscordMessageRowsBelongToTarget(rows, { channel_id: '123' });
    assert.throws(() => assertDiscordMessageRowsBelongToTarget(rows, { channel_id: '999' }), { code: 'COMMAND_EXEC' });
});

test('sidebar extraction distinguishes direct messages from server text channels', () => {
    const links = ['/channels/@me/123', '/channels/456/789'].map(href => ({
        textContent: 'Synthetic conversation',
        getAttribute: name => name === 'href' ? href : '',
    }));
    const rows = JSON.parse(JSON.stringify(vm.runInNewContext(buildListChannelsScript(), {
        URL, document: { querySelectorAll: () => links },
    })));
    assert.equal(rows[0].Type, 'DirectMessage');
    assert.equal(rows[0].guild_id, '@me');
    assert.equal(rows[1].Type, 'Text');
});

test('production command path connects, handles errors, and closes the socket', async t => {
    const originalFetch = globalThis.fetch;
    const originalWebSocket = globalThis.WebSocket;
    let response;
    let closed = 0;
    let replyError = false;
    let unexpectedClose = false;
    const sent = [];
    class FakeSocket extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
        send(payload) {
            const request = JSON.parse(payload);
            sent.push(request);
            queueMicrotask(() => {
                if (unexpectedClose) return this.close();
                const value = request.params.expression === 'document.title' ? 'Synthetic Discord' : 'https://discord.com/channels/@me';
                const result = replyError ? { exceptionDetails: { text: 'Synthetic JS error' } } : { result: { value } };
                this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id: request.id, result }) }));
            });
        }
        close() { closed++; this.readyState = 3; this.dispatchEvent(new Event('close')); }
    }
    globalThis.WebSocket = FakeSocket;
    globalThis.fetch = async () => ({ ok: true, json: async () => response });
    t.after(() => { globalThis.fetch = originalFetch; globalThis.WebSocket = originalWebSocket; });
    response = [{ type: 'page', url: 'https://discord.com/channels/@me', webSocketDebuggerUrl: 'ws://127.0.0.1:9232/devtools/page/test' }];
    const command = getRegistry().get('discord-app/status');
    const rows = await command.func({});
    assert.equal(rows[0].Status, 'Connected');
    assert.equal(closed, 1);
    replyError = true;
    await assert.rejects(command.func({}), { code: 'COMMAND_EXEC' });
    assert.equal(closed, 2);
    replyError = false;
    unexpectedClose = true;
    await assert.rejects(command.func({}), { code: 'BROWSER_CONNECT' });
    unexpectedClose = false;
    const page = await connectDiscord('http://127.0.0.1:9232');
    await assert.rejects(page.goto('https://example.com'), { code: 'ARGUMENT' });
    await page.pressKey('Meta+F');
    assert.deepEqual(sent.slice(-2).map(item => item.params.type), ['keyDown', 'keyUp']);
    page.close();
    response = [response[0], response[0]];
    await assert.rejects(connectDiscord('http://127.0.0.1:9232'), { code: 'BROWSER_CONNECT' });
    response = [{ type: 'page', url: 'https://example.com', webSocketDebuggerUrl: 'ws://127.0.0.1:9232/test' }];
    await assert.rejects(connectDiscord('http://127.0.0.1:9232'), { code: 'BROWSER_CONNECT' });
    response = [{ type: 'page', url: 'https://discord.com', webSocketDebuggerUrl: 'ws://example.com:9232/test' }];
    await assert.rejects(connectDiscord('http://127.0.0.1:9232'), { code: 'COMMAND_EXEC' });
});
