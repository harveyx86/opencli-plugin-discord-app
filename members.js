// Adapted from @jackwener/opencli 1.8.8 (Apache-2.0); see NOTICE.
import { discordCommand as cli, Strategy } from './lib/connection.js';
import { EmptyResultError } from '@jackwener/opencli/errors';
export const membersCommand = cli({
    site: 'discord-app',
    name: 'members',
    access: 'read',
    description: 'List up to 50 visible members in the current Discord channel',
    domain: 'localhost',
    strategy: Strategy.UI,
    browser: true,
    args: [],
    columns: ['Index', 'Name', 'Status'],
    func: async (page) => {
        const members = await page.evaluate(`
      (function() {
        const results = [];
        // Discord member list sidebar
        const items = document.querySelectorAll('[class*="member_"], [data-list-item-id*="members"]');

        items.forEach((item, i) => {
          const nameEl = item.querySelector('[class*="username_"], [class*="nameTag"]');
          const statusEl = item.querySelector('[class*="activity"], [class*="customStatus"]');

          const name = nameEl ? nameEl.textContent.trim() : (item.textContent || '').trim().substring(0, 50);
          const status = statusEl ? statusEl.textContent.trim() : '';

          if (name && name.length > 0) {
            results.push({ Index: i + 1, Name: name, Status: status || 'Unknown' });
          }
        });

        return results.slice(0, 50); // Limit to 50
      })()
    `);
        if (members.length === 0) {
            throw new EmptyResultError('discord-app members', 'Open a channel and show its member list first.');
        }
        return members;
    },
});
