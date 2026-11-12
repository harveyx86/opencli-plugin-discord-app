// Adapted from OpenCLI before Electron removal (Apache-2.0); see NOTICE.
import { discordCommand as cli, Strategy } from './lib/connection.js';
import { ArgumentError, CommandExecutionError, EmptyResultError, TimeoutError } from '@jackwener/opencli/errors';

export const searchInputSelector = '[class*="searchBar"] [contenteditable="true"][role="combobox"], input[aria-label*="Search"], [class*="searchBar"] input, input[placeholder*="Search"], input[aria-label*="搜索"], input[placeholder*="搜索"]';

export function buildSearchResultsScript() {
    return `(() => {
        const panel = document.querySelector('[class*="searchResultsWrap"]');
        if (!panel) return { items: [], empty: false };
        const busy = panel.querySelector('[role="progressbar"], [class*="searchIndexing"], [class*="loading"]');
        if (busy) return { items: [], empty: false };
        const nodes = [...panel.querySelectorAll('[class*="searchResult_"], [id*="search-result"]')];
        const items = [];
        const seen = new Set();
        for (const node of nodes) {
            const content = node.querySelector('[id^="message-content-"], [class*="messageContent"]');
            if (!content || seen.has(content)) continue;
            seen.add(content);
            items.push({
                Index: items.length + 1,
                Author: node.querySelector('[class*="username"]')?.textContent?.trim() || '—',
                Message: content.textContent?.trim() || '',
            });
        }
        const emptyPanel = panel.querySelector('[class*="emptyResults"], [class*="noResults"]');
        const empty = !!panel.querySelector('[class*="noResults"]') ||
            (!!emptyPanel && /no results|no messages match|didn't find|couldn't find|没有结果|无结果|未找到|没找到|没有找到|找不到/i.test(emptyPanel.textContent || ''));
        return { items, empty };
    })()`;
}

export async function searchMessages(page, args) {
    const query = args.query;
    if (typeof query !== 'string' || !query.trim()) throw new ArgumentError('Search query must not be empty.');
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.pressKey(`${modifier}+F`);
    await page.wait(0.5);
    try {
        await page.evaluate(`(() => {
            const input = document.querySelector(${JSON.stringify(searchInputSelector)});
            if (!input) throw new Error('Discord search input not found');
            input.focus();
        })()`);
        await page.pressKey(`${modifier}+A`);
        await page.insertText(query);
        await page.wait(0.2);
        const ready = await page.evaluate(`(() => {
            const input = document.querySelector(${JSON.stringify(searchInputSelector)});
            if (!input || document.activeElement !== input) return false;
            const copy = input.cloneNode(true);
            copy.querySelectorAll('[class*="searchToken"], [data-slate-placeholder]').forEach(el => el.remove());
            const normalize = text => text.replace(/\\uFEFF/g, '').trim();
            return normalize(input.value ?? input.textContent) === ${JSON.stringify(query.trim())} ||
                normalize(copy.textContent) === ${JSON.stringify(query.trim())};
        })()`);
        if (!ready) throw new CommandExecutionError('Discord search input changed before submission.');
        await page.pressKey('Enter');
        await page.wait(1);
        for (let attempt = 0; attempt < 30; attempt++) {
            const state = await page.evaluate(buildSearchResultsScript());
            if (!state || !Array.isArray(state.items)) throw new CommandExecutionError('Discord search returned malformed browser payload.');
            if (state.items.length) return state.items;
            if (state.empty) throw new EmptyResultError('discord-app search', 'Discord reports no results for this query.');
            await page.wait(0.5);
        }
        throw new TimeoutError('Discord search results', 15);
    } finally {
        try { await page.pressKey('Escape'); } catch { /* Do not mask the original result if CDP disconnected. */ }
    }
}

export const searchCommand = cli({
    site: 'discord-app', name: 'search', access: 'read',
    description: 'Search messages in the current Discord server/channel (Cmd+F)',
    domain: 'localhost', strategy: Strategy.UI, browser: true,
    args: [{ name: 'query', required: true, positional: true, help: 'Search query' }],
    columns: ['Index', 'Author', 'Message'], func: searchMessages,
});
