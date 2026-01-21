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
 * Action to toggle speaker output (deafen) in TeamSpeak 3.
 * Uses the "clientupdate client_output_muted=<0|1>" command.
 */
@action({ UUID: 'me.mehlinger.teamspeak3.toggle-deafen' })
export class ToggleDeafen extends SingletonAction<DeafenSettings> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private visibleActions = new Set<any>();
    private listenerRegistered = false;

    override async onWillAppear(ev: WillAppearEvent<DeafenSettings>): Promise<void> {
        this.visibleActions.add(ev.action);

        // Register for state updates (only once)
        if (!this.listenerRegistered) {
            this.listenerRegistered = true;
            clientManager.onStateChange((state) => this.onStateChange(state));
        }

        // Use current cached state if available
        const state = clientManager.getState();
        if (state.outputMuted !== undefined) {
            await this.updateDisplay(ev.action, state.outputMuted);
        }
    }

    override async onWillDisappear(ev: WillDisappearEvent<DeafenSettings>): Promise<void> {
        this.visibleActions.delete(ev.action);
    }

    private async onStateChange(state: TS3State): Promise<void> {
        if (state.outputMuted === undefined) return;

        // Update all visible instances of this action
        for (const action of this.visibleActions) {
            await this.updateDisplay(action, state.outputMuted);
        }
    }

    override async onKeyDown(ev: KeyDownEvent<DeafenSettings>): Promise<void> {
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

    private async updateDisplay(action: any, isDeafened: boolean): Promise<void> {
        await action.setTitle('');
        await action.setState(isDeafened ? 1 : 0);
    }
}

/**
 * Settings for {@link ToggleDeafen}.
 */
type DeafenSettings = {
    isDeafened?: boolean;
};
