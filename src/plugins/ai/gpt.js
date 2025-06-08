export default {
	name: "gpt",
	description: "Chat with AI.",
	command: ["ai", "gpt"],
	permissions: "all",
	hidden: false,
	failed: "Failed to %command: %error",
	wait: null,
	category: "ai",
	cooldown: 5,
	limit: false,
	usage: "$prefix$command <text>",
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
		let query = m.text;
		if (m.quoted?.text.length > 0 && query.length > 0) {
			query += "\n\n" + m.quoted.text;
		} else if (query.length == 0 && m.quoted?.text.length > 0) {
			query = m.quoted.text;
		}

		const payload = {
			model: "gpt-4o-mini",
			messages: [
				{ role: "developer", content: "You are a helpful assistant." },
				{ role: "user", content: query },
			],
		};

		const response = await fetch("https://api.apigratis.tech/gpt/chat", {
			method: "POST",
			headers: {
				accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			console.error(`Error: ${response.status}`);
		}

		const { status, message, result } = await response.json();

		if (!status) {
			return m.reply(message);
		}

		await m.reply(result.choices[0].message.content);
	},
};
