import { downloadMediaMessage, getContentType } from "baileys";

/**
 * Extract message body based on message type
 * @param {object} message
 * @param {string} mtype
 * @returns {string}
 */
const getMessageBody = (message, mtype) => {
	if (!message) {
		return "";
	}

	switch (mtype) {
		case "conversation":
			return message.conversation || "";
		case "extendedTextMessage":
			return message.extendedTextMessage?.text || "";
		case "imageMessage":
		case "videoMessage":
		case "documentMessage":
		case "stickerMessage":
		case "audioMessage":
			return message[mtype]?.caption || "";
		case "buttonsResponseMessage":
			return message.buttonsResponseMessage?.selectedButtonId || "";
		case "listResponseMessage":
			return (
				message.listResponseMessage?.singleSelectReply?.selectedRowId ||
				""
			);
		case "locationMessage":
			return message.locationMessage?.address || "";
		case "contactMessage":
			return message.contactMessage?.displayName || "";
		case "contactsArrayMessage":
			return (message.contactsArrayMessage?.contacts || [])
				.map((c) => c.displayName)
				.join(", ");
		default:
			return "";
	}
};

/**
 * Serialize Baileys message object into enhanced format
 * @param {import('baileys').proto.IWebMessageInfo} msg
 * @param {import('baileys').WASocket} sock
 * @param {string[]} prefixes
 * @returns {object}
 */
export const serializeMessage = (msg, sock, prefixes) => {
	if (!msg.message) {
		const minimal = {
			...msg,
			type: "unknown",
			body: "",
			text: "",
			mtype: "unknown",
			expiration: 0,
			from: msg.key.remoteJid,
			chat: msg.key.remoteJid,
			id: msg.key.id,
			timestamp: msg.messageTimestamp || msg.key.timestamp,
			isGroup: msg.key.remoteJid?.endsWith("@g.us") || false,
			sender: msg.key.participant || msg.key.remoteJid,
			pushName:
				msg.pushName || (msg.key.participant || "").split("@")[0] || "",
			budy: "",
			prefix: null,
			isCommand: false,
			command: "",
			args: "",
			isQuoted: false,
			quoted: null,
			mentionedJid: [],
			isMedia: false,
			isImage: false,
			isVideo: false,
			isAudio: false,
			isDocument: false,
			isSticker: false,
			download: async () => null,
			reply: async (text, options = {}) => {
				return sock?.sendMessage(
					msg.key.remoteJid,
					{ text: text },
					{ ...options }
				);
			},
			metadata: null,
		};
		return minimal;
	}

	const m = { ...msg };

	m.type = Object.keys(m.message)[0] || "unknown";
	m.mtype = getContentType(m.message);
	m.expiration = m.message?.[m.mtype]?.contextInfo?.expiration || 0;
	m.body = getMessageBody(m.message, m.mtype);
	m.text = m.body;

	m.from = m.key.remoteJid;
	m.chat = m.from;
	m.id = m.key.id;
	m.timestamp = m.messageTimestamp || m.key.timestamp;
	m.isGroup = m.from.endsWith("@g.us");
	m.sender = m.isGroup ? m.key.participant || m.from : m.from;
	m.pushName = msg.pushName || m.sender.split("@")[0];
	m.budy = typeof m.body === "string" ? m.body.toLowerCase().trim() : "";

	m.prefix = prefixes.find((p) => m.budy.startsWith(p)) || null;
	m.isCommand = !!m.prefix;
	m.command =
		m.isCommand && typeof m.budy === "string"
			? m.budy.slice(m.prefix.length).split(/\s+/)[0]
			: "";
	m.args = m.isCommand
		? m.budy.slice(m.prefix.length + m.command.length).trim()
		: "";

	const mediaTypes = [
		"imageMessage",
		"videoMessage",
		"documentMessage",
		"audioMessage",
		"stickerMessage",
	];
	m.isMedia = mediaTypes.includes(m.mtype);
	m.isImage = m.mtype === "imageMessage";
	m.isVideo = m.mtype === "videoMessage";
	m.isAudio = m.mtype === "audioMessage";
	m.isDocument = m.mtype === "documentMessage";
	m.isSticker = m.mtype === "stickerMessage";

	m.mentionedJid =
		m.mtype === "extendedTextMessage"
			? m.message.extendedTextMessage?.contextInfo?.mentionedJid || []
			: [];

	m.isQuoted = !!m.message?.[m.mtype]?.contextInfo?.quotedMessage;
	if (m.isQuoted) {
		const ctx = m.message[m.mtype].contextInfo;
		const qMsg = ctx.quotedMessage;
		const qType = getContentType(qMsg);

		m.quoted = {
			id: ctx.stanzaId,
			participant: ctx.participant,
			type: qType,
			body: getMessageBody(qMsg, qType),
			text: getMessageBody(qMsg, qType),
			sender: ctx.participant,
			isMe: ctx.participant === sock.user?.id,
			download: async () => {
				try {
					return await downloadMediaMessage(
						{
							key: { remoteJid: m.from, id: ctx.stanzaId },
							message: qMsg,
						},
						"buffer",
						{}
					);
				} catch (e) {
					console.error("Error downloading quoted media:", e);
					return null;
				}
			},
		};
	} else {
		m.quoted = null;
	}

	m.download = async () => {
		if (!m.isMedia) {
			return null;
		}
		try {
			return await downloadMediaMessage(m, "buffer", {});
		} catch (error) {
			console.error("Error downloading media:", error);
			return null;
		}
	};

	m.reply = async (content, options = {}) => {
		const messageContent =
			typeof content === "string" ? { text: content } : content;
		return sock.sendMessage(m.from, messageContent, {
			ephemeralExpiration: m.expiration,
			quoted: m,
			...options,
		});
	};

	// Placeholder for group metadata
	m.metadata = null;

	return m;
};
