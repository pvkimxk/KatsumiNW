import WhatsAppBot from "./core/connect.js";
import print from "./lib/print.js";

const bot = new WhatsAppBot();

try {
	await bot.start();
} catch (error) {
	print.error("Failed to start WhatsApp Bot:", error);
	process.exit(1);
}
