import streamDeck from '@elgato/streamdeck';

import { SwitchChannel } from './actions/switch-channel';
import { ToggleAway } from './actions/toggle-away';
import { ToggleDeafen } from './actions/toggle-deafen';
import { ToggleMute } from './actions/toggle-mute';
import { clientManager } from './ts3';

// Set log level
streamDeck.logger.setLevel('info');

// Initialize the TeamSpeak 3 client manager
clientManager.initialize();

// Register TeamSpeak 3 actions
streamDeck.actions.registerAction(new ToggleMute());
streamDeck.actions.registerAction(new ToggleDeafen());
streamDeck.actions.registerAction(new ToggleAway());
streamDeck.actions.registerAction(new SwitchChannel());

// Finally, connect to the Stream Deck.
streamDeck.connect().then(() => {
    streamDeck.logger.info('=== TeamSpeak 3 Plugin Connected ===');
});
