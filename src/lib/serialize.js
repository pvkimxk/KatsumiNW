import {
	STORIES_JID,
	areJidsSameUser,
	chatModificationToAppPatch,
	downloadMediaMessage,
	extractMessageContent,
	generateWAMessage,
	generateWAMessageFromContent,
	jidDecode,
	jidNormalizedUser,
	proto,
} from "baileys";
import { fileTypeFromBuffer } from "file-type";
import Crypto from "node:crypto";
import { existsSync, promises } from "node:fs";
import { join } from "node:path";
import pino from "pino";
import { BOT_CONFIG } from "../config/index.js";

const randomId = (length = 16) => Crypto.randomBytes(length).toString("hex");

export const getContentType = (content) => {
	if (content) {
		const keys = Object.keys(content);
		return keys.find(
			(k) =>
				(k === "conversation" ||
					k.endsWith("Message") ||
					k.includes("V2") ||
					k.includes("V3")) &&
				k !== "senderKeyDistributionMessage"
		);
	}
	return null;
};

function parseMessage(content) {
	content = extractMessageContent(content);

	if (content?.viewOnceMessageV2Extension) {
		content = content.viewOnceMessageV2Extension.message;
	}
	if (content?.protocolMessage?.type === 14) {
		const type = getContentType(content.protocolMessage);
		content = content.protocolMessage[type];
	}
	if (content?.message) {
		const type = getContentType(content.message);
		content = content.message[type];
	}

	return content;
}

