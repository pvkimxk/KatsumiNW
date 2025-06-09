import Sticker from "../../lib/sticker.js";
import uploader from "../../lib/uploader.js";

export default {
	name: "sticker",
	description: "Create a sticker.",
	command: ["sticker", "stiker", "s"],
	usage: "$prefix$command reply/send image/video/url, or leave empty for random sticker.",
	permissions: "all",
	hidden: false,
	failed: "Failed to %command: %error",
	wait: null,
	category: "convert",
	cooldown: 5,
	limit: false,
	react: true,
	botAdmin: false,
	group: false,
	private: false,
	owner: false,

	execute: async (m, { args, sock }) => {
		let input = args.join(" ").trim();
		let urlMedia = null;
		let mediaBuffer = null;
		const urlRegex =
			/(https?:\/\/[^\s]+?\.(?:png|jpe?g|webp|gif|mp4|mov|webm))/i;
		let isMedia = false;
		let q, mime;

		if (m.mentions[0]) {
			const pfpUrl = await sock
				.profilePictureUrl(m.mentions[0], "image")
				.catch(
					() =>
						"https://i.pinimg.com/736x/f1/26/e3/f126e305c9a2ba39aba2b882584b2afd.jpg"
				);
			mediaBuffer = Buffer.from(
				await fetch(pfpUrl).then((res) => res.arrayBuffer())
			);
			const sticker = await Sticker.create(mediaBuffer, {
				packname: "@natsumiworld.",
				author: m.pushName,
				emojis: "🤣",
			});
			return await m.reply({ sticker });
		}

		if (urlRegex.test(input)) {
			urlMedia = input.match(urlRegex)[0];
			mediaBuffer = Buffer.from(
				await fetch(urlMedia).then((res) => res.arrayBuffer())
			);
			input = input.replace(urlMedia, "").trim();
			isMedia = true;
		} else {
			q = m.isQuoted ? m.quoted : m;
			mime = q && q.type ? q.type : "";
			if (/sticker|webp|image|video|webm|document/g.test(mime)) {
				mediaBuffer = await q.download();
				isMedia = true;
			}
		}

		let teks1 = "_",
			teks2 = "_";
		if (input.length > 0) {
			if (input.includes("|")) {
				[teks1, teks2] = input.split("|").map((t) => t.trim() || "_");
			} else {
				teks1 = input;
			}
		}

		if (input.length > 0 && isMedia) {
			const url = await uploader.providers.netorare.upload(mediaBuffer);
			const res = await fetch(
				`https://api.memegen.link/images/custom/${encodeURIComponent(teks1)}/${encodeURIComponent(teks2)}.png?background=${url}`,
				{ responseType: "arraybuffer" }
			);
			const memeImage = await res.arrayBuffer();
			const sticker = await Sticker.create(Buffer.from(memeImage), {
				packname: "@natsumiworld.",
				author: m.pushName,
				emojis: "🤣",
			});
			return await m.reply({ sticker });
		}

		if (isMedia && input.length === 0) {
			const sticker = await Sticker.create(mediaBuffer, {
				packname: "@natsumiworld.",
				author: m.pushName,
				emojis: "🤣",
			});
			return await m.reply({ sticker });
		}

		if (!isMedia && input.length === 0) {
			const maxRetries = 5;
			let attempts = 0;
			let success = false;
			let buffer = null;

			while (attempts < maxRetries && !success) {
				try {
					const response = await fetch("https://s.hanni.baby");
					const arrayBuffer = await response.arrayBuffer();
					buffer = Buffer.from(arrayBuffer);
					success = true;
				} catch (error) {
					attempts++;
					console.error(
						`Attempt ${attempts} failed: ${error.message}`
					);
					if (attempts >= maxRetries) {
						console.error("Max retries reached. Exiting.");
						return m.reply(
							"Failed to fetch random sticker after multiple attempts."
						);
					}
					console.log("Retrying...");
				}
			}
			const sticker = await Sticker.create(buffer, {
				packname: "@natsumiworld.",
				author: m.pushName,
				emojis: "🤣",
			});
			return await m.reply({ sticker });
		}
	},
};
