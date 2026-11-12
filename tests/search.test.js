import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { searchMessages, buildSearchResultsScript } from '../search.js';

function fixture(outcome) {
    const dom = new JSDOM('<div class="searchBar_example"><div role="combobox" contenteditable="true" tabindex="0"></div></div><div class="searchResult_example"><div id="message-content-outside">Not a search result</div></div>', { runScripts: 'outside-only' });
    const { document } = dom.window;
    const input = document.querySelector('[role="combobox"]');
    let submitted = 0;
    let escaped = 0;
    const page = {
        async evaluate(script) { return dom.window.eval(script); },
        async wait() {},
        async insertText(text) {
            input.innerHTML = '<span class="searchToken_example">in:synthetic-channel</span>';
            input.append(` ${text}`);
        },
        async pressKey(key) {
            if (key === 'Escape') escaped++;
            if (key !== 'Enter') return;
            submitted++;
            const panel = document.createElement('section'); panel.className = 'searchResultsWrap_example';
            if (outcome === 'found') panel.innerHTML = '<div class="searchResult_example"><span class="username_example">Synthetic Author</span><div id="message-content-123">Synthetic query</div></div>';
            if (outcome === 'empty') panel.innerHTML = '<div class="emptyResultsWrap_example"><div class="noResults_example">我们已掘地三尺，但是一无所获</div></div>';
            if (outcome === 'loading') panel.innerHTML = '<div role="progressbar"></div>';
            document.body.append(panel);
        },
    };
    return { dom, page, submitted: () => submitted, escaped: () => escaped };
}

test('search supports contenteditable and channel tokens, scoped to the result panel', async t => {
    const f = fixture('found'); t.after(() => f.dom.window.close());
    const rows = await searchMessages(f.page, { query: 'Synthetic query' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].Message, 'Synthetic query');
    assert.equal(f.submitted(), 1);
    assert.equal(f.escaped(), 1);
});

test('search distinguishes empty results from loading and closes on both failures', async t => {
    for (const [outcome, code] of [['empty', 'EMPTY_RESULT'], ['loading', 'TIMEOUT']]) {
        const f = fixture(outcome); t.after(() => f.dom.window.close());
        await assert.rejects(searchMessages(f.page, { query: 'Synthetic query' }), { code });
        assert.equal(f.escaped(), 1);
    }
});

test('search does not report unrelated page-wide empty text as an empty result', () => {
    const dom = new JSDOM('<p>No results</p><section class="searchResultsWrap_example"></section>', { runScripts: 'outside-only' });
    assert.equal(dom.window.eval(buildSearchResultsScript()).empty, false);
    dom.window.close();
});
