import streamDeck from '@elgato/streamdeck';
import * as net from 'net';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 25639;
const TIMEOUT = 2000;

/** Options for creating a QueryClient. */
export interface QueryClientOptions {
    /**
     *
     */
    host?: string;
    /**
     *
     */
    port?: number;
    /**
     *
     */
    apiKey?: string;
}

/** Response from a TeamSpeak query command. */
export interface QueryResponse {
    /**
     *
     */
    data: Record<string, string>[];
    /**
     *
     */
    error: {
        /**
         *
         */
        id: number;
        /**
         *
         */
        msg: string;
    };
}

/** Client for TeamSpeak 3 ClientQuery protocol. */
export class QueryClient {
    /**
     *
     */
    private socket: net.Socket | null = null;
    /**
     *
     */
    private options: Required<QueryClientOptions>;
    /**
     *
     */
    private connected = false;
    /**
     *
     */
    private buffer = '';
    /**
     *
     */
    private responseResolve: ((data: string) => void) | null = null;
    /**
     *
     */
    private commandQueue: Promise<QueryResponse> = Promise.resolve({ data: [], error: { id: 0, msg: 'ok' } });

    /**
     * Creates a new QueryClient instance.
     * @param options - Connection options.
     */
    constructor(options: QueryClientOptions = {}) {
        this.options = {
            host: options.host ?? DEFAULT_HOST,
            port: options.port ?? DEFAULT_PORT,
            apiKey: options.apiKey ?? '',
        };
    }

    /** Connect to the TeamSpeak ClientQuery interface. */
    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            this.socket.setTimeout(TIMEOUT);

            this.socket.on('data', (data) => {
                this.buffer += data.toString();
                // Check if we have a complete response (ends with error line)
                if (this.responseResolve && this.buffer.includes('error id=')) {
                    const response = this.buffer;
                    this.buffer = '';
                    this.responseResolve(response);
                    this.responseResolve = null;
                }
            });

            this.socket.on('error', (err) => {
                reject(err);
            });

            this.socket.on('close', () => {
                this.connected = false;
            });

            this.socket.connect(this.options.port, this.options.host, async () => {
                this.connected = true;

                // Wait for the welcome banner
                try {
                    await this.waitForBanner();
                    streamDeck.logger.debug('[TS3] Banner received');

                    if (this.options.apiKey) {
                        await this.authenticate(this.options.apiKey);
                    }
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    /** Wait for the TeamSpeak welcome banner. */
    private waitForBanner(): Promise<void> {
        return new Promise((resolve) => {
            const checkBanner = () => {
                if (this.buffer.includes('selected schandlerid')) {
                    this.buffer = '';
                    resolve();
                } else {
                    setTimeout(checkBanner, 10);
                }
            };
            checkBanner();
        });
    }

    /** Disconnect from the TeamSpeak ClientQuery interface. */
    public async disconnect(): Promise<void> {
        if (this.socket && this.connected) {
            this.socket.destroy();
            this.connected = false;
        }
    }

    /**
     * Authenticate with the TeamSpeak ClientQuery interface.
     * @param apiKey - The API key to authenticate with.
     */
    public async authenticate(apiKey: string): Promise<void> {
        const response = await this.execute(`auth apikey=${apiKey}`);
        if (response.error.id !== 0) {
            throw new Error(`Authentication failed: ${response.error.msg}`);
        }
    }

    /**
     * Execute a command on the TeamSpeak ClientQuery interface.
     * @param command - The command to execute.
     */
    public async execute(command: string): Promise<QueryResponse> {
        if (!this.connected || !this.socket) {
            throw new Error('Not connected to TeamSpeak 3 ClientQuery');
        }

        // Queue commands to prevent race conditions
        const result = this.commandQueue.then(() => this.executeInternal(command));
        this.commandQueue = result.catch(() => ({ data: [], error: { id: -1, msg: 'error' } }));
        return result;
    }

    /**
     * Execute a command internally (no queueing).
     * @param command - The command to execute.
     */
    private executeInternal(command: string): Promise<QueryResponse> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.responseResolve = null;
                reject(new Error(`Command timeout: ${command}`));
            }, TIMEOUT);

            this.responseResolve = (raw: string) => {
                clearTimeout(timeout);
                streamDeck.logger.debug(`[TS3] Response for "${command}": ${raw.substring(0, 200)}`);
                resolve(this.parseResponse(raw));
            };

            this.socket!.write(command + '\n');

            // Check if response already arrived in buffer
            if (this.buffer.includes('error id=')) {
                const response = this.buffer;
                this.buffer = '';
                if (this.responseResolve) {
                    this.responseResolve(response);
                    this.responseResolve = null;
                }
            }
        });
    }

    /**
     * Parse a raw response from TeamSpeak.
     * @param raw - The raw response string.
     */
    private parseResponse(raw: string): QueryResponse {
        // TeamSpeak uses inconsistent line endings - normalize and split
        const lines = raw.replace(/\r/g, '').trim().split('\n').filter(Boolean);
        const errorLine = lines.find((line) => line.startsWith('error '));
        const dataLines = lines.filter((line) => !line.startsWith('error '));

        const error = this.parseErrorLine(errorLine ?? 'error id=0 msg=ok');
        const data = dataLines.flatMap((line) => this.parseDataLine(line));

        return { data, error };
    }

    /**
     * Parse an error line from a TeamSpeak response.
     * @param line - The error line to parse.
     */
    private parseErrorLine(line: string): QueryResponse['error'] {
        const params = this.parseParams(line.replace(/^error\s*/, ''));
        return {
            id: parseInt(params.id ?? '0', 10),
            msg: this.unescape(params.msg ?? 'ok'),
        };
    }

    /**
     * Parse a data line from a TeamSpeak response.
     * @param line - The data line to parse.
     */
    private parseDataLine(line: string): Record<string, string>[] {
        return line.split('|').map((entry) => {
            const params = this.parseParams(entry);
            const unescaped: Record<string, string> = {};
            for (const [key, value] of Object.entries(params)) {
                unescaped[key] = this.unescape(value);
            }
            return unescaped;
        });
    }

    /**
     * Parse key=value parameters from a string.
     * @param str - The string to parse.
     */
    private parseParams(str: string): Record<string, string> {
        const params: Record<string, string> = {};
        const regex = /(\w+)(?:=([^\s]*))?/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(str)) !== null) {
            const [, key, value] = match;
            params[key] = value ?? '';
        }

        return params;
    }

    /**
     * Unescape TeamSpeak protocol escape sequences.
     * @param str - The string to unescape.
     */
    private unescape(str: string): string {
        return str
            .replace(/\\s/g, ' ')
            .replace(/\\p/g, '|')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\//g, '/')
            .replace(/\\\\/g, '\\');
    }

    /**
     * Escape special characters for TeamSpeak ClientQuery protocol.
     * This is a static method so it can be used by actions without a client instance.
     * @param str - The string to escape.
     */
    public static escape(str: string): string {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/\//g, '\\/')
            .replace(/\|/g, '\\p')
            .replace(/ /g, '\\s')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /** Whether the client is currently connected. */
    public get isConnected(): boolean {
        return this.connected;
    }
}
