import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { clientManager, QueryClient } from "../ts3";

/**
 * Action to toggle away status in TeamSpeak 3.
 * Uses the "clientupdate client_away=<0|1> client_away_message=<message>" command.
 */
@action({ UUID: "me.mehlinger.teamspeak3.toggle-away" })
export class ToggleAway extends SingletonAction<AwaySettings> {

	override async onWillAppear(ev: WillAppearEvent<AwaySettings>): Promise<void> {
		// Query current away state from TeamSpeak
		const response = await clientManager.getClient().execute("whoami");

		// In a real implementation, parse response.data to get client_away
		// For now, we'll use the stored setting or default to false
		if (ev.payload.settings.isAway === undefined) {
			ev.payload.settings.isAway = false;
			await ev.action.setSettings(ev.payload.settings);
		}

		// Set default away message if not provided
		if (!ev.payload.settings.awayMessage) {
			ev.payload.settings.awayMessage = "Away from keyboard";
			await ev.action.setSettings(ev.payload.settings);
		}

		// Update the title to reflect current state
		await this.updateDisplay(ev.action, ev.payload.settings.isAway);
	}

	override async onKeyDown(ev: KeyDownEvent<AwaySettings>): Promise<void> {
		const { settings } = ev.payload;

		// Toggle the away state
		settings.isAway = !settings.isAway;

		// Build the TeamSpeak command
		let command = `clientupdate client_away=${settings.isAway ? 1 : 0}`;
		if (settings.isAway && settings.awayMessage) {
			// Escape special characters in the message
			const escapedMessage = QueryClient.escape(settings.awayMessage);
			command += ` client_away_message=${escapedMessage}`;
		}

		// Execute the TeamSpeak command (will be logged instead of executed)
		await clientManager.getClient().execute(command);

		// Update settings and display
		await ev.action.setSettings(settings);
		await this.updateDisplay(ev.action, settings.isAway);
	}

	private async updateDisplay(action: any, isAway: boolean): Promise<void> {
		await action.setTitle("");
		await action.setState(isAway ? 1 : 0);
	}
}

/**
 * Settings for {@link ToggleAway}.
 */
type AwaySettings = {
	isAway?: boolean;
	awayMessage?: string;
};
