// Adapted from OpenCLI before Electron removal (Apache-2.0); see NOTICE.
import { discordCommand as cli, Strategy } from './lib/connection.js';
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export function buildDeleteScript(messageId) {
    return `(async () => {
      let submitted = false;
      const path = location.pathname;
      try {
          if (document.querySelector('[role="dialog"], [role="menu"]')) return { ok: false, message: 'Close existing dialogs and menus first.' };
          const messageId = ${JSON.stringify(messageId)};

          // Find the message element by its ID attribute (format: chat-messages-{channelId}-{messageId})
          const msgEl = Array.from(document.querySelectorAll('[id^="chat-messages-"]')).find(el => new RegExp('^chat-messages-[0-9]+-' + messageId + '$').test(el.id));
          if (!msgEl) {
              return { ok: false, message: 'Could not find a message with ID ' + messageId + ' in the current channel.' };
          }

          // Find the closest list item wrapper that Discord uses for messages
          const listItem = msgEl.closest('[id^="chat-messages-"]') || msgEl;

          // Hover over the message to reveal the action toolbar
          listItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          listItem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          await new Promise(r => setTimeout(r, 500));

          // Look for the "More" button in the message toolbar
          // Discord shows a toolbar with buttons when hovering over a message
          const toolbar = listItem.querySelector('[class*="toolbar"]') ||
              document.getElementById('message-actions-' + messageId);
          if (!toolbar) {
              return { ok: false, message: 'Could not find the message action toolbar. Try scrolling so the message is fully visible.' };
          }

          const buttons = Array.from(toolbar.querySelectorAll('button, [role="button"], div[class*="button"]'));
          const moreBtn = buttons.find(btn => {
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              return label === 'more' || label === 'more options' || label === '更多' || label === '更多选项';
          });
          if (!moreBtn) {
              return { ok: false, message: 'Could not find the "More" button on the message toolbar.' };
          }

          moreBtn.click();
          await new Promise(r => setTimeout(r, 500));

          // Find "Delete Message" in the context menu
          const menus = Array.from(document.querySelectorAll('[role="menu"]'));
          if (menus.length !== 1 || location.pathname !== path) return { ok: false, message: 'Message menu or channel changed.' };
          const menuItems = Array.from(menus[0].querySelectorAll('[role="menuitem"]'));
          const deleteItem = menuItems.find(item => {
              const text = (item.textContent || '').trim().toLowerCase();
              return item.id === 'message-actions-delete' || text === 'delete message' || text === 'delete' || text === '删除消息' || text === '删除';
          });

          if (!deleteItem) {
              // Close the menu by pressing Escape
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              return { ok: false, message: 'No "Delete Message" option found. You may not have permission to delete this message.' };
          }

          deleteItem.click();
          await new Promise(r => setTimeout(r, 500));

          // Confirm deletion in the modal dialog
          const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
          const dialog = dialogs.length === 1 ? dialogs[0] : null;
          const confirmBtn = dialog && Array.from(dialog.querySelectorAll('button')).find(btn => /^(delete|delete message|删除|删除消息)$/i.test((btn.textContent || '').trim()));
          if (!confirmBtn) {
              return { ok: false, message: 'Delete confirmation dialog did not appear.' };
          }

          if (location.pathname !== path || !msgEl.isConnected) return { ok: false, message: 'Message or channel changed before confirmation.' };
          submitted = true;
          confirmBtn.click();
          for (let attempt = 0; attempt < 20; attempt++) {
              await new Promise(r => setTimeout(r, 250));
              if (location.pathname !== path) break;
              if (!document.getElementById(msgEl.id) && !dialog.isConnected) return { ok: true, message: 'Message ' + messageId + ' deleted successfully.' };
          }
          return { ok: false, uncertain: true, message: 'Deletion outcome is uncertain. Check Discord before retrying.' };
      } catch (e) {
          return { ok: false, uncertain: submitted, message: e.toString() };
      }
  })()`;
}

export const deleteCommand = cli({
    site: 'discord-app',
    name: 'delete',
    access: 'write',
    description: 'Delete a message by its ID in the active Discord channel',
    domain: 'localhost',
    strategy: Strategy.UI,
    browser: true,
    args: [
        {
            name: 'message_id',
            type: 'string',
            required: true,
            positional: true,
            help: 'The ID of the message to delete (visible via Developer Mode or the read command)',
        },
    ],
    columns: ['status', 'message'],
    func: async (page, kwargs) => {
        if (!page)
            throw new CommandExecutionError('Browser session required for discord-app delete');
        const messageId = kwargs.message_id;
        if (!/^\d+$/.test(messageId)) {
            throw new ArgumentError(
                `Invalid message ID: "${messageId}". A Discord message ID is a numeric snowflake (e.g. 1234567890123456789).`
            );
        }
        // Wait a moment for the chat to be fully loaded
        await page.wait(0.5);
        const result = await page.evaluate(buildDeleteScript(messageId));
        if (result.uncertain) throw new CommandExecutionError(result.message, 'Do not automatically retry a deletion with an uncertain outcome.');
        if (result.ok) {
            await page.wait(1);
        }
        return [{
            status: result.ok ? 'success' : 'failed',
            message: result.message,
        }];
    },
});

export const __test__ = {
    buildDeleteScript,
};
