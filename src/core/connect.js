import {
	Browsers,
	DisconnectReason,
	fetchLatestBaileysVersion,
	makeCacheableSignalKeyStore,
	makeWASocket,
} from "baileys";
import { useMySQLAuthState } from "mysql-baileys";
import NodeCache from "node-cache";
import readline from "node:readline";
import qrcode from "qrcode";
import { BOT_CONFIG, MYSQL_CONFIG } from "../config/index.js";
import logger from "../lib/logger.js";
import PluginManager from "../lib/plugin.js";
import print from "../lib/print.js";
import MessageProcessor from "./message.js";

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

/**
 * Prompts the user for input.
 * @param {string} query The question to ask the user.
 * @returns {Promise<string>} A promise that resolves with the user's input.
 */
function askQuestion(query) {
	return new Promise((resolve) =>
		rl.question(query, (ans) => {
			resolve(ans);
		})
	);
}

/**
 * Main class to manage the WhatsApp bot connection and events.
 */
class WhatsAppBot {
	constructor() {
		this.sock = null;
		this.sessionName = BOT_CONFIG.sessionName;
		this.groupMetadataCache = new NodeCache({
			stdTTL: 3600,
			checkperiod: 120,
		});
		this.pluginManager = new PluginManager(BOT_CONFIG);
		this.messageProcessor = new MessageProcessor(
			this.pluginManager,
			BOT_CONFIG,
			this.groupMetadataCache
		);
	}

	/**
	 * Start Baileys connection and manages events.
	 */
	async start() {
		print.info(`Starting WhatsApp Bot session: ${this.sessionName}`);

		const { error, version } = await fetchLatestBaileysVersion();
		if (error) {
			print.error(
				`Failed to fetch latest Baileys version: ${error.message}. Retrying in 5 seconds...`,
				error
			);
			await new Promise((resolve) => setTimeout(resolve, 5000));
			return this.start();
		}
		print.info(`Baileys version: ${version.join(".")}`);

		await this.pluginManager.loadPlugins();
		this.pluginManager.watchPlugins();

		const { state, saveCreds, removeCreds } = await useMySQLAuthState({
			...MYSQL_CONFIG,
			session: this.sessionName,
		});

		let usePairingCode = false;
		if (!state.creds.me) {
			const loginChoice = await askQuestion(
				"Choose login method: (1) QR Code or (2) Pairing Code? Enter 1 or 2: "
			);
			usePairingCode = loginChoice.trim() === "2";
		}

		this.sock = makeWASocket({
			auth: {
				creds: state.creds,
				keys: makeCacheableSignalKeyStore(state.keys, logger),
			},
			version,
			logger,
			cachedGroupMetadata: async (jid) => {
				let metadata = this.groupMetadataCache.get(jid);
				if (!metadata) {
					try {
						metadata = await this.sock.groupMetadata(jid);
						this.groupMetadataCache.set(jid, metadata);
						print.debug(`Cached metadata for group: ${jid}`);
					} catch (e) {
						print.error(
							`Failed to fetch group metadata for ${jid}:`,
							e
						);
					}
				}
				return metadata;
			},
			defaultQueryTimeoutMs: undefined,
			browser: Browsers.macOS("Safari"),
			generateHighQualityLinkPreview: true,
			qrTimeout: usePairingCode ? undefined : 60000,
		});

		// --- Event Handlers ---

		this.sock.ev.on("creds.update", saveCreds);

		// Handle connection status
		this.sock.ev.on("connection.update", async (update) => {
			const { connection, lastDisconnect, qr } = update;

			if (!usePairingCode && qr) {
				print.info(`Scan QR Code for session ${this.sessionName}:`);
				console.log(
					await qrcode.toString(qr, { type: "terminal", small: true })
				);
			}

			if (
				usePairingCode &&
				connection === "connecting" &&
				!state.creds.me
			) {
				const phoneNumber = await askQuestion(
					"Enter your phone number (E.164 format, WITHOUT + sign, e.g., 6281234567890): "
				);
				if (phoneNumber) {
					try {
						const code = await this.sock.requestPairingCode(
							phoneNumber.trim()
						);
						print.info(`Your Pairing Code: ${code}`);
						print.info(
							"Enter this code on your WhatsApp phone: Settings -> Linked Devices -> Link a Device -> Link with phone number instead."
						);
					} catch (e) {
						print.error("Failed to request pairing code:", e);
					} finally {
						rl.close();
					}
				} else {
					print.error(
						"No phone number provided for pairing code. Please restart the bot and try again."
					);
					rl.close();
					process.exit(1);
				}
			}

			if (connection === "close") {
				const shouldReconnect =
					lastDisconnect?.error?.output?.statusCode !==
					DisconnectReason.loggedOut;
				print.warn(
					`Connection closed for session ${this.sessionName}. Reason: ${lastDisconnect?.error?.message || "Unknown"}. Reconnecting: ${shouldReconnect}`
				);

				if (
					lastDisconnect?.error?.output?.statusCode ===
					DisconnectReason.loggedOut
				) {
					await removeCreds();
					print.info(
						`Session ${this.sessionName} logged out. Credentials removed. Please restart bot to get a new QR code.`
					);
				}

				if (shouldReconnect) {
					this.start();
				} else {
					rl.close();
					process.exit(1);
				}
			} else if (connection === "open") {
				print.info(
					`Connection opened successfully for session ${this.sessionName}.`
				);
				rl.close();
			}
		});

		this.sock.ev.on("messages.upsert", (data) =>
			this.messageProcessor.process(this.sock, data)
		);

		this.sock.ev.on("chats.update", (_chats) => {
			// print.debug('Chats updated:', chats); // Enable if want to see this log
		});

		this.sock.ev.on(
			"group-participants.update",
			async ({ id, participants, action }) => {
				print.info(
					`Group participants updated for ${id}: ${action} ${participants.join(", ")}`
				);
				try {
					const metadata = await this.sock.groupMetadata(id);
					this.groupMetadataCache.set(id, metadata);
					print.debug(
						`Updated group metadata cache for ${id} due to participant change.`
					);
				} catch (e) {
					print.error(
						`Failed to update group metadata for ${id} on participant change:`,
						e
					);
				}
			}
		);

		// Add other event handlers as needed
	}
}

export default WhatsAppBot;
