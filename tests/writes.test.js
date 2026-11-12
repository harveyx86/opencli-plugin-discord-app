import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { sendMessage } from '../send.js';
import { buildDeleteScript } from '../delete.js';

function dom(html) {
    const result = new JSDOM(html, { url: 'https://discord.com/channels/111/222', runScripts: 'outside-only' });
    result.window.setTimeout = callback => { queueMicrotask(callback); return 1; };
    return result;
}

function sendFixture({ draft = '', deliver = true, changeChannel = false, attachment = false } = {}) {
    const fixture = dom('<form><div tabindex="0" role="textbox" data-slate-editor="true" contenteditable="true"></div></form>');
    const { document } = fixture.window;
    const editor = document.querySelector('[role="textbox"]');
    editor.getClientRects = () => [{}];
    editor.textContent = draft;
    if (attachment) editor.parentElement.insertAdjacentHTML('beforeend', '<div class="uploadContainer">Synthetic attachment.pdf</div>');
    document.execCommand = (_, __, text) => { editor.textContent += text; return true; };
    let enterCount = 0;
    let evaluationCount = 0;
    const page = {
        async insertText(text) { document.execCommand('insertText', false, text); },
        async evaluate(script) {
            if (changeChannel && ++evaluationCount === 2) fixture.window.history.pushState({}, '', '/channels/111/333');
            return fixture.window.eval(script);
        },
        async pressKey(key) {
            assert.equal(key, 'Enter');
            enterCount++;
            if (deliver) {
                const node = document.createElement('li');
                node.id = 'chat-messages-222-999';
                const content = document.createElement('div');
                content.id = 'message-content-999';
                content.textContent = editor.textContent;
                node.append(content);
                document.body.append(node);
                editor.textContent = '';
            }
        },
        async wait() {},
    };
    return { page, fixture, editor, enterCount: () => enterCount };
}

test('send observes a new full message and submits exactly once', async t => {
    const f = sendFixture(); t.after(() => f.fixture.window.close());
    const rows = await sendMessage(f.page, { text: 'Synthetic "message"\n第二行' });
    assert.deepEqual(rows, [{ Status: 'Success' }]);
    assert.equal(f.enterCount(), 1);
});

test('send preserves an existing draft and refuses channel drift', async t => {
    const draft = sendFixture({ draft: 'Existing draft' }); t.after(() => draft.fixture.window.close());
    await assert.rejects(sendMessage(draft.page, { text: 'new' }), /draft/);
    assert.equal(draft.editor.textContent, 'Existing draft');
    assert.equal(draft.enterCount(), 0);
    const changed = sendFixture({ changeChannel: true }); t.after(() => changed.fixture.window.close());
    await assert.rejects(sendMessage(changed.page, { text: 'new' }), /changed/);
    assert.equal(changed.enterCount(), 0);
});

test('send never reports success or retries when delivery is unconfirmed', async t => {
    const f = sendFixture({ deliver: false }); t.after(() => f.fixture.window.close());
    await assert.rejects(sendMessage(f.page, { text: 'new' }), /uncertain/);
    assert.equal(f.enterCount(), 1);
});

test('send accepts Discord empty file input without treating it as a draft', async t => {
    const f = sendFixture(); t.after(() => f.fixture.window.close());
    f.editor.parentElement.insertAdjacentHTML('beforeend', '<div class="uploadInput_example"><input type="file"></div>');
    const rows = await sendMessage(f.page, { text: 'Synthetic message' });
    assert.equal(rows[0].Status, 'Success');
    assert.equal(f.enterCount(), 1);
});

test('send refuses an attachment-only draft without pressing Enter', async t => {
    const f = sendFixture({ attachment: true }); t.after(() => f.fixture.window.close());
    await assert.rejects(sendMessage(f.page, { text: 'new' }), /attachment draft/);
    assert.equal(f.enterCount(), 0);
    assert.equal(f.editor.textContent, '');
});

function deleteFixture({ removeMessage = true, withToolbar = true, preexistingDialog = false } = {}) {
    const fixture = dom(`<li id="chat-messages-222-999">Synthetic target${withToolbar ? '<div class="toolbar"><button aria-label="More">More</button></div>' : ''}</li><button type="submit" id="unrelated">Unrelated submit</button>`);
    const { document } = fixture.window;
    const target = document.getElementById('chat-messages-222-999');
    let confirmed = 0;
    let unrelated = 0;
    document.getElementById('unrelated').onclick = () => unrelated++;
    if (preexistingDialog) document.body.insertAdjacentHTML('beforeend', '<div role="dialog"><button>Delete</button></div>');
    const more = target.querySelector('button');
    if (more) more.onclick = () => {
        const menu = document.createElement('div'); menu.setAttribute('role', 'menu');
        menu.innerHTML = '<div role="menuitem" id="message-actions-delete">Delete Message</div>';
        document.body.append(menu);
        menu.firstElementChild.onclick = () => {
            menu.remove();
            const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog');
            dialog.innerHTML = '<h2>Delete Message</h2><button>Delete</button>';
            document.body.append(dialog);
            dialog.querySelector('button').onclick = () => {
                confirmed++;
                if (removeMessage) { target.remove(); dialog.remove(); }
            };
        };
    };
    return { fixture, confirmed: () => confirmed, unrelated: () => unrelated };
}

test('delete confirms only inside its dialog and verifies removal', async t => {
    const f = deleteFixture(); t.after(() => f.fixture.window.close());
    const result = await f.fixture.window.eval(buildDeleteScript('999'));
    assert.equal(result.ok, true);
    assert.equal(f.confirmed(), 1);
    assert.equal(f.unrelated(), 0);
});

test('delete fails closed for missing target, missing toolbar, or existing dialog', async t => {
    for (const options of [{}, { withToolbar: false }, { preexistingDialog: true }]) {
        const f = deleteFixture(options); t.after(() => f.fixture.window.close());
        const result = await f.fixture.window.eval(buildDeleteScript(Object.keys(options).length ? '999' : '123'));
        assert.equal(result.ok, false);
        assert.equal(f.confirmed(), 0);
        assert.equal(f.unrelated(), 0);
    }
});

test('delete reports uncertainty without retrying when removal is not observed', async t => {
    const f = deleteFixture({ removeMessage: false }); t.after(() => f.fixture.window.close());
    const result = await f.fixture.window.eval(buildDeleteScript('999'));
    assert.equal(result.ok, false);
    assert.equal(result.uncertain, true);
    assert.equal(f.confirmed(), 1);
});
