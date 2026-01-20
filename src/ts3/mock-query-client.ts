import streamDeck from "@elgato/streamdeck";
import { QueryClient, type QueryClientOptions, type QueryResponse } from "./query-client";

/**
 * A mock QueryClient that logs commands instead of executing them.
 * Useful for development when TeamSpeak is not available.
 */
export class MockQueryClient extends QueryClient {
	constructor(options: QueryClientOptions = {}) {
		super(options);
	}

	override async connect(): Promise<void> {
		streamDeck.logger.info("[TS3 Mock] Would connect to TeamSpeak ClientQuery");
	}

	override async disconnect(): Promise<void> {
		streamDeck.logger.info("[TS3 Mock] Would disconnect from TeamSpeak ClientQuery");
	}

	override async authenticate(apiKey: string): Promise<void> {
		streamDeck.logger.info(`[TS3 Mock] Would authenticate with API key: ${apiKey.substring(0, 8)}...`);
	}

	override async execute(command: string): Promise<QueryResponse> {
		streamDeck.logger.info(`[TS3 Mock] Would execute command: ${command}`);

		// Return a mock success response
		return {
			data: [],
			error: {
				id: 0,
				msg: "ok"
			}
		};
	}
}
