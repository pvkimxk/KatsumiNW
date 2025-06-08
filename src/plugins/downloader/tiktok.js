export default {
	name: "tiktok",
	description: "Downloader TikTok.",
	command: ["tt", "tiktok"],
	usage: "$prefix$command https://vt.tiktok.com/ZSkSAodxb/",
	permissions: "all",
	hidden: false,
	failed: "Failed to %command: %error",
	wait: null,
	category: "downloader",
	cooldown: 5,
	limit: true,
	react: true,
	botAdmin: false,
	group: false,
	private: false,
	owner: false,

	async execute(m, { api }) {
		const input =
			m.text && m.text.trim() !== ""
				? m.text
				: m.quoted && m.quoted.url
					? m.quoted.url
					: null;

		if (!input) {
			return m.reply("Input URL TikTok.");
		}

		const { data } = await api.Gratis.get("/download/tiktok", {
			url: input,
		});

		const { result, status, message } = data;

		if (!status) {
			return m.reply(message);
		}

		let msg = "*🕺 TIKTOK DOWNLOADER*\n\n";
		msg += `*👤 User*: ${result.author.nickname} (@${result.author.unique_id})\n`;
		msg += `*🆔 ID Video*: ${result.aweme_id}\n`;
		msg += `*🌍 Region*: ${result.region}\n`;
		msg += `*📝 Caption*: ${result.desc ? result.desc : "-"}\n`;
		msg += `*⏱️ Duration*: ${result.duration}s\n`;
		msg += `*🎶 Music*: ${result.download.music_info?.title || "-"} - ${result.download.music_info?.author || "-"}\n`;
		msg += `*👁️ Views*: ${result.info?.play_count || 0}\n`;
		msg += `*👍 Like*: ${result.info?.digg_count || 0} | 💬 ${result.info?.comment_count || 0} | 🔁 Share: ${result.info?.share_count || 0}\n`;
		msg += `*🗓️ Upload*: ${result.info?.create_time ? new Date(result.info.create_time * 1000).toLocaleString("id-ID") : "-"}\n`;

		if (result.download.images && result.download.images.length > 0) {
			for (const img of result.download.images) {
				await m.reply({ image: { url: img } });
			}
		}

		await m.reply({
			video: { url: result.download.original },
			caption: msg.trim(),
		});

		await m.reply({
			audio: { url: result.download.music },
			mimetype: "audio/mpeg",
		});
	},
};
