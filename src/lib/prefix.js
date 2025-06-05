import { BOT_CONFIG } from "../config/index.js";

/**
 * Determines the prefix for a given message body and sender.
 * Owner can use no-prefix or prefix, regular users must use a prefix.
 *
 * @param {string} body - The message body.
 * @param {string} senderJid - The JID of the sender (e.g., "6285175106460@s.whatsapp.net").
 * @returns {{prefix: string, isCommand: boolean, command: string, args: string[], text: string}} An object containing prefix, isCommand, command, args, and text.
 */
export function getPrefix(body, m) {
	const isOwner = m.isOwner;
	const prefixes = BOT_CONFIG.prefixes;

	let prefix = "";
	let isCommand = false;
	let command = "";
	let args = [];
	let text = "";

	if (!body) {
		return { prefix, isCommand, command, args, text };
	}

	for (const p of prefixes) {
		if (body.startsWith(p)) {
			prefix = p;
			isCommand = true;
			break;
		}
	}

	if (!isCommand && isOwner) {
		const parts = body.trim().split(/\s+/);
		if (parts.length > 0) {
			command = parts[0].toLowerCase();
			args = parts.slice(1);
			text = args.join(" ");
			isCommand = true;
		}
	} else if (isCommand) {
		const contentWithoutPrefix = body.substring(prefix.length).trim();
		const parts = contentWithoutPrefix.split(/\s+/);
		command = parts.shift()?.toLowerCase() || "";
		args = parts;
		text = args.join(" ");
	}

	return { prefix, isCommand, command, args, text };
}
