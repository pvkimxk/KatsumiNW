import { getPrefix } from "../lib/prefix.js";
import { print } from "../lib/print.js";
import serialize from "../lib/serialize.js";

/**
 * Class for processing incoming messages and routing them to the PluginManager.
 */
class Message {
	/**
	 * @param {import('../lib/plugins.js').default} pluginManager - The plugin manager instance.
	 * @param {string[]} ownerJids - An array of owner JIDs (raw numbers).
	 * @param {string[]} prefixes - An array of bot prefixes.
	 * @param {import('node-cache')} groupMetadataCache - Cache for group metadata.
	 * @param {import('../lib/store.local.js')} store - Store instance.
	 */
	constructor(pluginManager, ownerJids, prefixes, groupMetadataCache, store) {
		this.pluginManager = pluginManager;
		this.ownerJids = ownerJids;
		this.prefixes = prefixes;
		this.groupMetadataCache = groupMetadataCache;
		this.store = store;
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
			try {
				if (
					!msg.message ||
					msg.key.fromMe ||
					msg.message.ephemeralMessage ||
					msg.key.remoteJid === "status@broadcast"
				) {
					continue;
				}

				if (!msg.messageTimestamp) {
					msg.messageTimestamp = Date.now() / 1000;
				}

				const m = await serialize(sock, msg, this.store);

				this.store.saveMessage(m.from, msg);

				if (!m || !m.body) {
					continue;
				}

				const { prefix, isCommand, command, args, text } = getPrefix(
					m.body,
					m.sender
				);

				m.prefix = prefix;
				m.isCommand = isCommand;
				m.command = command;
				m.args = args;
				m.text = text;

				m.plugins = this.pluginManager.getPlugins() || [];

				await print(m, sock);

				if (m.isCommand) {
					await this.pluginManager.enqueueCommand(sock, m);
				}
			} catch (error) {
				console.error("Error processing message:", error);
			}
		}
	}
}

export default Message;
