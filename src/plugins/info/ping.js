export default {
	name: "ping",
	description: "Displays bot response speed.",
	command: ["ping", "p"],
	permissions: "all",
	hidden: false,
	failed: "Failed to %command: %error",
	wait: null,
	category: "info",
	cooldown: 0,
	limit: false,
	usage: "$prefix$command",
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
		const start = Date.now();
		const reply = await m.reply("Pinging...");
		const latency = Date.now() - start;

		await sock.sendMessage(
			m.from,
			{
				edit: reply.key,
				text: `Pong! Latency: ${latency}ms`,
			},
			{ ephemeralExpiration: m.expiration }
		);
	},
};
