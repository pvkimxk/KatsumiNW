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
	async execute(m) {
		const startTime = process.hrtime.bigint();
		const endTime = process.hrtime.bigint();
		const latency = (endTime - startTime) / BigInt(1_000_000);
		await m.reply(`Latency: ${latency}ms`);
	},
};
