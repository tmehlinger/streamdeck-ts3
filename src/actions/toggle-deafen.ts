import streamDeck from '@elgato/streamdeck';
import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck';

import { clientManager, type TS3State } from '../ts3';

/**
 * Action to toggle speaker output (deafen) in TeamSpeak 3.
 * Uses the "clientupdate client_output_muted=<0|1>" command.
 */
@action({ UUID: 'me.mehlinger.teamspeak3.toggle-deafen' })
export class ToggleDeafen extends SingletonAction<DeafenSettings> {
    /**
     *
     */
    private listenerRegistered = false;
    /**
     *
     */
    private visibleActions = new Map<string, KeyAction<DeafenSettings>>();

    /**
     * Handles the action appearing on the Stream Deck.
     * @param ev - The will appear event.
     */
    public override async onWillAppear(ev: WillAppearEvent<DeafenSettings>): Promise<void> {
        this.visibleActions.set(ev.action.id, ev.action as KeyAction<DeafenSettings>);

        // Register for state updates (only once)
        if (!this.listenerRegistered) {
            this.listenerRegistered = true;
            clientManager.onStateChange((state) => this.onStateChange(state));
        }

        // Use current cached state if available
        const state = clientManager.getState();
        if (state.outputMuted !== undefined) {
            await this.updateDisplay(ev.action as KeyAction<DeafenSettings>, state.outputMuted);
        }
    }

    /**
     * Handles the action disappearing from the Stream Deck.
     * @param ev - The will disappear event.
     */
    public override async onWillDisappear(ev: WillDisappearEvent<DeafenSettings>): Promise<void> {
        this.visibleActions.delete(ev.action.id);
    }

    /**
     * Handles key down events.
     * @param ev - The key down event.
     */
    public override async onKeyDown(ev: KeyDownEvent<DeafenSettings>): Promise<void> {
        try {
            const client = clientManager.requireClient();

            // Get current state and toggle
            const state = clientManager.getState();
            const newDeafenState = !state.outputMuted;

            // Execute the TeamSpeak command
            const deafenValue = newDeafenState ? 1 : 0;
            await client.execute(`clientupdate client_output_muted=${deafenValue}`);

            // Optimistically update display (heartbeat will confirm)
            await this.updateDisplay(ev.action, newDeafenState);
        } catch (error) {
            streamDeck.logger.error(`[TS3] Toggle deafen error: ${error}`);
            await ev.action.showAlert();
        }
    }

    /**
     * Handles state changes from TeamSpeak.
     * @param state - The new TeamSpeak state.
     */
    private async onStateChange(state: TS3State): Promise<void> {
        if (state.outputMuted === undefined) return;

        // Update all visible instances of this action
        for (const actionContext of this.visibleActions.values()) {
            await this.updateDisplay(actionContext, state.outputMuted);
        }
    }

    /**
     * Updates the display for an action.
     * @param actionContext - The action context to update.
     * @param isDeafened - Whether the speaker output is muted.
     */
    private async updateDisplay(actionContext: KeyAction<DeafenSettings>, isDeafened: boolean): Promise<void> {
        await actionContext.setTitle('');
        await actionContext.setState(isDeafened ? 1 : 0);
    }
}

/** Settings for {@link ToggleDeafen}. */
type DeafenSettings = {
    /**
     *
     */
    isDeafened?: boolean;
};
