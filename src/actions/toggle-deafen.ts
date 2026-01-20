import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { clientManager } from "../ts3";

/**
 * Action to toggle speaker output (deafen) in TeamSpeak 3.
 * Uses the "clientupdate client_output_muted=<0|1>" command.
 */
@action({ UUID: "me.mehlinger.teamspeak3.toggle-deafen" })
export class ToggleDeafen extends SingletonAction<DeafenSettings> {

	override async onWillAppear(ev: WillAppearEvent<DeafenSettings>): Promise<void> {
		// Query current output mute state from TeamSpeak
		const response = await clientManager.getClient().execute("whoami");

		// In a real implementation, parse response.data to get client_output_muted
		// For now, we'll use the stored setting or default to false
		if (ev.payload.settings.isDeafened === undefined) {
			ev.payload.settings.isDeafened = false;
			await ev.action.setSettings(ev.payload.settings);
		}

		// Update the title to reflect current state
		await this.updateDisplay(ev.action, ev.payload.settings.isDeafened);
	}

	override async onKeyDown(ev: KeyDownEvent<DeafenSettings>): Promise<void> {
		const { settings } = ev.payload;

		// Toggle the deafen state
		settings.isDeafened = !settings.isDeafened;

		// Execute the TeamSpeak command (will be logged instead of executed)
		const deafenValue = settings.isDeafened ? 1 : 0;
		await clientManager.getClient().execute(`clientupdate client_output_muted=${deafenValue}`);

		// Update settings and display
		await ev.action.setSettings(settings);
		await this.updateDisplay(ev.action, settings.isDeafened);
	}

	private async updateDisplay(action: any, isDeafened: boolean): Promise<void> {
		await action.setTitle("");
		await action.setState(isDeafened ? 1 : 0);
	}
}

/**
 * Settings for {@link ToggleDeafen}.
 */
type DeafenSettings = {
	isDeafened?: boolean;
};
