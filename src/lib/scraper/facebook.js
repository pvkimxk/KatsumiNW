import axios from "axios";

export default async function fesnuk(post, cookie, useragent) {
	return new Promise((resolve, reject) => {
		const headers = {
			"sec-fetch-user": "?1",
			"sec-ch-ua-mobile": "?0",
			"sec-fetch-site": "none",
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"cache-control": "max-age=0",
			authority: "www.facebook.com",
			"upgrade-insecure-requests": "1",
			"accept-language":
				"en-GB,en;q=0.9,tr-TR;q=0.8,tr;q=0.7,en-US;q=0.6",
			"sec-ch-ua":
				'"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
			"user-agent":
				useragent ||
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36",
			accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			cookie: cookie || "",
		};

		const parseString = (string) => {
			try {
				return JSON.parse(`{"text": "${string}"}`).text;
			} catch {
				return string;
			}
		};

		const cleanText = (text) => {
			return text
				.replace(/\\u[\dA-Fa-f]{4}/g, (match) =>
					String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16))
				)
				.replace(/\\+/g, "")
				.replace(/\n/g, " ")
				.trim();
		};

		if (!post || !post.trim()) {
			return reject("Please specify the Facebook URL");
		}

		if (!/(facebook\.com|fb\.watch)/.test(post)) {
			return reject("Please enter a valid Facebook URL");
		}

		axios
			.get(post, { headers })
			.then(({ data }) => {
				data = data.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
				const externalUrlMatch = data.match(
					/"__typename":"ExternalWebLink","url":"(https:\\\/\\\/[^"]+)"/
				);
				const externalUrl = externalUrlMatch
					? externalUrlMatch[1].replace(/\\\//g, "/")
					: null;
				const imageUrlMatch = data.match(
					/https:\/\/scontent\.[^"]+\.jpg(\?[^"]*)?/g
				);
				let imageUrl = null;
				let imagePost = false;

				if (imageUrlMatch && imageUrlMatch.length > 0) {
					const uniqueBaseUrls = new Set();

					const filteredUrls = [];

					for (const url of imageUrlMatch) {
						if (url.includes("/v/t39.30808-6/")) {
							if (!/\/s\d{1,3}x\d{1,3}\//.test(url)) {
								const baseUrl = url.split("?")[0];

								if (!uniqueBaseUrls.has(baseUrl)) {
									uniqueBaseUrls.add(baseUrl);

									filteredUrls.push(url);
								}
							}
						}
					}

					if (filteredUrls.length > 0) {
						imageUrl = filteredUrls;

						imagePost = true;
					}
				}

				const commentsMatch = data.match(
					/"author":\{"__typename":"User","id":"(.*?)","name":"(.*?)".*?"body":\{"text":"(.*?)"/g
				);

				const comments = commentsMatch
					? commentsMatch.map((comment) => {
							const commentParts = comment.match(
								/"author":\{"__typename":"User","id":"(.*?)","name":"(.*?)".*?"body":\{"text":"(.*?)"/
							);

							return {
								author: {
									id: commentParts[1],

									name: commentParts[2],
								},

								text: cleanText(commentParts[3]),
							};
						})
					: [];

				const sdMatch =
					data.match(/"browser_native_sd_url":"(.*?)"/) ||
					data.match(/"playable_url":"(.*?)"/) ||
					data.match(/sd_src\s*:\s*"([^"]*)"/) ||
					data.match(/(?<="src":")[^"]*(https:\/\/[^"]*)/);

				const hdMatch =
					data.match(/"browser_native_hd_url":"(.*?)"/) ||
					data.match(/"playable_url_quality_hd":"(.*?)"/) ||
					data.match(/hd_src\s*:\s*"([^"]*)"/);

				const titleMatch = data.match(
					/<meta\sname="description"\scontent="(.*?)"/
				);

				const thumbMatch = data.match(
					/"preferred_thumbnail":{"image":{"uri":"(.*?)"/
				);

				const durationMatch = data.match(
					/"playable_duration_in_ms":[0-9]+/
				);

				let type = "none";

				if (imagePost) {
					type = "image";
				} else {
					if (sdMatch && sdMatch[1]) type = "video";
				}

				const result = {
					type,
					url: post,
					image: imageUrl || null,
					externalUrl: externalUrl || null,
					comments: comments || [],
					title:
						titleMatch && titleMatch[1]
							? parseString(titleMatch[1])
							: (data.match(/<title>(.*?)<\/title>/)?.[1] ?? ""),
					duration_ms: durationMatch
						? Number(durationMatch[0].split(":")[1])
						: null,
					sd: sdMatch && sdMatch[1] ? parseString(sdMatch[1]) : null,
					hd: hdMatch && hdMatch[1] ? parseString(hdMatch[1]) : null,
					thumbnail:
						thumbMatch && thumbMatch[1]
							? parseString(thumbMatch[1])
							: null,
				};
				resolve(result);
			})
			.catch((err) => {
				console.error("Error fetching media information:", err);
				reject(
					"Unable to fetch media information at this time. Please try again."
				);
			});
	});
}
