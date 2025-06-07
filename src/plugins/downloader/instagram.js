import { fileTypeFromBuffer } from "file-type";

export default {
	name: "instagram",
	description: "Downloader Instagram.",
	command: ["ig", "instagram"],
	usage: "$prefix$command https://www.instagram.com/reel/C_Fyz3bJ2PF/",
	permissions: "all",
	hidden: false,
	failed: "Failed to %command: %error",
	wait: null,
	category: "downloader",
	cooldown: 5,
	limit: false,
	react: true,
	botAdmin: false,
	group: false,
	private: false,
	owner: false,

	async execute({ m }) {
		const input =
			m.text && m.text.trim() !== ""
				? m.text.trim()
				: m.quoted && m.quoted.url
					? m.quoted.url
					: null;

		if (!input) {
			return m.reply("Input URL Instagram.");
		}

		const response = await fetch(
			"https://api.apigratis.tech/downloader/instagram?url=" + input,
			{
				headers: {
					Accept: "application/json",
				},
			}
		);

		const { result, status, message } = await response.json();

		if (!status) {
			return m.reply(message);
		}

		let caption = "*📸 INSTAGRAM DOWNLOADER*\n\n";
		caption += `*👤 User*: @${result.meta?.username || "-"}\n`;
		caption += `*📝 Caption*: ${result.meta?.title || "-"}\n`;
		caption += `*👍 Like*: ${result.meta?.like_count || 0}\n`;
		caption += `*🗓️ Upload*: ${result.meta?.taken_at ? new Date(result.meta.taken_at * 1000).toLocaleString("id-ID") : "-"}\n`;
		caption += `*🔗 Source*: ${result.meta?.source}\n`;

		if (
			Array.isArray(result.meta?.comments) &&
			result.meta.comments.length > 0
		) {
			caption += "\n💬 *Comments*:\n";
			result.meta.comments.slice(0, 5).forEach((comment, idx) => {
				caption += `*${idx + 1}.* @${comment.username}: ${comment.text}\n`;
			});
			const remainingComments = result.meta.comment_count - 5;
			if (remainingComments > 0) {
				caption += `and ${remainingComments} other comment${remainingComments > 1 ? "s" : ""}...\n`;
			}
		}

		const getT = async (url) => {
			const res = await fetch(url);
			const arrayBuffer = await res.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const fileType = await fileTypeFromBuffer(buffer);
			const mime = fileType ? fileType.mime : "application/octet-stream";
			return [
				mime.includes("video")
					? "video"
					: mime.includes("audio")
						? "audio"
						: "image",
				buffer,
				mime,
			];
		};

		if (Array.isArray(result.urls) && result.urls.length > 0) {
			let isFirst = true;
			for (const media of result.urls) {
				const [type, downloadData] = await getT(media.url);
				if (!type) {
					return m.reply("Failed to retrieve the media type.");
				}

				const mediaMsg = {
					[type]: downloadData,
					...(isFirst && { caption: caption.trim() }),
				};

				await m.reply(mediaMsg);
				isFirst = false;
			}
		}
	},
};
