import streamDeck from '@elgato/streamdeck';
import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from '@elgato/streamdeck';
import { clientManager, QueryClient } from '../ts3';

/**
 * Action to switch to a specified TeamSpeak 3 channel.
 * Uses the "channelfind" and "clientmove" commands.
 */
@action({ UUID: 'me.mehlinger.teamspeak3.switch-channel' })
export class SwitchChannel extends SingletonAction<ChannelSettings> {
    override async onWillAppear(ev: WillAppearEvent<ChannelSettings>): Promise<void> {
        // Set default channel name if not provided
        if (!ev.payload.settings.channelName) {
            ev.payload.settings.channelName = '';
            await ev.action.setSettings(ev.payload.settings);
        }

        // Update the title
        await this.updateDisplay(ev.action);
    }

    override async onKeyDown(ev: KeyDownEvent<ChannelSettings>): Promise<void> {
        const { settings } = ev.payload;

        if (!settings.channelName || settings.channelName.trim() === '') {
            // No channel specified - show alert
            await ev.action.showAlert();
            return;
        }

        try {
            const client = clientManager.requireClient();

            // Get all channels and find the one matching our name
            const channelListResult = await client.execute('channellist');
            if (channelListResult.error.id !== 0) {
                throw new Error(`Failed to get channel list: ${channelListResult.error.msg}`);
            }

            const targetName = settings.channelName.toLowerCase();
            const channel = channelListResult.data.find((ch) => ch.channel_name?.toLowerCase() === targetName);

            if (!channel) {
                streamDeck.logger.error(`[TS3] Channel not found: "${settings.channelName}"`);
                throw new Error(`Channel not found: ${settings.channelName}`);
            }
            const channelId = channel.cid;

            // Use cached state for client ID if available, otherwise query
            let clientId = clientManager.getState().clientId;
            if (!clientId) {
                const whoamiResult = await client.execute('whoami');
                if (whoamiResult.error.id !== 0) {
                    throw new Error('Failed to get client info');
                }
                clientId = whoamiResult.data[0].clid;
            }

            // Check if already in target channel
            const currentChannelId = clientManager.getState().channelId;
            if (currentChannelId === channelId) {
                streamDeck.logger.debug('[TS3] Already in target channel');
                await ev.action.showOk();
                return;
            }

            // Build the clientmove command with optional password
            let moveCommand = `clientmove clid=${clientId} cid=${channelId}`;
            if (settings.channelPassword && settings.channelPassword.trim() !== '') {
                // Hash the password first - TeamSpeak requires hashed passwords for clientmove
                const escapedPassword = QueryClient.escape(settings.channelPassword);
                const hashResult = await client.execute(`hashpassword password=${escapedPassword}`);
                if (hashResult.error.id !== 0 || !hashResult.data[0]?.passwordhash) {
                    throw new Error('Failed to hash channel password');
                }
                moveCommand += ` cpw=${hashResult.data[0].passwordhash}`;
            }
            const moveResult = await client.execute(moveCommand);
            if (moveResult.error.id !== 0) {
                streamDeck.logger.error(`[TS3] clientmove failed: ${moveResult.error.msg}`);
                throw new Error(`Failed to move to channel: ${moveResult.error.msg}`);
            }
            streamDeck.logger.info(`[TS3] Moved to channel "${channel.channel_name}"`);

            // Show success feedback
            await ev.action.showOk();
        } catch (error) {
            streamDeck.logger.error(`[TS3] Switch channel error: ${error}`);
            await ev.action.showAlert();
        }
    }

    private async updateDisplay(action: any): Promise<void> {
        await action.setTitle('');
    }
}

/**
 * Settings for {@link SwitchChannel}.
 */
type ChannelSettings = {
    channelName?: string;
    channelPassword?: string;
};
