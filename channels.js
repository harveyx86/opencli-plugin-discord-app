// Adapted from @jackwener/opencli 1.8.8 (Apache-2.0); see NOTICE.
import { discordCommand as cli, Strategy } from './lib/connection.js';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { listDiscordChannels } from './lib/utils.js';

export const channelsCommand = cli({
    site: 'discord-app',
    name: 'channels',
    access: 'read',
    description: 'List visible server channels or direct-message conversations in the sidebar',
    domain: 'localhost',
    strategy: Strategy.UI,
    browser: true,
    args: [],
    columns: ['Index', 'Channel', 'Type', 'guild_id', 'channel_id', 'url'],
    func: async (page) => {
        const channels = await listDiscordChannels(page);
        if (channels.length === 0) {
            throw new EmptyResultError('discord-app channels', 'No Discord channels were found in the current server sidebar.');
        }
        return channels;
    },
});

export const __test__ = {
    channelsCommand,
};
