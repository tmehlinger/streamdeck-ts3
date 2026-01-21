import streamDeck from '@elgato/streamdeck';

import { QueryClient } from './query-client';

const HEARTBEAT_INTERVAL = 500; // 0.5 seconds
const INITIAL_BACKOFF_DELAY = 1000; // 1 second
const MAX_BACKOFF_DELAY = 60000; // 60 seconds

/** Global settings for the TeamSpeak 3 plugin. */
export interface TS3GlobalSettings {
    /**
     *
     */
    apiKey?: string;
    /**
     *
     */
    host?: string;
    /**
     *
     */
    port?: number;
}

/** Current TeamSpeak client state. */
export interface TS3State {
    /**
     *
     */
    clientId?: string;
    /**
     *
     */
    channelId?: string;
    /**
     *
     */
    inputMuted?: boolean;
    /**
     *
     */
    outputMuted?: boolean;
    /**
     *
     */
    away?: boolean;
    /**
     *
     */
    awayMessage?: string;
}

/** Callback function for state change notifications. */
export type StateChangeListener = (state: TS3State) => void;

/**
 * Manages a singleton QueryClient instance that is shared across all actions.
 * Updates the client when global settings change.
 * Provides heartbeat to sync state with TeamSpeak.
 */
class ClientManager {
    /**
     *
     */
    private client: QueryClient | null = null;
    /**
     *
     */
    private settings: TS3GlobalSettings = {};
    /**
     *
     */
    private connectionPromise: Promise<QueryClient> | null = null;
    /**
     *
     */
    private settingsReceived = false;
    /**
     *
     */
    private settingsPromiseResolve: (() => void) | null = null;
    /**
     *
     */
    private settingsPromise: Promise<void>;
    /**
     *
     */
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    /**
     *
     */
    private currentState: TS3State = {};
    /**
     *
     */
    private stateListeners: StateChangeListener[] = [];
    /**
     *
     */
    private backoffDelay = INITIAL_BACKOFF_DELAY;
    /**
     *
     */
    private backoffTimer: ReturnType<typeof setTimeout> | null = null;
    /**
     *
     */
    private backoffResolve: (() => void) | null = null;

    /** Creates a new ClientManager instance. */
    constructor() {
        this.settingsPromise = new Promise((resolve) => {
            this.settingsPromiseResolve = resolve;
        });
    }