const parsePhoneNumber = (number) => {
	let cleaned = ("" + number).replace(/\D/g, "");
	if (cleaned.startsWith("62")) {
		if (cleaned.length >= 11 && cleaned.length <= 13) {
			return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)} ${cleaned.slice(6, 10)} ${cleaned.slice(10)}`;
		}
		if (cleaned.length === 10) {
			return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
		}
	}
	if (cleaned.startsWith("1")) {
		if (cleaned.length === 10) {
			return `+1 ${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
		}
		if (cleaned.length === 11) {
			return `+${cleaned.slice(0, 1)} ${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
		}
	}
	return number;
};

export function Client({ sock, store }) {
	const client = Object.defineProperties(sock, {
		sendAlbum: {
			async value(jid, array, quoted) {
				const album = generateWAMessageFromContent(
					jid,
					{
						messageContextInfo: {
							messageSecret: Crypto.randomBytes(32),
						},
						albumMessage: {
							expectedImageCount: array.filter((a) =>
								Object.prototype.hasOwnProperty.call(a, "image")
							).length,
							expectedVideoCount: array.filter((a) =>
								Object.prototype.hasOwnProperty.call(a, "video")
							).length,
						},
					},
					{
						userJid: sock.user.id,
						quoted,
						upload: sock.waUploadToServer,
					}
				);
				await sock.relayMessage(album.key.remoteJid, album.message, {
					messageId: album.key.id,
				});

				for (let content of array) {
					const img = await generateWAMessage(
						album.key.remoteJid,
						content,
						{
							upload: sock.waUploadToServer,
						}
					);
					img.message.messageContextInfo = {
						messageSecret: Crypto.randomBytes(32),
						messageAssociation: {
							associationType: 1,
							parentMessageKey: album.key,
						},
					};
					await sock.relayMessage(img.key.remoteJid, img.message, {
						messageId: img.key.id,
					});
				}

				return album;
			},
		},

		clearChat: {
			async value(jid, messages) {
				const msg = messages[messages.length - 1];
				const patch = chatModificationToAppPatch(
					{
						clear: true,
					},
					jid
				);

				patch.syncAction.clearChatAction = {
					messageRange: {
						lastMessageTimestamp: msg.messageTimestamp,
						messages,
					},
				};
				patch.index[2] = "0";
				return sock.appPatch(patch);
			},
		},

		sendStatusMentions: {
			async value(content, jids, opts = {}) {
				const targetJid = [];
				const statusJidList = [sock.user.id];

				const formatJid = (jid) => ({
					tag: "to",
					attrs: { jid },
					content: undefined,
				});

				const processJid = async (jid) => {
					if (jid.endsWith("@g.us")) {
						targetJid.push(formatJid(jid));
						const groupData = await store.getGroupMetadata(jid);
						statusJidList.push(
							...groupData.participants.map((j) => j.id)
						);
					} else {
						jid = jid.replace(/\D/g, "") + "@s.whatsapp.net";
						targetJid.push(formatJid(jid));
						statusJidList.push(jid);
					}
				};

				await Promise.all(jids.map(processJid));

				const media = await generateWAMessage(STORIES_JID, content, {
					upload: sock.waUploadToServer,
					...opts,
				});

				const additionalNodes = [
					{
						tag: "meta",
						attrs: {},
						content: [
							{
								tag: "mentioned_users",
								attrs: {},
								content: targetJid,
							},
						],
					},
				];

				await sock.relayMessage(STORIES_JID, media.message, {
					messageId: media.key.id,
					statusJidList,
					additionalNodes,
				});

				await Promise.all(
					targetJid.map(async (val) => {
						const jid = val.attrs.jid;
						const msgType = jid.endsWith("@g.us")
							? "groupStatusMentionMessage"
							: "statusMentionMessage";
						const msg = await generateWAMessageFromContent(
							jid,
							{
								[msgType]: {
									message: {
										protocolMessage: {
											key: media.key,
											type: 25,
										},
									},
								},
							},
							{}
						);

						const attrsType = jid.endsWith("@g.us")
							? "is_group_status_mention"
							: "is_status_mention";
						if (!opts.silent) {
							await sock.relayMessage(jid, msg.message, {
								additionalNodes: [
									{
										tag: "meta",
										attrs: { [attrsType]: "true" },
										content: undefined,
									},
								],
							});
						}
					})
				);

				return media;
			},
		},

		decodeJid: {
			value(jid) {
				if (!jid) {
					return jid;
				}
				if (/:\d+@/gi.test(jid)) {
					const decode = jidDecode(jid) || {};
					return (
						(decode.user &&
							decode.server &&
							`${decode.user}@${decode.server}`) ||
						jid
					);
				}
				return jid;
			},
		},

		getName: {
			value(jid) {
				const id = jidNormalizedUser(jid);
				if (id.endsWith("g.us")) {
					const metadata = store.getGroupMetadata(id);
					return metadata?.subject;
				}
				const contact = store.getContact(id);
				return (
					contact?.name ||
					contact?.verifiedName ||
					contact?.notify ||
					parsePhoneNumber("+" + id.split("@")[0])
				);
			},
		},

		sendContact: {
			async value(jid, numbers, quoted, options = {}) {
				const list = numbers
					.filter((v) => !v.endsWith("g.us"))
					.map((v) => {
						const cleaned = v.replace(/\D+/g, "");
						const jid = `${cleaned}@s.whatsapp.net`;
						return {
							displayName: sock.getName(jid),
							vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${sock.getName(jid)}\nFN:${sock.getName(jid)}\nitem1.TEL;waid=${cleaned}:${cleaned}\nEND:VCARD`,
						};
					});

				return sock.sendMessage(
					jid,
					{
						contacts: {
							displayName: `${list.length} Contact${list.length > 1 ? "s" : ""}`,
							contacts: list,
						},
					},
					{ quoted, ...options }
				);
			},
			enumerable: true,
		},

		parseMention: {
			value(text) {
				return (
					[...text.matchAll(/@([0-9]{5,16}|0)/g)].map(
						(v) => v[1] + "@s.whatsapp.net"
					) || []
				);
			},
		},

		downloadMediaMessage: {
			async value(message, filename) {
				let media = await downloadMediaMessage(
					message,
					"buffer",
					{},
					{
						logger: pino({
							timestamp: () => `,"time":"${new Date().toJSON()}"`,
							level: "fatal",
						}).child({ class: "sock" }),
						reuploadRequest: sock.updateMediaMessage,
					}
				);

				if (filename) {
					let mime = await fileTypeFromBuffer(media);
					let filePath = join(
						process.cwd(),
						`${filename}.${mime.ext}`
					);
					await promises.writeFile(filePath, media);
					return filePath;
				}

				return media;
			},
			enumerable: true,
		},

		cMod: {
			value(jid, copy, text = "", sender = sock.user.id, options = {}) {
				let mtype = getContentType(copy.message);
				let content = copy.message[mtype];

				if (typeof content === "string") {
					copy.message[mtype] = text || content;
				} else if (content.caption) {
					content.caption = text || content.caption;
				} else if (content.text) {
					content.text = text || content.text;
				}

				if (typeof content !== "string") {
					copy.message[mtype] = { ...content, ...options };
					copy.message[mtype].contextInfo = {
						...(content.contextInfo || {}),
						mentionedJid:
							options.mentions ||
							content.contextInfo?.mentionedJid ||
							[],
					};
				}

				if (copy.key.participant) {
					sender = copy.key.participant =
						sender || copy.key.participant;
				}

				if (copy.key.remoteJid.includes("@s.whatsapp.net")) {
					sender = sender || copy.key.remoteJid;
				} else if (copy.key.remoteJid.includes("@broadcast")) {
					sender = sender || copy.key.remoteJid;
				}

				copy.key.remoteJid = jid;
				copy.key.fromMe = areJidsSameUser(sender, sock.user.id);
				return proto.WebMessageInfo.fromObject(copy);
			},
			enumerable: false,
		},
	});

	return client;
}

