export default {
	name: "readviewonce",
	description: "Readviewonce message.",
	command: ["rvo", "readviewonce"],
	permissions: "all",
	hidden: false,
	failed: "Failed to %command: %error",
	wait: null,
	category: "misc",
	cooldown: 5,
	limit: false,
	usage: "$prefix$command <reply_view_once>",
	react: true,
	botAdmin: false,
	group: false,
	private: false,
	owner: false,

	/**
	 * @param {import('baileys').WASocket} sock - The Baileys socket object.
	 * @param {object} m - The serialized message object.
	 */
	async execute({ m, sock }) {
		const q = m.quoted ? m.quoted : m;
		const type = Object.keys(q.message || q)[0];
		if (!q.message?.[type].viewOnce) {
			return m.reply("This message isn't viewonce.");
		}
		const txt = q.message[type].caption || "";
		const buffer = await q.download();
		if (/audio/.test(type)) {
			return await sock.sendMessage(
				m.from,
				{ audio: buffer, ptt: true },
				{ quoted: m, ephemeralExpiration: m.expiration }
			);
		}
		await sock.sendMessage(
			m.from,
			{
				[type.includes("image") ? "image" : "video"]: buffer,
				caption: txt,
			},
			{ quoted: m, ephemeralExpiration: m.expiration }
		);
	},
};
