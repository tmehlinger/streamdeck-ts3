import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { clientManager } from "../ts3";

/**
 * Action to toggle microphone mute status in TeamSpeak 3.
 * Uses the "clientupdate client_input_muted=<0|1>" command.
 */
@action({ UUID: "me.mehlinger.teamspeak3.toggle-mute" })
export class ToggleMute extends SingletonAction<MuteSettings> {

	override async onWillAppear(ev: WillAppearEvent<MuteSettings>): Promise<void> {
		// Query current mute state from TeamSpeak
		const response = await clientManager.getClient().execute("whoami");

		// In a real implementation, parse response.data to get client_input_muted
		// For now, we'll use the stored setting or default to false
		if (ev.payload.settings.isMuted === undefined) {
			ev.payload.settings.isMuted = false;
			await ev.action.setSettings(ev.payload.settings);
		}

		// Update the title to reflect current state
		await this.updateDisplay(ev.action, ev.payload.settings.isMuted);
	}

	override async onKeyDown(ev: KeyDownEvent<MuteSettings>): Promise<void> {
		const { settings } = ev.payload;

		// Toggle the mute state
		settings.isMuted = !settings.isMuted;

		// Execute the TeamSpeak command (will be logged instead of executed)
		const muteValue = settings.isMuted ? 1 : 0;
		await clientManager.getClient().execute(`clientupdate client_input_muted=${muteValue}`);

		// Update settings and display
		await ev.action.setSettings(settings);
		await this.updateDisplay(ev.action, settings.isMuted);
	}

	private async updateDisplay(action: any, isMuted: boolean): Promise<void> {
		await action.setTitle("");
		await action.setState(isMuted ? 1 : 0);
	}
}

/**
 * Settings for {@link ToggleMute}.
 */
type MuteSettings = {
	isMuted?: boolean;
};
