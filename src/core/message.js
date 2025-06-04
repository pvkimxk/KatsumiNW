import { print } from "../lib/print.js";
import { serializeMessage } from "../lib/serialize.js";

/**
 * Class for processing incoming messages and routing them to the PluginManager.
 */
class Message {
	/**
	 * @param {import('../lib/plugins.js').default} pluginManager - The plugin manager instance.
	 * @param {object} botConfig - Bot configuration.
	 * @param {import('node-cache')} groupMetadataCache - Cache for group metadata.
	 */
	constructor(pluginManager, botConfig, groupMetadataCache) {
		this.pluginManager = pluginManager;
		this.botConfig = botConfig;
		this.groupMetadataCache = groupMetadataCache;
	}

	/**
	 * Handle 'messages.upsert' event from Baileys.
	 * @param {import('baileys').WASocket} sock - Baileys socket object.
	 * @param {{ messages: import('baileys').proto.IWebMessageInfo[], type: string }} data - Message data from the event.
	 */
	async process(sock, { messages, type }) {
		if (type !== "notify") {
			return;
		}

		for (const msg of messages) {
			if (
				!msg.message ||
				msg.key.fromMe ||
				msg.message.ephemeralMessage ||
				msg.key.remoteJid === "status@broadcast"
			) {
				continue;
			}

			const m = serializeMessage(msg, sock, this.botConfig.prefixes);
			if (!m.body) {
				continue;
			}

			if (m.isGroup) {
				m.metadata = this.groupMetadataCache.get(m.from) || null;
			}

			print(m, sock);

			if (m.isCommand) {
				await this.pluginManager.enqueueCommand(sock, m);
			}
		}
	}
}

export default Message;
