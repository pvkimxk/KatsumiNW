import { fileTypeFromBuffer } from "file-type";

export default {
	name: "instagram",
	description: "Downloader Instagram.",
	command: ["ig", "instagram"],
	usage: "$prefix$command https://www.instagram.com/reel/C_Fyz3bJ2PF/",
	permissions: "all",
	hidden: false,
	failed: "Failed to execute %command: %error",
	wait: null,
	category: "downloader",
	cooldown: 5,
	limit: false,
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
			return m.reply("Input URL Instagram.");
		}

		const {
			data: { result, status, message },
		} = await api.Gratis.get("/downloader/instagram", { url: input });

		if (!status) {
			return m.reply(message);
		}

		const { meta } = result;
		let caption =
			"*📸 INSTAGRAM DOWNLOADER*\n\n" +
			`*👤 User*: @${meta?.username || "-"}\n` +
			`*📝 Caption*: ${meta?.title || "-"}\n` +
			`*👍 Like*: ${meta?.like_count || 0}\n` +
			`*🗓️ Upload*: ${meta?.taken_at ? new Date(meta.taken_at * 1000).toLocaleString("id-ID") : "-"}\n` +
			`*🔗 Source*: ${meta?.source || "N/A"}`;

		if (meta?.comments?.length > 0) {
			const commentsText = meta.comments
				.slice(0, 5)
				.map((c, i) => `*${i + 1}.* @${c.username}: ${c.text}`)
				.join("\n");
			const remaining = meta.comment_count - 5;
			caption += `\n\n💬 *Comments*:\n${commentsText}`;
			if (remaining > 0) {
				caption += `\ndan ${remaining} komentar lainnya...`;
			}
		}

		const downloadMedia = async (url) => {
			const response = await fetch(url);
			const buffer = Buffer.from(await response.arrayBuffer());
			const type = await fileTypeFromBuffer(buffer);
			const mime = type?.mime || "application/octet-stream";
			const mediaType = mime.startsWith("video") ? "video" : "image"; // Instagram umumnya video atau gambar
			return { [mediaType]: buffer };
		};

		const firstMedia = await downloadMedia(result.urls[0].url);
		await m.reply({ ...firstMedia, caption: caption.trim() });

		for (let i = 1; i < result.urls.length; i++) {
			const mediaData = await downloadMedia(result.urls[i].url);
			await m.reply(mediaData);
		}
	},
};
