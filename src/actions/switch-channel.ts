import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { clientManager, QueryClient } from "../ts3";

/**
 * Action to switch to a specified TeamSpeak 3 channel.
 * Uses the "channelfind" and "clientmove" commands.
 */
@action({ UUID: "me.mehlinger.teamspeak3.switch-channel" })
export class SwitchChannel extends SingletonAction<ChannelSettings> {
	override async onWillAppear(ev: WillAppearEvent<ChannelSettings>): Promise<void> {
		// Set default channel name if not provided
		if (!ev.payload.settings.channelName) {
			ev.payload.settings.channelName = "";
			await ev.action.setSettings(ev.payload.settings);
		}

		// Update the title
		await this.updateDisplay(ev.action);
	}

	override async onKeyDown(ev: KeyDownEvent<ChannelSettings>): Promise<void> {
		const { settings } = ev.payload;

		if (!settings.channelName || settings.channelName.trim() === "") {
			// No channel specified - show alert
			await ev.action.showAlert();
			return;
		}

		try {
			// Escape the channel name for TeamSpeak ClientQuery protocol
			const escapedChannelName = QueryClient.escape(settings.channelName);

			// In a real implementation, you would:
			// 1. Use channelfind to get the channel ID
			// 2. Use whoami to get your client ID
			// 3. Use clientmove to move to the channel
			// For mock purposes, we'll just log the intent
			await clientManager.getClient().execute(`channelfind pattern=${escapedChannelName}`);

			// Build the clientmove command with optional password
			let moveCommand = `clientmove cid=<channel_id>`;
			if (settings.channelPassword && settings.channelPassword.trim() !== "") {
				const escapedPassword = QueryClient.escape(settings.channelPassword);
				moveCommand += ` cpw=${escapedPassword}`;
			}
			await clientManager.getClient().execute(moveCommand);

			// Show success feedback
			await ev.action.showOk();
		} catch (error) {
			await ev.action.showAlert();
			throw error;
		}
	}

	private async updateDisplay(action: any): Promise<void> {
		await action.setTitle("");
	}
}

/**
 * Settings for {@link SwitchChannel}.
 */
type ChannelSettings = {
	channelName?: string;
	channelPassword?: string;
};
