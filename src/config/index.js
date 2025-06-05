/**
 * MySQL database configuration.
 * @type {object}
 */
export const MYSQL_CONFIG = {
	host: process.env.MYSQL_HOST,
	port: parseInt(process.env.MYSQL_PORT, 10),
	user: process.env.MYSQL_USER,
	password: process.env.MYSQL_PASSWORD,
	database: process.env.MYSQL_DATABASE,
	tableName: process.env.MYSQL_TABLE_NAME,
};

/**
 * General bot configuration.
 * @type {object}
 */
export const BOT_CONFIG = {
	sessionName: process.env.BOT_SESSION_NAME || "sessions",
	prefixes: process.env.BOT_PREFIXES
		? process.env.BOT_PREFIXES.split(",")
		: ["!", ".", "#"],

	ownerJids: process.env.OWNER_JIDS
		? JSON.parse(process.env.OWNER_JIDS)
		: ["6285175106460"],
	allowExperimental: process.env.BOT_ALLOW_EXPERIMENTAL === "true",
};