    /** Initialize the client manager and listen for global settings changes. */
    public initialize(): void {
        streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
            this.updateSettings(ev.settings as TS3GlobalSettings);
        });

        // Request initial global settings
        streamDeck.settings.getGlobalSettings();

        // Start heartbeat
        this.startHeartbeat();
    }

    /**
     * Register a listener for state changes.
     * @param listener - The listener callback to register.
     */
    public onStateChange(listener: StateChangeListener): void {
        this.stateListeners.push(listener);
        // Immediately notify with current state
        if (Object.keys(this.currentState).length > 0) {
            listener(this.currentState);
        }
    }

    /** Get the current cached state. */
    public getState(): TS3State {
        return this.currentState;
    }

    /** Start the heartbeat timer to poll TeamSpeak state. */
    private startHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(() => {
            this.pollState().catch((err) => {
                streamDeck.logger.debug(`[TS3] Heartbeat error: ${err}`);
            });
        }, HEARTBEAT_INTERVAL);

        // Also poll immediately
        this.pollState().catch(() => {});
    }

    /** Poll the current state from TeamSpeak. */
    private async pollState(): Promise<void> {
        try {
            const client = await this.getClient();

            // whoami gives us client ID and channel ID
            const whoami = await client.execute('whoami');
            if (whoami.error.id !== 0 || !whoami.data[0]) {
                return;
            }

            const clientId = whoami.data[0].clid;
            const channelId = whoami.data[0].cid;

            // clientvariable gives us the mute/away state
            const vars = await client.execute(
                `clientvariable clid=${clientId} client_input_muted client_output_muted client_away client_away_message`,
            );
            if (vars.error.id !== 0 || !vars.data[0]) {
                return;
            }

            const data = vars.data[0];
            const newState: TS3State = {
                clientId,
                channelId,
                inputMuted: data.client_input_muted === '1',
                outputMuted: data.client_output_muted === '1',
                away: data.client_away === '1',
                awayMessage: data.client_away_message,
            };

            // Check if state changed
            if (JSON.stringify(newState) !== JSON.stringify(this.currentState)) {
                this.currentState = newState;
                streamDeck.logger.debug(
                    `[TS3] State updated: muted=${newState.inputMuted}, deafened=${newState.outputMuted}, away=${newState.away}`,
                );
                this.notifyStateChange();
            }
        } catch {
            // Connection might be lost - clear connection promise to trigger reconnect
            if (this.client && !this.client.isConnected) {
                streamDeck.logger.info('[TS3] Connection lost, will reconnect on next use');
                this.connectionPromise = null;
            }
        }
    }

    /** Notify all registered listeners of a state change. */
    private notifyStateChange(): void {
        for (const listener of this.stateListeners) {
            try {
                listener(this.currentState);
            } catch (err) {
                streamDeck.logger.error(`[TS3] State listener error: ${err}`);
            }
        }
    }

    /**
     * Update the settings and reinitialize the client if necessary.
     * @param newSettings - The new global settings.
     */
    private async updateSettings(newSettings: TS3GlobalSettings): Promise<void> {
        this.settings = newSettings;
        const hasApiKey = !!this.settings.apiKey;
        streamDeck.logger.info(
            `[TS3] Global settings updated: host=${this.settings.host}, port=${this.settings.port}, hasApiKey=${hasApiKey}`,
        );

        // Signal that settings have been received
        if (!this.settingsReceived) {
            this.settingsReceived = true;
            this.settingsPromiseResolve?.();
        }

        // Disconnect existing client if connected
        if (this.client?.isConnected) {
            try {
                await this.client.disconnect();
            } catch (err) {
                streamDeck.logger.error(`[TS3] Error disconnecting: ${err}`);
            }
        }

        // Reset connection state
        this.connectionPromise = null;

        // Create new client (will connect on first use)
        this.client = new QueryClient({
            apiKey: this.settings.apiKey,
            host: this.settings.host,
            port: this.settings.port,
        });
    }

    /**
     * Get the shared QueryClient instance, connecting if necessary.
     * Waits for settings to be received before connecting.
     * Implements exponential backoff on connection failure.
     */
    public async getClient(): Promise<QueryClient> {
        // Wait for settings to be received at least once
        if (!this.settingsReceived) {
            streamDeck.logger.debug('[TS3] Waiting for settings...');
            await this.settingsPromise;
        }

        if (!this.client) {
            this.client = new QueryClient({
                apiKey: this.settings.apiKey,
                host: this.settings.host,
                port: this.settings.port,
            });
        }

        // Capture current client - if settings change mid-connection, we still return the connected one
        const client = this.client;

        // If already connected, return immediately
        if (client.isConnected) {
            return client;
        }

        // If a connection is in progress, wait for it and return that client
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        // Start a new connection with exponential backoff
        this.connectionPromise = this.connectWithBackoff(client);

        return this.connectionPromise;
    }

    /**
     * Attempt to connect with exponential backoff on failure.
     * @param client - The QueryClient to connect.
     */
    private async connectWithBackoff(client: QueryClient): Promise<QueryClient> {
        while (true) {
            try {
                streamDeck.logger.info('[TS3] Connecting to TeamSpeak ClientQuery...');
                await client.connect();
                streamDeck.logger.info('[TS3] Connected successfully');
                // Reset backoff on successful connection
                this.backoffDelay = INITIAL_BACKOFF_DELAY;
                return client;
            } catch (err) {
                streamDeck.logger.error(`[TS3] Connection failed: ${err}`);

                // Wait with exponential backoff
                streamDeck.logger.info(`[TS3] Retrying in ${this.backoffDelay / 1000} seconds...`);
                await this.waitForBackoff();

                // Double the delay for next attempt, capped at max
                this.backoffDelay = Math.min(this.backoffDelay * 2, MAX_BACKOFF_DELAY);

                // Recreate client for fresh connection attempt
                this.client = new QueryClient({
                    apiKey: this.settings.apiKey,
                    host: this.settings.host,
                    port: this.settings.port,
                });
                client = this.client;
            }
        }
    }

    /** Wait for the current backoff delay, or until canceled. */
    private waitForBackoff(): Promise<void> {
        return new Promise((resolve) => {
            this.backoffResolve = resolve;
            this.backoffTimer = setTimeout(() => {
                this.backoffTimer = null;
                this.backoffResolve = null;
                resolve();
            }, this.backoffDelay);
        });
    }

    /**
     * Cancel the current backoff timer and retry connection immediately.
     * Call this when a user presses a button to skip the wait.
     */
    public cancelBackoffAndRetry(): void {
        if (this.backoffTimer) {
            streamDeck.logger.info('[TS3] Backoff canceled, retrying immediately');
            clearTimeout(this.backoffTimer);
            this.backoffTimer = null;
            // Reset backoff delay for immediate retry
            this.backoffDelay = INITIAL_BACKOFF_DELAY;
            if (this.backoffResolve) {
                this.backoffResolve();
                this.backoffResolve = null;
            }
        }
    }

    /**
     * Get the client if currently connected, or throw an error.
     * Use this in actions to avoid queuing commands while disconnected.
     * Cancels any backoff and triggers a reconnect attempt if not connected.
     */
    public requireClient(): QueryClient {
        if (!this.client || !this.client.isConnected) {
            // Cancel backoff and trigger reconnect in background
            this.cancelBackoffAndRetry();
            if (!this.connectionPromise) {
                this.getClient().catch(() => {});
            }
            throw new Error('Not connected to TeamSpeak');
        }
        return this.client;
    }
}

// Export a singleton instance
export const clientManager = new ClientManager();
