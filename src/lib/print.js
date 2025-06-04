const log = (type, message, error = null) => {
	const timestamp = new Date().toLocaleString("id-ID");
	let output = `[${timestamp}] [BOT ${type.toUpperCase()}] ${message}`;

	if (error) {
		output += `\nError: ${error.message}`;
		if (error.stack) {
			output += `\nStack: ${error.stack}`;
		}
	}
	console.log(output);
};

/**
 * Print incoming message to the console.
 * It will always attempt to fetch group metadata using `sock.groupMetadata` if the message is from a group.
 * @param {object} m - The serialized message object.
 * @param {import('baileys').WASocket} sock - The Baileys socket object. This is essential for fetching group metadata.
 */
export const print = async (m, sock) => {
	if (!m || !m.messageTimestamp) {
		log("DEBUG", "Skipping print due to missing message or timestamp.", m);
		return;
	}

	const timestamp = new Date(m.messageTimestamp * 1000).toLocaleString(
		"id-ID"
	);
	let chatName = "Private Chat";

	if (m.isGroup) {
		// Crucial check: Ensure sock exists and has the groupMetadata method
		if (sock && typeof sock.groupMetadata === "function" && m.from) {
			try {
				const metadata = await sock.groupMetadata(m.from);
				chatName = metadata?.subject || `Group: ${m.from}`;
			} catch (e) {
				log(
					"WARN",
					`Could not fetch group metadata for ${m.from} in print: ${e.message}`
				);
				chatName = `Group: ${m.from}`;
			}
		} else {
			log(
				"WARN",
				"Sock or groupMetadata method not available for printing group name."
			);
			chatName = `Group: ${m.from}`;
		}
	}

	console.log("--- Incoming Message ---");
	console.log(
		`[${timestamp}] [${chatName}] From: ${m.pushName} (${m.sender.split("@")[0]})`
	);
	console.log(`[Type]: ${m.type}`);
	console.log(
		`[Body]: ${m.text ? m.text.substring(0, 100) + (m.text.length > 100 ? "..." : "") : "[Non-text message]"}`
	);
	if (m.isCommand) {
		console.log(`[Command]: ${m.prefix}${m.command} (Args: ${m.args})`);
	}
	console.log("------------------------");
};

export default {
	log: (type, message, error = null) => log(type, message, error),
	info: (message) => log("INFO", message),
	warn: (message) => log("WARN", message),
	error: (message, error) => log("ERROR", message, error),
	debug: (message) => log("DEBUG", message),
};
