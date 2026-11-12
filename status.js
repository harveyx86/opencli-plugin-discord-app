// Adapted from @jackwener/opencli 1.8.8 (Apache-2.0); see NOTICE.
import { discordCommand as cli, Strategy } from './lib/connection.js';
export const statusCommand = cli({
    site: 'discord-app',
    name: 'status',
    access: 'read',
    description: 'Check active CDP connection to Discord Desktop',
    domain: 'localhost',
    strategy: Strategy.UI,
    browser: true,
    args: [],
    columns: ['Status', 'Url', 'Title'],
    func: async (page) => {
        const url = await page.evaluate('window.location.href');
        const title = await page.evaluate('document.title');
        return [{ Status: 'Connected', Url: url, Title: title }];
    },
});
