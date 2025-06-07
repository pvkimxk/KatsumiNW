import { SettingsModel } from "../../lib/database/index.js";
import { SettingsSchema } from "../../lib/schema/index.js";

export default {
	name: "mode",
	description: "Set bot operation mode: self / group / private / public",
	command: ["mode"],
	permissions: "owner",
	wait: null,
	usage: "$prefix$command [self|group|private|public]",
	async execute({ m, args }) {
		if (!args[0]) {
			const current = await SettingsModel.getSettings();
			return m.reply(
				`Current Bot Mode:\n- Self: ${current.self}\n- Group Only: ${current.groupOnly}\n- Private Only: ${current.privateChatOnly}\n\nUsage:\n${this.usage.replace("$prefix", m.prefix).replace("$command", this.command[0])}\n\nExample:\n${m.prefix}${this.command[0]} group`
			);
		}

		let update = {};
		let selectedMode = args[0].toLowerCase();

		switch (selectedMode) {
			case "self":
				update = {
					self: true,
					groupOnly: false,
					privateChatOnly: false,
				};
				break;
			case "group":
				update = {
					self: false,
					groupOnly: true,
					privateChatOnly: false,
				};
				break;
			case "private":
				update = {
					self: false,
					groupOnly: false,
					privateChatOnly: true,
				};
				break;
			case "public":
				update = {
					self: false,
					groupOnly: false,
					privateChatOnly: false,
				};
				break;
			default:
				return m.reply(
					"Available options: self, group, private, public"
				);
		}

		await SettingsModel.updateSettings(update);
		m.reply(`✅ Bot mode has been updated to *${selectedMode}*.`);
	},
};
