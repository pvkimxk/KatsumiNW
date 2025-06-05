const log = (type, message, error = null) => {
	const timestamp = new Date().toLocaleString("id-ID");
	let output = `[${timestamp}] [BOT ${type.toUpperCase()}] ${message}`;

	if (error instanceof Error) {
		output += `\nError: ${error.message}`;
		if (error.stack) {
			output += `\nStack: ${error.stack}`;
		}
	} else if (error) {
		output += `\nAdditional Info: ${JSON.stringify(error, null, 2)}`;
	}

	console.log(output);
};

/**
 * Print incoming message to the console.
 * @param {object} m - The serialized message object.
 * @param {import('baileys').WASocket} sock - The Baileys socket object.
 */
export const print = async (m, sock) => {
	if (!m || m.messageTimestamp === undefined || m.messageTimestamp === null) {
		log("DEBUG", "Skipping print due to missing message timestamp.");
		return;
	}

	try {
		const timestamp = new Date(m.messageTimestamp).toLocaleString("id-ID");
		let chatName = "Private Chat";

		if (m.isGroup) {
			// Use metadata from message if available
			if (m.metadata) {
				chatName = m.metadata.subject || `Group: ${m.from}`;
			}
			// Otherwise try to get from store/cache
			else if (sock.store) {
				const metadata = sock.store.getGroupMetadata(m.from);
				if (metadata) {
					chatName = metadata.subject || `Group: ${m.from}`;
				}
			}
		}

		console.log("--- Incoming Message ---");
		console.log(
			`[${timestamp}] [${chatName}] From: ${m.pushName} (${m.sender.split("@")[0]})`
		);
		console.log(`[Type]: ${m.type}`);
		console.log(
			`[Body]: ${m.body ? m.body.substring(0, 100) + (m.body.length > 100 ? "..." : "") : "[Non-text message]"}`
		);
		if (m.isCommand) {
			console.log(`[Command]: ${m.prefix}${m.command} (${m.args})`);
		}
		console.log("------------------------");
	} catch (error) {
		log("ERROR", "Failed to print message", error);
	}
};

export default {
	info: (message) => log("INFO", message),
	warn: (message) => log("WARN", message),
	error: (message, error) => log("ERROR", message, error),
	debug: (message) => log("DEBUG", message),
};
