import { BOT_CONFIG } from "../../config/index.js";

export default {
	name: "help",
	description:
		"Displays all available commands, by category, or detailed help for a specific command.",
	command: ["help", "menu"],
	wait: null,
	permissions: "all",
	hidden: false,
	usage: "$prefix$command [command_name | category_name]",
	react: true,
	category: "info",
	cooldown: 3,

	/**
	 * @param {object} context - The context object containing sock, m, args, and plugins.
	 * @param {object} context.m - The serialized message object.
	 * @param {string | undefined} context.args - Arguments after the command (the command or category name being searched).
	 * @param {Array<object>} context.plugins - List of all loaded plugins (provided by PluginManager).
	 */
	async execute(m, { args, plugins }) {
		const text = (args || "").toLowerCase().trim();

		const availableCategories = new Set();
		plugins
			.filter((p) => !p.hidden)
			.forEach((p) => {
				if (p.category) {
					availableCategories.add(p.category.toLowerCase());
				}
			});

		if (text) {
			if (availableCategories.has(text)) {
				const categoryName = text;
				const filteredPlugins = plugins
					.filter(
						(p) =>
							!p.hidden &&
							p.category &&
							p.category.toLowerCase() === categoryName
					)
					.sort((a, b) => a.name.localeCompare(b.name));

				if (filteredPlugins.length > 0) {
					let categoryHelpMessage = `*━━━ Commands in ${categoryName.toUpperCase()} Category ━━━*\n\n`;
					filteredPlugins.forEach((plugin) => {
						const displayCommand = plugin.command[0];
						const usageText = plugin.usage
							? `\`${plugin.usage.replace("$prefix", m.prefix || BOT_CONFIG.prefixes[0]).replace("$command", displayCommand)}\``
							: `\`${m.prefix || BOT_CONFIG.prefixes[0]}${displayCommand}\``;
						categoryHelpMessage += `- ${usageText} : ${plugin.description}\n`;
					});
					categoryHelpMessage += `\n_For detailed help on a command: ${m.prefix || BOT_CONFIG.prefixes[0]}help <command_name>_`;
					await m.reply(categoryHelpMessage);
				} else {
					await m.reply(
						`No commands found in the *${categoryName}* category.`
					);
				}
			} else {
				const searchCommand = text;
				const foundPlugin = plugins.find((p) =>
					p.command.some((cmd) => cmd.toLowerCase() === searchCommand)
				);

				if (foundPlugin) {
					let detailMessage = `*Command: ${m.prefix || BOT_CONFIG.prefixes[0]}${foundPlugin.command[0]}*\n\n`;
					detailMessage += `*Description:* ${foundPlugin.description}\n`;
					detailMessage += `*Category:* ${foundPlugin.category}\n`;
					if (foundPlugin.usage) {
						detailMessage += `*Usage:* \`${foundPlugin.usage.replace("$prefix", m.prefix || BOT_CONFIG.prefixes[0]).replace("$command", foundPlugin.command[0])}\`\n`;
					}
					detailMessage += `*Permissions:* ${foundPlugin.permissions}\n`;
					if (foundPlugin.cooldown > 0) {
						detailMessage += `*Cooldown:* ${foundPlugin.cooldown} seconds\n`;
					}
					if (foundPlugin.limit) {
						detailMessage += `*Limit:* ${typeof foundPlugin.limit === "boolean" ? "Yes" : foundPlugin.limit}\n`;
					}
					if (foundPlugin.owner) {
						detailMessage += "*Owner Only:* Yes\n";
					}
					if (foundPlugin.group) {
						detailMessage += "*Group Only:* Yes\n";
					}
					if (foundPlugin.private) {
						detailMessage += "*Private Only:* Yes\n";
					}
					if (foundPlugin.botAdmin) {
						detailMessage += "*Bot Admin Needed:* Yes\n";
					}

					await m.reply(detailMessage.trim());
				} else {
					await m.reply(
						`Command or category *${m.prefix || BOT_CONFIG.prefixes[0]}${args}* not found. Try *${m.prefix || BOT_CONFIG.prefixes[0]}help* for a list of commands or categories.`
					);
				}
			}
		} else {
			let helpMessage =
				"👋 Hi! I'm your WhatsApp Bot. Here are my commands and categories:\n\n";

			const categories = {};
			plugins
				.filter((p) => !p.hidden)
				.forEach((plugin) => {
					if (plugin.category) {
						if (!categories[plugin.category]) {
							categories[plugin.category] = [];
						}
						categories[plugin.category].push(plugin);
					}
				});

			const sortedCategories = Object.keys(categories).sort();

			for (const category of sortedCategories) {
				helpMessage += `*━━━ ${category.toUpperCase()} ━━━*\n`;
				categories[category]
					.sort((a, b) => a.command[0].localeCompare(b.command[0]))
					.forEach((plugin) => {
						const displayCommand = plugin.command[0];
						const usageText = plugin.usage
							? `\`${plugin.usage.replace("$prefix", m.prefix || BOT_CONFIG.prefixes[0]).replace("$command", displayCommand)}\``
							: `\`${m.prefix || BOT_CONFIG.prefixes[0]}${displayCommand}\``;
						helpMessage += `- ${usageText} : ${plugin.description}\n`;
					});
				helpMessage += "\n";
			}

			helpMessage += `_For commands in a specific category: ${m.prefix || BOT_CONFIG.prefixes[0]}help <category_name>_\n`;
			helpMessage += `_For detailed help on a command: ${m.prefix || BOT_CONFIG.prefixes[0]}help <command_name>_`;
			await m.reply(helpMessage);
		}
	},
};
