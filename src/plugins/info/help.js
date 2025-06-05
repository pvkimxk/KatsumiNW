import { BOT_CONFIG } from "../../config/index.js";

export default {
	name: "help",
	description: "Show help information",
	command: ["help", "h"],
	permissions: "all",
	hidden: false,
	failed: "❌ Failed to show help: %error",
	category: "info",
	cooldown: 5,
	usage: "$prefix$command [command|category]",
	react: true,

	/**
	 * @param {object} context - The context object containing sock, m, args, and plugins.
	 * @param {object} context.m - The serialized message object.
	 * @param {Array<object>} context.plugins - List of all loaded plugins (provided by PluginManager).
	 */
	async execute({ m, plugins }) {
		const args = m.args;
		const prefix = m.prefix || BOT_CONFIG.prefixes[0];
		const allPlugins = plugins.filter((p) => !p.hidden);

		const categories = {};
		allPlugins.forEach((plugin) => {
			if (!categories[plugin.category]) {
				categories[plugin.category] = [];
			}
			categories[plugin.category].push(plugin);
		});

		if (!args.length) {
			let helpMessage = `*Prefixes:* ${BOT_CONFIG.prefixes.join(", ")}\n`;
			helpMessage += `*Total Commands:* ${allPlugins.length}\n\n`;
			helpMessage += "*Available Categories:*\n";

			Object.entries(categories).forEach(([category, plugins]) => {
				helpMessage += `- *${category}* (${plugins.length} Commands)\n`;
			});

			await m.reply(helpMessage);
			return;
		}

		const input = args.join(" ").toLowerCase();

		if (categories[input]) {
			const pluginsInCategory = categories[input];
			let categoryMessage = `*${input} Commands:*\n\n`;
			pluginsInCategory.forEach((plugin, index) => {
				categoryMessage += `${index + 1}. *${plugin.command[0]}* - ${plugin.description}\n`;
			});
			await m.reply(categoryMessage);
			return;
		}

		const commandPlugin = allPlugins.find(
			(plugin) =>
				plugin.command.some((cmd) => cmd.toLowerCase() === input) ||
				plugin.name.toLowerCase() === input
		);

		if (commandPlugin) {
			const usage = commandPlugin.usage
				.replace(/\$prefix/g, prefix)
				.replace(/\$command/g, commandPlugin.command[0]);

			let commandMessage = `*Command:* ${commandPlugin.name}\n`;
			commandMessage += `*Description:* ${commandPlugin.description}\n`;
			commandMessage += `*Aliases:* ${commandPlugin.command.join(", ")}\n`;
			commandMessage += `*Category:* ${commandPlugin.category}\n`;
			commandMessage += `*Cooldown:* ${commandPlugin.cooldown} seconds\n`;
			commandMessage += `*Usage:* \`\`\`${usage}\`\`\`\n`;
			commandMessage += `*Owner Only:* ${commandPlugin.owner ? "Yes" : "No"}`;

			await m.reply(commandMessage);
			return;
		}
		await m.reply(
			`No command or category found for "${input}". Use *${prefix}help* to see available commands.`
		);
	},
};