export default async function serialize(sock, msg, store, prefixes = []) {
	const m = {};

	if (!msg.message) {
		return null;
	}
	if (!msg) {
		return msg;
	}

	m.message = parseMessage(msg.message);
	m.messageTimestamp =
		msg.messageTimestamp ||
		(msg.key && msg.key.timestamp) ||
		Date.now() / 1000;

	if (msg.key) {
		m.key = msg.key;
		m.from = m.key.remoteJid.startsWith("status")
			? jidNormalizedUser(m.key?.participant || msg.participant)
			: jidNormalizedUser(m.key.remoteJid);
		m.fromMe = m.key.fromMe;
		m.id = m.key.id;
		m.device = /^3A/.test(m.id)
			? "ios"
			: m.id.startsWith("3EB")
				? "web"
				: /^.{21}/.test(m.id)
					? "android"
					: /^.{18}/.test(m.id)
						? "desktop"
						: "unknown";
		m.isBot = m.id.startsWith("BAE5") || m.id.startsWith("HSK");
		m.isGroup = m.from.endsWith("@g.us");
		m.participant =
			jidNormalizedUser(msg?.participant || m.key.participant) || false;
		m.sender = jidNormalizedUser(
			m.fromMe ? sock.user.id : m.isGroup ? m.participant : m.from
		);
	}

	if (m.isGroup) {
		let metadata = store.getGroupMetadata(m.from);
		if (!metadata) {
			try {
				metadata = await sock.groupMetadata(m.from);
				store.setGroupMetadata(m.from, metadata);
			} catch (error) {
				console.error(
					`Failed to fetch group metadata for ${m.from}:`,
					error
				);
				metadata = null;
			}
		}

		if (metadata) {
			m.metadata = metadata;
			m.groupAdmins = metadata.participants
				.filter((p) => p.admin)
				.map((p) => ({
					id: p.id,
					admin: p.admin,
				}));

			m.isAdmin = m.groupAdmins.some((admin) => admin.id === m.sender);
			m.isBotAdmin = m.groupAdmins.some(
				(admin) => admin.id === sock.user.id
			);
		} else {
			m.metadata = null;
			m.groupAdmins = [];
			m.isAdmin = false;
			m.isBotAdmin = false;
		}
	}

	m.pushName = msg.pushName;
	m.isOwner = m.sender && BOT_CONFIG.ownerJids.includes(m.sender);

	if (m.message) {
		m.type = getContentType(m.message) || Object.keys(m.message)[0];
		let edited = m.message.editedMessage?.message?.protocolMessage;
		let msg = edited?.editedMessage || m.message;
		msg = m.type == "conversation" ? msg : msg[m.type];

		if (edited?.editedMessage) {
			m.message = msg =
				store.loadMessage(m.from.toString(), edited.key.id).message ||
				edited.editedMessage;
			msg = msg[getContentType(msg)];
		}
		m.msg = parseMessage(m.message[m.type]) || m.message[m.type];
		m.mentions = [
			...(m.msg?.contextInfo?.mentionedJid || []),
			...(m.msg?.contextInfo?.groupMentions?.map((v) => v.groupJid) ||
				[]),
		];
		m.body =
			m.msg?.text ||
			m.msg?.conversation ||
			m.msg?.caption ||
			m.message?.conversation ||
			m.msg?.selectedButtonId ||
			m.msg?.singleSelectReply?.selectedRowId ||
			m.msg?.selectedId ||
			m.msg?.contentText ||
			m.msg?.selectedDisplayText ||
			m.msg?.title ||
			m.msg?.name ||
			"";

		m.prefix = "";
		m.plugins = [];
		m.isCommand = false;

		if (m.body) {
			const isOwner = BOT_CONFIG.ownerJids.includes(m.sender);
			let foundPrefix = false;

			if (!isOwner) {
				for (const prefix of prefixes) {
					if (m.body.startsWith(prefix)) {
						m.prefix = prefix;
						foundPrefix = true;
						break;
					}
				}

				if (!foundPrefix) {
					m.isCommand = false;
					return m;
				}
			}

			if (!m.isCommand) {
				const regexPrefix = /^[°•π÷×¶∆£¢€¥®™+✓=|/~!?@#%^&.©^]/;
				if (regexPrefix.test(m.body)) {
					m.prefix = m.body.match(regexPrefix)[0];
					m.isCommand = true;
				}
			}
		}

		m.command = m.body
			.replace(m.prefix, "")
			.trim()
			.split(/\s+/)
			.shift()
			.toLowerCase();

		m.args = m.body
			.replace(m.prefix, "")
			.replace(m.command, "")
			.trim()
			.split(/\s+/)
			.filter((arg) => arg);

		m.text = m.args.join(" ");
		m.expiration = m.msg?.contextInfo?.expiration || 0;
		m.timestamps = msg.messageTimestamp * 1000;
		m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath;

		m.isQuoted = false;
		if (m.msg?.contextInfo?.quotedMessage) {
			m.isQuoted = true;
			m.quoted = {};
			m.quoted.message = parseMessage(m.msg.contextInfo.quotedMessage);

			if (m.quoted.message) {
				m.quoted.type =
					getContentType(m.quoted.message) ||
					Object.keys(m.quoted.message)[0];
				m.quoted.msg =
					parseMessage(m.quoted.message[m.quoted.type]) ||
					m.quoted.message[m.quoted.type];
				m.quoted.isMedia =
					!!m.quoted.msg?.mimetype ||
					!!m.quoted.msg?.thumbnailDirectPath;
				m.quoted.key = {
					remoteJid: m.msg.contextInfo.remoteJid || m.from,
					participant: jidNormalizedUser(
						m.msg.contextInfo.participant
					),
					fromMe: areJidsSameUser(
						jidNormalizedUser(m.msg.contextInfo.participant),
						jidNormalizedUser(sock?.user?.id)
					),
					id: m.msg.contextInfo.stanzaId,
				};
				m.quoted.from = m.quoted.key.remoteJid;
				m.quoted.fromMe = m.quoted.key.fromMe;
				m.quoted.id = m.quoted.key.id;
				m.quoted.device = /^3A/.test(m.quoted.id)
					? "ios"
					: /^3E/.test(m.quoted.id)
						? "web"
						: /^.{21}/.test(m.quoted.id)
							? "android"
							: /^.{18}/.test(m.quoted.id)
								? "desktop"
								: "unknown";
				m.quoted.isBot =
					m.quoted.id.startsWith("BAE5") ||
					m.quoted.id.startsWith("HSK");
				m.quoted.isGroup = m.quoted.from.endsWith("@g.us");
				m.quoted.participant =
					jidNormalizedUser(m.msg.contextInfo.participant) || false;
				m.quoted.sender = jidNormalizedUser(
					m.msg.contextInfo.participant || m.quoted.from
				);
				m.quoted.mentions = [
					...(m.quoted.msg?.contextInfo?.mentionedJid || []),
					...(m.quoted.msg?.contextInfo?.groupMentions?.map(
						(v) => v.groupJid
					) || []),
				];
				m.quoted.body =
					m.quoted.msg?.text || m.quoted.msg?.caption || "";

				// Handle quoted prefixes
				m.quoted.prefix = "";
				if (m.quoted.body) {
					for (const prefix of prefixes) {
						if (m.quoted.body.startsWith(prefix)) {
							m.quoted.prefix = prefix;
							break;
						}
					}

					if (!m.quoted.prefix) {
						const regexPrefix =
							/^[°•π÷×¶∆£¢€¥®™+✓=|/~!?@#%^&.©^]/;
						if (regexPrefix.test(m.quoted.body)) {
							m.quoted.prefix =
								m.quoted.body.match(regexPrefix)[0];
						}
					}
				}

				m.quoted.command = m.quoted.body
					.replace(m.quoted.prefix, "")
					.trim()
					.split(/\s+/)
					.shift()
					.toLowerCase();

				m.quoted.args = m.quoted.body
					.replace(m.quoted.prefix, "")
					.replace(m.quoted.command, "")
					.trim()
					.split(/\s+/)
					.filter((arg) => arg);

				m.quoted.text = m.quoted.args.join(" ");
				m.quoted.url =
					(m.quoted.text.match(
						/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi
					) || [])[0] || "";
				m.quoted.isOwner =
					m.quoted.sender &&
					BOT_CONFIG.ownerJids.includes(m.quoted.sender);
			}
		}
	}

	// m.reply = async (content, options = {}) => {
	// 	try {
	// 		if (typeof content === "string") {
	// 			return await sock.sendMessage(
	// 				m.from,
	// 				{ text: content, ...options },
	// 				{ quoted: m, ephemeralExpiration: m.expiration, ...options }
	// 			);
	// 		}
	// 		return await sock.sendMessage(m.from, content, {
	// 			quoted: m,
	// 			ephemeralExpiration: m.expiration,
	// 			...options,
	// 		});
	// 	} catch (error) {
	// 		console.error("Failed to send reply:", error);
	// 	}
	// };
	m.reply = async (content, options = {}) => {
		let chatId = options?.from ? options.from : m.from;
		let quoted = options?.quoted ? options.quoted : m;
		const text = content;

		if (
			Buffer.isBuffer(text) ||
			/^data:.?\/.*?;base64,/i.test(text) ||
			/^https?:\/\//.test(text) ||
			existsSync(text)
		) {
			let data = await getFile(text);
			if (
				!options.mimetype &&
				(/utf-8|json/i.test(data.mime) ||
					data.ext == ".bin" ||
					!data.ext)
			) {
				return sock.sendMessage(
					chatId,
					{
						text: data.data.toString(),
						mentions: [m.sender, ...sock.parseMention(text)],
						...options,
					},
					{
						quoted,
						ephemeralExpiration: m.expiration,
						messageId: randomId(32),
						...options,
					}
				);
			}
			return sock.sendMedia(chatId, data.data, quoted, {
				ephemeralExpiration: m.expiration,
				messageId: randomId(32),
				...options,
			});
		}

		if (typeof text === "object" && !Array.isArray(text)) {
			return sock.sendMessage(
				chatId,
				{
					...text,
					mentions: [
						m.sender,
						...sock.parseMention(JSON.stringify(text)),
					],
					...options,
				},
				{
					quoted,
					ephemeralExpiration: m.expiration,
					messageId: randomId(32),
					...options,
				}
			);
		}

		if (typeof text === "string") {
			return sock.sendMessage(
				chatId,
				{
					text,
					mentions: [m.sender, ...sock.parseMention(text)],
					...options,
				},
				{
					quoted,
					ephemeralExpiration: m.expiration,
					messageId: randomId(32),
					...options,
				}
			);
		}
	};

	m.react = (emoji) => {
		try {
			return sock.sendMessage(m.from, {
				react: {
					text: String(emoji),
					key: m.key,
				},
			});
		} catch (error) {
			console.error("Failed to send reaction:", error);
		}
	};

	m.delete = () => {
		try {
			return sock.sendMessage(m.from, { delete: m.key });
		} catch (error) {
			console.error("Failed to delete message:", error);
		}
	};

	return m;
}
