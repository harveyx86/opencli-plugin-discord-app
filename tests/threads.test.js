import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildListThreadsScript, buildRouteStateScript, parseDiscordChannelUrl, resolveDiscordThreadTarget, navigateToDiscordTarget } from '../lib/utils.js';

test('forum cards expose stable thread identity and the current /threads/ route', () => {
    const dom = new JSDOM('<div data-item-id="333" class="mainCard_example"><h3 class="postTitleText_example">Synthetic post</h3><span class="author_example">Synthetic author</span><div id="message-content-333">Synthetic preview</div></div>', {
        url: 'https://discord.com/channels/111/222', runScripts: 'outside-only',
    });
    const rows = JSON.parse(JSON.stringify(dom.window.eval(buildListThreadsScript(3))));
    assert.deepEqual(rows, [{ Index: 1, Thread: 'Synthetic post', Author: 'Synthetic author', Updated: '', Preview: 'Synthetic preview', guild_id: '111', channel_id: '222', thread_id: '333', url: 'https://discord.com/channels/111/222/threads/333' }]);
    dom.window.close();
});

test('current and legacy thread URL inputs normalize to the observed route', async () => {
    for (const url of ['https://discord.com/channels/111/222/threads/333', 'https://discord.com/channels/111/222/333']) {
        const parsed = parseDiscordChannelUrl(url);
        assert.equal(parsed.thread_id, '333');
        assert.equal(parsed.url, 'https://discord.com/channels/111/222/threads/333');
        const target = await resolveDiscordThreadTarget({}, { url });
        assert.equal(target.thread_id, '333');
    }
});

test('thread navigation waits for the correct /threads/ route and messages', async () => {
    const url = 'https://discord.com/channels/111/222/threads/333';
    const dom = new JSDOM('<li id="chat-messages-333-444"></li>', { url, runScripts: 'outside-only' });
    const state = JSON.parse(JSON.stringify(dom.window.eval(buildRouteStateScript())));
    assert.equal(state.route.thread_id, '333');
    const navigations = [];
    const page = { async goto(url) { navigations.push(url); }, async evaluate() { return state; }, async wait() {} };
    const target = await resolveDiscordThreadTarget(page, { guild: '111', channel: '222', thread: '333' });
    await navigateToDiscordTarget(page, target, { waitForContent: 'messages' });
    assert.deepEqual(navigations, [url]);
    dom.window.close();
});
