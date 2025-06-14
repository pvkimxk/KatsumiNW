export default {
	name: "quoted",
	description: "Re-sends the content of a replied message (media or text).",
	command: ["q", "quoted"],
	permissions: "all",
	hidden: false,
	failed: "Failed to %command: %error",
	wait: null,
	category: "misc",
	cooldown: 5,
	limit: false,
	usage: "Reply to a message and send $prefix$command",
	react: true,

	/**
	 * @param {import('baileys').WASocket} sock - The Baileys socket object.
	 * @param {object} m - The serialized message object.
	 * @param {object} context - Additional context.
	 * @param {object} context.store - The store instance.
	 */
	execute: async (m, { sock }) => {
		const q = m.quoted ? m.quoted : m;
		if (!q) {
			return m.reply("Reply message!");
		}
		let c = await m.getQuotedObj();
		if (!c.quoted) {
			return m.reply("Message not found.");
		}
		await sock.copyNForward(m.from, c.quoted.fakeObj, true);
	},
};
