import streamDeck from '@elgato/streamdeck';
import {
    action,
    KeyDownEvent,
    SingletonAction,
    WillAppearEvent,
    WillDisappearEvent,
} from '@elgato/streamdeck';
import { clientManager, QueryClient, type TS3State } from '../ts3';

/**
 * Action to toggle away status in TeamSpeak 3.
 * Uses the "clientupdate client_away=<0|1> client_away_message=<message>" command.
 */
@action({ UUID: 'me.mehlinger.teamspeak3.toggle-away' })
export class ToggleAway extends SingletonAction<AwaySettings> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private visibleActions = new Set<any>();
    private listenerRegistered = false;

    override async onWillAppear(ev: WillAppearEvent<AwaySettings>): Promise<void> {
        this.visibleActions.add(ev.action);

        // Set default away message if not provided
        if (!ev.payload.settings.awayMessage) {
            ev.payload.settings.awayMessage = 'Away from keyboard';
            await ev.action.setSettings(ev.payload.settings);
        }

        // Register for state updates (only once)
        if (!this.listenerRegistered) {
            this.listenerRegistered = true;
            clientManager.onStateChange((state) => this.onStateChange(state));
        }

        // Use current cached state if available
        const state = clientManager.getState();
        if (state.away !== undefined) {
            await this.updateDisplay(ev.action, state.away);
        }
    }

    override async onWillDisappear(ev: WillDisappearEvent<AwaySettings>): Promise<void> {
        this.visibleActions.delete(ev.action);
    }

    private async onStateChange(state: TS3State): Promise<void> {
        if (state.away === undefined) return;

        // Update all visible instances of this action
        for (const action of this.visibleActions) {
            await this.updateDisplay(action, state.away);
        }
    }

    override async onKeyDown(ev: KeyDownEvent<AwaySettings>): Promise<void> {
        try {
            const client = clientManager.requireClient();

            const { settings } = ev.payload;

            // Get current state and toggle
            const state = clientManager.getState();
            const newAwayState = !state.away;

            // Build the TeamSpeak command
            let command = `clientupdate client_away=${newAwayState ? 1 : 0}`;
            if (newAwayState && settings.awayMessage) {
                // Escape special characters in the message
                const escapedMessage = QueryClient.escape(settings.awayMessage);
                command += ` client_away_message=${escapedMessage}`;
            }

            // Execute the TeamSpeak command
            await client.execute(command);

            // Optimistically update display (heartbeat will confirm)
            await this.updateDisplay(ev.action, newAwayState);
        } catch (error) {
            streamDeck.logger.error(`[TS3] Toggle away error: ${error}`);
            await ev.action.showAlert();
        }
    }

    private async updateDisplay(action: any, isAway: boolean): Promise<void> {
        await action.setTitle('');
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
