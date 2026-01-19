import { Telnet } from "telnet-client";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 25639;
const SHELL_PROMPT = /\r\n$/;
const TIMEOUT = 5000;

export interface QueryClientOptions {
	host?: string;
	port?: number;
	apiKey?: string;
}

export interface QueryResponse {
	data: Record<string, string>[];
	error: {
		id: number;
		msg: string;
	};
}

export class QueryClient {
	private telnet: Telnet;
	private options: Required<QueryClientOptions>;
	private connected = false;

	constructor(options: QueryClientOptions = {}) {
		this.telnet = new Telnet();
		this.options = {
			host: options.host ?? DEFAULT_HOST,
			port: options.port ?? DEFAULT_PORT,
			apiKey: options.apiKey ?? "",
		};
	}

	async connect(): Promise<void> {
		await this.telnet.connect({
			host: this.options.host,
			port: this.options.port,
			shellPrompt: SHELL_PROMPT,
			negotiationMandatory: false,
			timeout: TIMEOUT,
		});
		this.connected = true;

		if (this.options.apiKey) {
			await this.authenticate(this.options.apiKey);
		}
	}

	async disconnect(): Promise<void> {
		if (this.connected) {
			await this.telnet.end();
			this.connected = false;
		}
	}

	async authenticate(apiKey: string): Promise<void> {
		const response = await this.execute(`auth apikey=${apiKey}`);
		if (response.error.id !== 0) {
			throw new Error(`Authentication failed: ${response.error.msg}`);
		}
	}

	async execute(command: string): Promise<QueryResponse> {
		if (!this.connected) {
			throw new Error("Not connected to TeamSpeak 3 ClientQuery");
		}

		const raw = await this.telnet.exec(command);
		return this.parseResponse(raw);
	}

	private parseResponse(raw: string): QueryResponse {
		const lines = raw.trim().split("\r\n").filter(Boolean);
		const errorLine = lines.find((line) => line.startsWith("error "));
		const dataLines = lines.filter((line) => !line.startsWith("error "));

		const error = this.parseErrorLine(errorLine ?? "error id=0 msg=ok");
		const data = dataLines.flatMap((line) => this.parseDataLine(line));

		return { data, error };
	}

	private parseErrorLine(line: string): QueryResponse["error"] {
		const params = this.parseParams(line.replace(/^error\s*/, ""));
		return {
			id: parseInt(params.id ?? "0", 10),
			msg: this.unescape(params.msg ?? "ok"),
		};
	}

	private parseDataLine(line: string): Record<string, string>[] {
		return line.split("|").map((entry) => {
			const params = this.parseParams(entry);
			const unescaped: Record<string, string> = {};
			for (const [key, value] of Object.entries(params)) {
				unescaped[key] = this.unescape(value);
			}
			return unescaped;
		});
	}

	private parseParams(str: string): Record<string, string> {
		const params: Record<string, string> = {};
		const regex = /(\w+)(?:=([^\s]*))?/g;
		let match: RegExpExecArray | null;

		while ((match = regex.exec(str)) !== null) {
			const [, key, value] = match;
			params[key] = value ?? "";
		}

		return params;
	}

	private unescape(str: string): string {
		return str
			.replace(/\\s/g, " ")
			.replace(/\\p/g, "|")
			.replace(/\\n/g, "\n")
			.replace(/\\r/g, "\r")
			.replace(/\\t/g, "\t")
			.replace(/\\\//g, "/")
			.replace(/\\\\/g, "\\");
	}

	get isConnected(): boolean {
		return this.connected;
	}
}
