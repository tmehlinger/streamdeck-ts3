import streamDeck from '@elgato/streamdeck';
import {
    action,
    KeyDownEvent,
    SingletonAction,
    WillAppearEvent,
    WillDisappearEvent,
} from '@elgato/streamdeck';
import { clientManager, type TS3State } from '../ts3';

/**
 * Action to toggle microphone mute status in TeamSpeak 3.
 * Uses the "clientupdate client_input_muted=<0|1>" command.
 */
@action({ UUID: 'me.mehlinger.teamspeak3.toggle-mute' })
export class ToggleMute extends SingletonAction<MuteSettings> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private visibleActions = new Set<any>();
    private listenerRegistered = false;

    override async onWillAppear(ev: WillAppearEvent<MuteSettings>): Promise<void> {
        this.visibleActions.add(ev.action);

        // Register for state updates (only once)
        if (!this.listenerRegistered) {
            this.listenerRegistered = true;
            clientManager.onStateChange((state) => this.onStateChange(state));
        }

        // Use current cached state if available
        const state = clientManager.getState();
        if (state.inputMuted !== undefined) {
            await this.updateDisplay(ev.action, state.inputMuted);
        }
    }

    override async onWillDisappear(ev: WillDisappearEvent<MuteSettings>): Promise<void> {
        this.visibleActions.delete(ev.action);
    }

    private async onStateChange(state: TS3State): Promise<void> {
        if (state.inputMuted === undefined) return;

        // Update all visible instances of this action
        for (const action of this.visibleActions) {
            await this.updateDisplay(action, state.inputMuted);
        }
    }

    override async onKeyDown(ev: KeyDownEvent<MuteSettings>): Promise<void> {
        try {
            const client = clientManager.requireClient();

            // Get current state and toggle
            const state = clientManager.getState();
            const newMuteState = !state.inputMuted;

            // Execute the TeamSpeak command
            const muteValue = newMuteState ? 1 : 0;
            await client.execute(`clientupdate client_input_muted=${muteValue}`);

            // Optimistically update display (heartbeat will confirm)
            await this.updateDisplay(ev.action, newMuteState);
        } catch (error) {
            streamDeck.logger.error(`[TS3] Toggle mute error: ${error}`);
            await ev.action.showAlert();
        }
    }

    private async updateDisplay(action: any, isMuted: boolean): Promise<void> {
        await action.setTitle('');
        await action.setState(isMuted ? 1 : 0);
    }
}

/**
 * Settings for {@link ToggleMute}.
 */
type MuteSettings = {
    isMuted?: boolean;
};
