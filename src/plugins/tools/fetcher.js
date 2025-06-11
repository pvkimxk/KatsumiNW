import { to_audio } from "../../utils/converter.js";

export default {
	name: "fetcher",
	description: "Fetches metadata and content from a URL.",
	command: ["get", "fetch"],
	permissions: "all",
	hidden: false,
	failed: "Failed to %command: %error",
	wait: null,
	category: "tools",
	cooldown: 5,
	limit: true,
	usage: "$prefix$command <url>",
	react: true,
	botAdmin: false,
	group: false,
	private: false,
	owner: false,

	execute: async (m, { args }) => {
		const url = args[0]
			? args[0].trim()
			: m.quoted
				? m.quoted.url?.trim()
				: "";

		if (!url) {
			return m.reply("Need url.");
		}

		const formatUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;
		const response = await fetch(formatUrl);

		const headers = Object.fromEntries(response.headers.entries());
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const maxSize = 200 * 1024 * 1024;
		if (buffer.length >= maxSize) {
			return m.reply("File size is over 200MB, cannot send.");
		}

		const mediaMap = {
			image: "image",
			video: "video",
			audio: "audio",
			document: "application",
		};

		function getContentType() {
			const contentType = headers?.["content-type"] || "";
			for (const key in mediaMap) {
				if (contentType.includes(mediaMap[key])) {
					return key;
				}
			}
			return "document";
		}

		const contentType = getContentType();

		const randomName =
			Date.now() + "_" + Math.random().toString(36).substr(2, 8);

		const urlExt = url.split(".").pop()?.split("?")[0];
		const ext = contentType || (urlExt ? "." + urlExt : ".bin");
		const fileName = randomName + ext;

		if (contentType === "image") {
			return m.reply({ image: buffer });
		}

		if (contentType === "video") {
			return m.reply({ video: buffer });
		}

		if (contentType === "audio") {
			const convert = await to_audio(buffer, "mp3");
			return m.reply({
				audio: Buffer.from(convert),
				mimetype: "audio/mpeg",
			});
		}

		if (headers?.["content-type"]?.includes("json")) {
			let text = buffer.toString("utf-8");
			try {
				const obj = JSON.parse(text);
				text = JSON.stringify(obj, null, 2);
			} catch (e) {
				console.log(e);
			}
			if (text.length > 4000) {
				return m.reply({
					document: buffer,
					fileName,
					mimetype: headers["content-type"],
				});
			}
			return m.reply(text);
		}

		if (headers?.["content-type"]?.includes("text")) {
			const text = buffer.toString("utf-8");
			if (text.length > 4000) {
				return m.reply({
					document: buffer,
					fileName,
					mimetype: headers["content-type"],
				});
			}
			return m.reply(text);
		}

		return m.reply({
			document: buffer,
			fileName,
			mimetype: headers["content-type"] || "application/octet-stream",
		});
	},
};
