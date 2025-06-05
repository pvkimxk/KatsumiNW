import axios from "axios";
import { fileTypeFromBuffer } from "file-type";
import Jimp from "jimp";
import { existsSync, promises, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const getRandom = (ext) => {
	return `${Math.floor(Math.random() * 10000)}${ext}`;
};

export async function fetchBuffer(string, options = {}) {
	try {
		if (/^https?:\/\//i.test(string)) {
			let data = await axios.get(string, {
				headers: {
					...(options.headers || {}),
				},
				responseType: "arraybuffer",
				...options,
			});

			let buffer = data?.data;
			let name = /filename/i.test(
				data.headers?.get("content-disposition")
			)
				? data.headers
						?.get("content-disposition")
						?.match(/filename=(.*)/)?.[1]
						?.replace(/[""]/g, "")
				: "";
			let mime =
				data.headers.get("content-type") ||
				(await fileTypeFromBuffer(buffer))?.mime;

			return {
				data: buffer,
				size: Buffer.byteLength(buffer),
				sizeH: formatSize(Buffer.byteLength(buffer)),
				name,
				mime,
				ext: mime ? mime.split("/")[1] : ".bin",
			};
		}

		if (/^data:.*?\/.*?base64,/i.test(string)) {
			let data = Buffer.from(string.split`,`[1], "base64");
			let size = Buffer.byteLength(data);
			const fileType = await fileTypeFromBuffer(data);

			return {
				data,
				size,
				sizeH: formatSize(size),
				...(fileType || {
					mime: "application/octet-stream",
					ext: ".bin",
				}),
			};
		}

		if (existsSync(string) && statSync(string).isFile()) {
			let data = readFileSync(string);
			let size = Buffer.byteLength(data);
			const fileType = await fileTypeFromBuffer(data);

			return {
				data,
				size,
				sizeH: formatSize(size),
				...(fileType || {
					mime: "application/octet-stream",
					ext: ".bin",
				}),
			};
		}

		if (Buffer.isBuffer(string)) {
			let size = Buffer?.byteLength(string) || 0;
			const fileType = await fileTypeFromBuffer(string);

			return {
				data: string,
				size,
				sizeH: formatSize(size),
				...(fileType || {
					mime: "application/octet-stream",
					ext: ".bin",
				}),
			};
		}

		if (/^[a-zA-Z0-9+/]={0,2}$/i.test(string)) {
			let data = Buffer.from(string, "base64");
			let size = Buffer.byteLength(data);
			const fileType = await fileTypeFromBuffer(data);

			return {
				data,
				size,
				sizeH: formatSize(size),
				...(fileType || {
					mime: "application/octet-stream",
					ext: ".bin",
				}),
			};
		}

		let buffer = Buffer.alloc(20);
		let size = Buffer.byteLength(buffer);
		const fileType = await fileTypeFromBuffer(buffer);

		return {
			data: buffer,
			size,
			sizeH: formatSize(size),
			...(fileType || {
				mime: "application/octet-stream",
				ext: ".bin",
			}),
		};
	} catch (e) {
		throw new Error(e?.message || e);
	}
}

export async function getFile(PATH, save) {
	let filename = null;
	let data = await fetchBuffer(PATH);

	if (data?.data && save) {
		filename = join(process.cwd(), "temp", `${Date.now()}.${data.ext}`);
		await promises.writeFile(filename, data.data);
	}

	return {
		filename: data.filename || filename,
		...data,
	};
}

export const getBuffer = async (url, options = {}) => {
	const res = await axios({
		method: "get",
		url,
		headers: {
			DNT: 1,
			"Upgrade-Insecure-Request": 1,
		},
		...options,
		responseType: "arraybuffer",
	});
	return res.data;
};

export const formatSize = (bytes) => {
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	if (bytes === 0) {
		return "0 Bytes";
	}
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
};

export const fetchJson = async (url, options = {}) => {
	try {
		const res = await axios({
			method: "GET",
			url: url,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
			},
			...options,
		});
		return res.data;
	} catch (err) {
		console.error("Error fetching JSON:", err);
		throw err;
	}
};

export const runtime = (seconds) => {
	seconds = Number(seconds);
	const d = Math.floor(seconds / (3600 * 24));
	const h = Math.floor((seconds % (3600 * 24)) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	const dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
	const hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
	const mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
	const sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";

	return dDisplay + hDisplay + mDisplay + sDisplay;
};

export const clockString = (ms) => {
	const h = isNaN(ms) ? "--" : Math.floor(ms / 3600000);
	const m = isNaN(ms) ? "--" : Math.floor(ms / 60000) % 60;
	const s = isNaN(ms) ? "--" : Math.floor(ms / 1000) % 60;
	return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
};

export const reSize = async (buffer, width, height) => {
	const img = await Jimp.read(buffer);
	return img.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
};

export const sleep = async (ms) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

export const isUrl = (url) => {
	return url.match(
		new RegExp(
			/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
			"gi"
		)
	);
};

export const formatDate = (n, locale = "id") => {
	const d = new Date(n);
	return d.toLocaleDateString(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
	});
};

export const tanggal = (numer) => {
	const myMonths = [
		"Januari",
		"Februari",
		"Maret",
		"April",
		"Mei",
		"Juni",
		"Juli",
		"Agustus",
		"September",
		"Oktober",
		"November",
		"Desember",
	];
	const myDays = [
		"Minggu",
		"Senin",
		"Selasa",
		"Rabu",
		"Kamis",
		"Jum'at",
		"Sabtu",
	];

	const tgl = new Date(numer);
	const day = tgl.getDate();
	const bulan = tgl.getMonth();
	const thisDay = myDays[tgl.getDay()];
	const yy = tgl.getYear();
	const year = yy < 1000 ? yy + 1900 : yy;

	return `${thisDay}, ${day} - ${myMonths[bulan]} - ${year}`;
};

export const jsonformat = (string) => {
	return JSON.stringify(string, null, 2);
};

export const bytesToSize = (bytes, decimals = 2) => {
	if (bytes === 0) {
		return "0 Bytes";
	}

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

export function escapeRegExp(string) {
	return string.replace(/[.*=+:\-?^${}()|[\]\\]|\s/g, "\\$&");
}
