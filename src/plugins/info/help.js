export default {
	name: "help",
	description: "Show help information",
	command: ["help", "h"],
	permissions: "all",
	hidden: false,
	failed: "❌ Failed to show $command: %error",
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
	async execute({ m, plugins, isOwner, sock }) {
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

		let response = "";

		if (m.args.length === 0) {
			response += `\n🚀 *Hello, *@${m.sender.replace(/[^0-9]/g, "")}*!\n`;
			response += `Your ultimate WhatsApp companion at your service!\n\n`;
			response += `✨ *Commands Categories:*\n`;

			for (const [category, cmds] of categories.entries()) {
				const categoryName =
					category.charAt(0).toUpperCase() + category.slice(1);
				response += `\n┌───「 *${categoryName}* 」\n`;
				for (const cmd of cmds) {
					const aliases =
						cmd.command.length > 1
							? ` _(${cmd.command.slice(1).join(", ")})_`
							: "";
					response += `│ • \`${m.prefix}${cmd.command[0]}\`${aliases}\n`;
				}
				response += `└───────────────\n`;
			}

			response += `\n💡 *Tip:* Use \`${m.prefix}help <command|category>\` for more details.`;
		} else {
			const query = m.args[0].toLowerCase();
			const plugin = plugins.find((p) =>
				p.command.some((cmd) => cmd.toLowerCase() === query)
			);

			if (plugin && !plugin.hidden && (!plugin.owner || isOwner)) {
				response += `\n📚 *Command Details: ${plugin.name}*\n`;
				response += `• *Description:* ${plugin.description}\n`;
				response += `• *Aliases:* \`${plugin.command.join(", ")}\`\n`;
				response += `• *Category:* ${plugin.category.charAt(0).toUpperCase() + plugin.category.slice(1)}\n`;
				if (plugin.usage) {
					response += `• *Usage:* \`\`\`${plugin.usage.replace("$prefix", m.prefix).replace("$command", plugin.command[0])}\`\`\`\n`;
				}
				if (plugin.cooldown > 0) {
					response += `• *Cooldown:* ${plugin.cooldown} second(s)\n`;
				}
				if (plugin.dailyLimit > 0) {
					response += `• *Daily Limit:* ${plugin.dailyLimit} uses\n`;
				}
				if (plugin.permissions !== "all") {
					response += `• *Required Role:* ${plugin.permissions}\n`;
				}
				if (plugin.group) {
					response += "• *Group Only:* Yes\n";
				}
				if (plugin.private) {
					response += "• *Private Chat Only:* Yes\n";
				}
				if (plugin.owner) {
					response += "• *Owner Only:* Yes\n";
				}
				if (plugin.botAdmin) {
					response += "• *Bot Admin Needed:* Yes\n";
				}
				response += `\n_Remember to respect cooldowns and limits!_`;
			} else if (categories.has(query)) {
				const categoryName =
					query.charAt(0).toUpperCase() + query.slice(1);
				const categoryPlugins = categories.get(query);
				response += `\n✨ *${categoryName} Commands:*\n\n`;
				for (const cmd of categoryPlugins) {
					const aliases =
						cmd.command.length > 1
							? ` _(${cmd.command.slice(1).join(", ")})_`
							: "";
					response += `• \`${m.prefix}${cmd.command[0]}\`${aliases}: ${cmd.description}\n`;
				}
				response += `\n_Explore more by typing \`${m.prefix}help <command>\`_`;
			} else {
				response = `\n🤔 *Oops!* Couldn't find a command or category for "*${query}*".\n`;
				response += `\n💡 Try \`${m.prefix}help\` to see a list of all available commands and categories.\n`;
				response += `Or double-check your spelling!`;
			}
		}

		const pp = "https://telegra.ph/file/7c3ed11c5dd1e2a64bd02.jpg";
		const thumbnailUrl = await sock
			.profilePictureUrl(m.sender, "image")
			.catch(() => pp);

		await m.reply({
			text: response,
			contextInfo: {
				externalAdReply: {
					title: "",
					body: "@natsumiworld",
					renderLargerThumbnail: true,
					sourceUrl:
						"https://whatsapp.com/channel/0029Va8b0s8G3R3jDBfpja0a",
					mediaType: 1,
					thumbnailUrl,
				},
				mentionedJid: [m.sender],
			},
		});
	},
};
