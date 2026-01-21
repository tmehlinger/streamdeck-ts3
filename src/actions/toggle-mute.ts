import streamDeck from '@elgato/streamdeck';
import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck';

import { clientManager, type TS3State } from '../ts3';

/**
 * Action to toggle microphone mute status in TeamSpeak 3.
 * Uses the "clientupdate client_input_muted=<0|1>" command.
 */
@action({ UUID: 'me.mehlinger.teamspeak3.toggle-mute' })
export class ToggleMute extends SingletonAction<MuteSettings> {
    /**
     *
     */
    private listenerRegistered = false;
    /**
     *
     */
    private visibleActions = new Map<string, KeyAction<MuteSettings>>();

    /**
     * Handles the action appearing on the Stream Deck.
     * @param ev - The will appear event.
     */
    public override async onWillAppear(ev: WillAppearEvent<MuteSettings>): Promise<void> {
        this.visibleActions.set(ev.action.id, ev.action as KeyAction<MuteSettings>);

        // Register for state updates (only once)
        if (!this.listenerRegistered) {
            this.listenerRegistered = true;
            clientManager.onStateChange((state) => this.onStateChange(state));
        }

        // Use current cached state if available
        const state = clientManager.getState();
        if (state.inputMuted !== undefined) {
            await this.updateDisplay(ev.action as KeyAction<MuteSettings>, state.inputMuted);
        }
    }

    /**
     * Handles the action disappearing from the Stream Deck.
     * @param ev - The will disappear event.
     */
    public override async onWillDisappear(ev: WillDisappearEvent<MuteSettings>): Promise<void> {
        this.visibleActions.delete(ev.action.id);
    }

    /**
     * Handles key down events.
     * @param ev - The key down event.
     */
    public override async onKeyDown(ev: KeyDownEvent<MuteSettings>): Promise<void> {
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

    /**
     * Handles state changes from TeamSpeak.
     * @param state - The new TeamSpeak state.
     */
    private async onStateChange(state: TS3State): Promise<void> {
        if (state.inputMuted === undefined) return;

        // Update all visible instances of this action
        for (const actionContext of this.visibleActions.values()) {
            await this.updateDisplay(actionContext, state.inputMuted);
        }
    }

    /**
     * Updates the display for an action.
     * @param actionContext - The action context to update.
     * @param isMuted - Whether the microphone is muted.
     */
    private async updateDisplay(actionContext: KeyAction<MuteSettings>, isMuted: boolean): Promise<void> {
        await actionContext.setTitle('');
        await actionContext.setState(isMuted ? 1 : 0);
    }
}

/** Settings for {@link ToggleMute}. */
type MuteSettings = {
    /**
     *
     */
    isMuted?: boolean;
};
