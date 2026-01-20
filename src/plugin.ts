import streamDeck from "@elgato/streamdeck";

import { ToggleMute } from "./actions/toggle-mute";
import { ToggleDeafen } from "./actions/toggle-deafen";
import { ToggleAway } from "./actions/toggle-away";
import { SwitchChannel } from "./actions/switch-channel";
import { clientManager } from "./ts3";

// Set log level to info to avoid TRACE logs
streamDeck.logger.setLevel("info");

// Initialize the TeamSpeak 3 client manager
clientManager.initialize();

// Register TeamSpeak 3 actions
streamDeck.actions.registerAction(new ToggleMute());
streamDeck.actions.registerAction(new ToggleDeafen());
streamDeck.actions.registerAction(new ToggleAway());
streamDeck.actions.registerAction(new SwitchChannel());

// Finally, connect to the Stream Deck.
streamDeck.connect().then(() => {
	streamDeck.logger.info("=== TeamSpeak 3 Plugin Connected ===");
});
