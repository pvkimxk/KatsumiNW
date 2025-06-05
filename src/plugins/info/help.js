export default {
	name: "help",
	description: "Show help information",
	command: ["help", "h"],
	permissions: "all",
	hidden: false,
	failed: "❌ Failed to show %command: %error",
	category: "info",
	cooldown: 5,
	usage: "$prefix$command [command|category]",
	react: true,
	wait: null,

	/**
	 * @param {object} context - The context object containing sock, m, args, and plugins.
	 * @param {object} context.m - The serialized message object.
	 * @param {Array<object>} context.plugins - List of all loaded plugins (provided by PluginManager).
	 * @param {boolean} context.isOwner - Indicates if the sender is an owner.
	 */
	async execute({ m, plugins, isOwner }) {
		const categories = new Map();

		for (const plugin of plugins) {
			if (plugin.hidden || (plugin.owner && !isOwner)) {
				continue;
			}
			if (!categories.has(plugin.category)) {
				categories.set(plugin.category, []);
			}
			categories.get(plugin.category).push(plugin);
		}

		let response = "📚 *Available Commands:*\n\n";

		if (m.args.length === 0) {
			for (const [category, cmds] of categories.entries()) {
				response += `--- ${category.toUpperCase()} ---\n`;
				for (const cmd of cmds) {
					response += `\`${cmd.command.join(", ")}\`: ${cmd.description}\n`;
				}
				response += "\n";
			}
			response += `\n💡 Use \`${m.prefix}help <command|category>\` for more details.`;
		} else {
			const query = m.args[0].toLowerCase();
			const plugin = plugins.find((p) =>
				p.command.some((cmd) => cmd.toLowerCase() === query)
			);

			if (plugin && !plugin.hidden && (!plugin.owner || isOwner)) {
				response = `--- Command: ${plugin.name} ---\n`;
				response += `Description: ${plugin.description}\n`;
				response += `Aliases: \`${plugin.command.join(", ")}\`\n`;
				response += `Category: ${plugin.category}\n`;
				if (plugin.usage) {
					response += `Usage: \`${plugin.usage.replace("$prefix", m.prefix).replace("$command", plugin.command[0])}\`\n`;
				}
				if (plugin.cooldown > 0) {
					response += `Cooldown: ${plugin.cooldown}s\n`;
				}
				if (plugin.dailyLimit > 0) {
					response += `Daily Limit: ${plugin.dailyLimit}\n`;
				}
				if (plugin.permissions !== "all") {
					response += `Permissions: ${plugin.permissions}\n`;
				}
				if (plugin.group) {
					response += "Group Only: Yes\n";
				}
				if (plugin.private) {
					response += "Private Chat Only: Yes\n";
				}
				if (plugin.owner) {
					response += "Owner Only: Yes\n";
				}
				if (plugin.botAdmin) {
					response += "Bot Admin Required: Yes\n";
				}
			} else if (categories.has(query)) {
				const categoryPlugins = categories.get(query);
				response = `*--- ${query.toUpperCase()} Commands ---\n\n`;
				for (const cmd of categoryPlugins) {
					response += `\`${cmd.command.join(", ")}\`: ${cmd.description}\n`;
				}
			} else {
				response = `❌ No command or category found for "${query}".\n\n`;
				response += `💡 Use \`${m.prefix}help\` to see all available commands and categories.`;
			}
		}

		await m.reply(response.trim());
	},
};
