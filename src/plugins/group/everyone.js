export default {
	name: "hidetag",
	description: "Annoying message.",
	command: ["ht", "everyone"],
	permissions: "admin",
	hidden: false,
	failed: "Failed to %command: %error",
	wait: null,
	category: "misc",
	cooldown: 5,
	limit: false,
	usage: "$prefix$command <text>",
	react: false,
	botAdmin: false,
	group: true,
	private: false,
	owner: false,

	/**
	 * @param {import('baileys').WASocket} sock - The Baileys socket object.
	 * @param {object} m - The serialized message object.
	 * @param {object} text - Additional text.
	 */
	execute: async (m, { groupMetadata, text }) => {
		const q = m.isQuoted ? m.quoted : m;
		const len = groupMetadata.participants.length;
		const mentions = [];
		for (let i = 0; i < len; i++) {
			const serialized = groupMetadata.participants[i].id.split("@")[0];
			mentions.push({
				tag: `@${serialized}\n`,
				mention: `${serialized}@s.whatsapp.net`,
			});
		}

		await m.reply({
			text: text ? text : q.text || "",
			mentions: mentions.map((mention) => mention.mention),
		});
	},
};
