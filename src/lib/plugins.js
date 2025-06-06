import { readdirSync, watch } from "fs";
import NodeCache from "node-cache";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import print from "./print.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class PluginManager {
	constructor(botConfig) {
		this.plugins = [];
		this.cooldowns = new NodeCache({ stdTTL: 0, checkperiod: 60 });
		this.usageLimits = new NodeCache({ stdTTL: 86400 });
		this.botConfig = botConfig;
		this.commandQueues = new Map();
		this.processingStatus = new Map();
		this.debounceTimeout = null;
	}

	async loadPlugins() {
		this.plugins = [];
		const pluginsDir = join(__dirname, "../plugins");

		try {
			const pluginFolders = readdirSync(pluginsDir, {
				withFileTypes: true,
			})
				.filter((dirent) => dirent.isDirectory())
				.map((dirent) => dirent.name);

			print.info(`🌱 Loading plugins from: ${pluginsDir}`);

			for (const folder of pluginFolders) {
				const folderPath = join(pluginsDir, folder);
				const pluginFiles = readdirSync(folderPath).filter(
					(file) => file.endsWith(".js") && !file.startsWith("_")
				);

				for (const file of pluginFiles) {
					const absolutePath = join(folderPath, file);
					const pluginURL = pathToFileURL(absolutePath).href;

					try {
						const module = await import(
							`${pluginURL}?update=${Date.now()}`
						);
						const plugin = module.default;

						if (!this.validatePlugin(plugin, file)) {
							continue;
						}

						this.configurePluginDefaults(plugin);
						this.plugins.push(plugin);

						print.info(
							`✔ Loaded: ${plugin.name} (${plugin.command.join(", ")})`
						);
					} catch (error) {
						print.error(`❌ Failed to load ${file}:`, error);
					}
				}
			}
			print.info(`🚀 Successfully loaded ${this.plugins.length} plugins`);
		} catch (dirError) {
			print.error("Plugin directory error:", dirError);
		}
	}

	watchPlugins() {
		const pluginsDir = join(__dirname, "../plugins");
		print.info(`👀 Watching for plugin changes in: ${pluginsDir}`);

		try {
			const watcher = watch(
				pluginsDir,
				{ recursive: true },
				(eventType, filename) => {
					if (filename && filename.endsWith(".js")) {
						print.info(
							`🔃 Plugin change detected (Event: ${eventType}, File: ${filename}). Reloading...`
						);

						clearTimeout(this.debounceTimeout);
						this.debounceTimeout = setTimeout(() => {
							this.loadPlugins();
						}, 200);
					}
				}
			);

			watcher.on("error", (error) => {
				print.error("❌ Error in watch:", error);
			});
		} catch (error) {
			print.error("❌ Failed to start watching plugin directory:", error);
		}
	}

	validatePlugin(plugin, filename) {
		if (
			!plugin ||
			!plugin.name ||
			!Array.isArray(plugin.command) ||
			typeof plugin.execute !== "function"
		) {
			print.warn(`⚠ Skipped invalid plugin: ${filename}`);
			return false;
		}
		return true;
	}

	configurePluginDefaults(plugin) {
		const defaults = {
			description: "No description provided",
			permissions: "all",
			hidden: false,
			failed: "❌ Failed executing %command: %error",
			wait: "⏳ Processing your request...",
			category: "general",
			cooldown: 0,
			limit: false,
			dailyLimit: 0,
			usage: "",
			react: true,
			botAdmin: false,
			group: false,
			private: false,
			owner: false,
			experimental: false,
		};

		Object.keys(defaults).forEach((key) => {
			plugin[key] =
				plugin[key] !== undefined ? plugin[key] : defaults[key];
		});
	}

	async enqueueCommand(sock, m) {
		const senderJid = m.sender;

		if (!this.commandQueues.has(senderJid)) {
			this.commandQueues.set(senderJid, []);
		}

		const queue = this.commandQueues.get(senderJid);

		const isDuplicate = queue.some(
			(item) => item.m.command === m.command && item.m.args === m.args
		);

		if (isDuplicate) {
			print.debug(
				`♻ Skipped duplicate command: ${m.command} from ${senderJid}`
			);
			return;
		}

		queue.push({ sock, m });
		print.debug(
			`📥 Enqueued: ${m.prefix}${m.command} for ${senderJid} (Queue: ${queue.length})`
		);

		if (!this.processingStatus.get(senderJid)) {
			this.processQueue(senderJid);
		}
	}

	async processQueue(senderJid) {
		this.processingStatus.set(senderJid, true);
		const queue = this.commandQueues.get(senderJid) || [];

		if (queue.length === 0) {
			this.processingStatus.set(senderJid, false);
			return;
		}

		const { sock, m } = queue.shift();
		const command = m.command.toLowerCase();
		const plugin = this.plugins.find((p) =>
			p.command.some((cmd) => cmd.toLowerCase() === command)
		);

		try {
			if (!plugin) {
				return this.continueQueue(senderJid);
			}

			const checks = [
				this.checkCooldown(plugin, m, sock),
				this.checkEnvironment(plugin, m, sock),
				this.checkPermissions(plugin, m, sock),
				this.checkUsage(plugin, m, sock),
				this.checkDailyLimit(plugin, m, sock),
			];

			const results = await Promise.all(checks);
			if (results.some((result) => result)) {
				return this.continueQueue(senderJid);
			}

			await this.sendPreExecutionActions(plugin, m, sock);
			await this.executePlugin(plugin, sock, m);
		} catch (error) {
			print.error(`🔥 Processing error for ${senderJid}:`, error);
		} finally {
			this.continueQueue(senderJid);
		}
	}

	continueQueue(senderJid) {
		setImmediate(() => this.processQueue(senderJid));
	}

	async checkCooldown(plugin, m) {
		if (plugin.cooldown <= 0) {
			return false;
		}

		const cooldownKey = `${m.sender}:${plugin.name}`;
		if (this.cooldowns.has(cooldownKey)) {
			const remaining = this.cooldowns.getTtl(cooldownKey) - Date.now();
			const seconds = Math.ceil(remaining / 1000);

			await m.reply(
				`⏳ Cooldown active! Please wait *${seconds}s* before using *${plugin.command[0]}* again`
			);

			if (plugin.react) {
				await m.react("⏳");
			}
			return true;
		}
		return false;
	}

	async checkEnvironment(plugin, m) {
		let error = null;

		if (plugin.group && !m.isGroup) {
			error = "🚫 Group-only command";
		} else if (plugin.private && m.isGroup) {
			error = "🚫 Private-chat only command";
		} else if (plugin.experimental && !this.botConfig.allowExperimental) {
			error = "🚧 Experimental feature disabled";
		}

		if (error) {
			await m.reply(error);
			if (plugin.react) {
				await m.react("❌");
			}
			return true;
		}
		return false;
	}

	async checkPermissions(plugin, m) {
		const isOwner = m.isOwner;

		let isGroupAdmin = false;
		if (m.isGroup && m.metadata?.participants) {
			const participant = m.metadata.participants.find(
				(p) => p.id === m.sender
			);
			isGroupAdmin =
				participant?.admin === "admin" ||
				participant?.admin === "superadmin";
		}

		if (plugin.owner && !isOwner) {
			await m.reply("🔒 Owner-only command");
			if (plugin.react) {
				await m.react("❌");
			}
			return true;
		}

		if (plugin.permissions === "admin" && !isGroupAdmin && !isOwner) {
			await m.reply("👮‍♂️ Admin-only command");
			if (plugin.react) {
				await m.react("❌");
			}
			return true;
		}

		if (plugin.botAdmin && m.isGroup && !m.isBotAdmin) {
			await m.reply("🤖 Bot needs admin privileges");
			if (plugin.react) {
				await m.react("❌");
			}
			return true;
		}

		return false;
	}

	async checkUsage(plugin, m) {
		if (!plugin.usage) {
			return false;
		}

		const args = m.args;
		const hasRequiredArgs = plugin.usage.includes("<");
		const requiresQuoted = plugin.usage.toLowerCase().includes("quoted");

		if (
			(hasRequiredArgs && !args.length && !m.isQuoted) ||
			(requiresQuoted && !m.isQuoted)
		) {
			const usage = plugin.usage
				.replace("$prefix", m.prefix)
				.replace("$command", m.command);

			await m.reply(`📝 Usage:\n\`\`\`${usage}\`\`\``);
			if (plugin.react) {
				await m.react("ℹ️");
			}

			return true;
		}
		return false;
	}

	async checkDailyLimit(plugin, m) {
		if (!plugin.dailyLimit || plugin.dailyLimit <= 0) {
			return false;
		}

		const limitKey = `${m.sender}:${plugin.name}`;
		const usageCount = (this.usageLimits.get(limitKey) || 0) + 1;

		if (usageCount > plugin.dailyLimit) {
			await m.reply(
				`📊 Daily limit reached! (${plugin.dailyLimit}/${plugin.dailyLimit})\n` +
					`Resets in ${this.getResetTime()}`
			);
			if (plugin.react) {
				await m.react("🚫");
			}
			return true;
		}

		this.usageLimits.set(limitKey, usageCount);
		return false;
	}

	getResetTime() {
		const now = new Date();
		const reset = new Date(now);
		reset.setDate(reset.getDate() + 1);
		reset.setHours(0, 0, 0, 0);
		return reset.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	async sendPreExecutionActions(plugin, m) {
		if (plugin.wait) {
			await m.reply(plugin.wait);
		}
		if (plugin.react) {
			await m.react("🔄");
		}
	}

	async executePlugin(plugin, sock, m) {
		const startTime = Date.now();
		const params = {
			sock,
			m,
			text: m.text,
			args: m.args,
			plugins: this.plugins,
			command: m.command,
			prefix: m.prefix,
			isOwner: m.isOwner,
		};

		try {
			print.info(
				`⚡ Executing: ${plugin.name} by ${m.pushName} [${m.sender}]`
			);

			await plugin.execute(params);

			if (plugin.cooldown > 0) {
				this.cooldowns.set(
					`${m.sender}:${plugin.name}`,
					true,
					plugin.cooldown
				);
			}
			if (plugin.react) {
				await m.react("✅");
			}

			const duration = Date.now() - startTime;
			print.info(`✓ Executed ${plugin.name} in ${duration}ms`);
		} catch (error) {
			print.error(`⚠ Plugin ${plugin.name} failed:`, error);

			const fullCommand = m.prefix + m.command;
			const errorMessage = plugin.failed
				.replace("%command", fullCommand)
				.replace("%error", error.message || "Internal error");

			await m.reply(errorMessage);

			if (plugin.react) {
				await m.react("❌");
			}
		}
	}

	getPlugins() {
		return this.plugins;
	}

	getQueueStatus() {
		return {
			totalQueues: this.commandQueues.size,
			queues: Array.from(this.commandQueues.entries()).map(
				([jid, queue]) => ({
					jid,
					count: queue.length,
				})
			),
		};
	}
}

export default PluginManager;
