import streamDeck from "@elgato/streamdeck";
import { MockQueryClient } from "./mock-query-client";

/**
 * Global settings for the TeamSpeak 3 plugin.
 */
export interface TS3GlobalSettings {
	apiKey?: string;
	host?: string;
	port?: number;
}

/**
 * Manages a singleton MockQueryClient instance that is shared across all actions.
 * Updates the client when global settings change.
 */
class ClientManager {
	private client: MockQueryClient | null = null;
	private settings: TS3GlobalSettings = {};

	/**
	 * Initialize the client manager and listen for global settings changes.
	 */
	initialize(): void {
		streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
			this.updateSettings(ev.settings as TS3GlobalSettings);
		});

		// Request initial global settings
		streamDeck.settings.getGlobalSettings();
	}

	/**
	 * Update the settings and reinitialize the client if necessary.
	 */
	private updateSettings(newSettings: TS3GlobalSettings): void {
		this.settings = newSettings;
		streamDeck.logger.info(`[TS3] Global settings updated: ${JSON.stringify(this.settings)}`);

		// Recreate the client with new settings
		this.client = new MockQueryClient({
			apiKey: this.settings.apiKey,
			host: this.settings.host,
			port: this.settings.port,
		});
	}

	/**
	 * Get the shared QueryClient instance.
	 * Creates one with default settings if it doesn't exist.
	 */
	getClient(): MockQueryClient {
		if (!this.client) {
			this.client = new MockQueryClient({
				apiKey: this.settings.apiKey,
				host: this.settings.host,
				port: this.settings.port,
			});
		}
		return this.client;
	}
}

// Export a singleton instance
export const clientManager = new ClientManager();
