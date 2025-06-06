import { jidNormalizedUser } from "baileys";
import { mkdir, readFile, writeFile } from "fs/promises";
import { MongoClient } from "mongodb";
import { join } from "path";
import { MONGO_CONFIG } from "../config/index.js";

/**
 * Represents a local store for session data, backed by JSON files.
 */
class Local {
	/**
	 * Creates an instance of Local.
	 * @param {string} sessionName - The name of the session, used for creating the directory and filenames.
	 */
	constructor(sessionName) {
		/**
		 * The name of the session.
		 * @type {string}
		 */
		this.sessionName = sessionName;
		/**
		 * Stores contact data.
		 * @type {object}
		 */
		this.contacts = {};
		/**
		 * Stores group metadata.
		 * @type {object}
		 */
		this.groupMetadata = {};
		/**
		 * Stores messages.
		 * @type {object}
		 */
		this.messages = {};
		/**
		 * Paths to the JSON files for storing data.
		 * @type {object}
		 * @property {string} contacts - Path to the contacts JSON file.
		 * @property {string} metadata - Path to the group metadata JSON file.
		 * @property {string} messages - Path to the messages JSON file.
		 */
		this.path = {
			contacts: join(process.cwd(), `${sessionName}/contacts.json`),
			metadata: join(process.cwd(), `${sessionName}/groupMetadata.json`),
			messages: join(process.cwd(), `${sessionName}/messages.json`),
		};
		/**
		 * Interval ID for periodic saving.
		 * @type {NodeJS.Timeout|null}
		 */
		this.saveInterval = null;
	}

	/**
	 * Asynchronously loads session data from JSON files.
	 * If a file doesn't exist or is invalid, it initializes with an empty object.
	 * @returns {Promise<void>}
	 */
	async load() {
		try {
			await mkdir(this.sessionName, { recursive: true });
			try {
				this.contacts = JSON.parse(
					await readFile(this.path.contacts, "utf-8")
				);
			} catch {
				await writeFile(this.path.contacts, "{}");
				this.contacts = {};
			}
			try {
				this.groupMetadata = JSON.parse(
					await readFile(this.path.metadata, "utf-8")
				);
			} catch {
				await writeFile(this.path.metadata, "{}");
				this.groupMetadata = {};
			}
			try {
				this.messages = JSON.parse(
					await readFile(this.path.messages, "utf-8")
				);
			} catch {
				await writeFile(this.path.messages, "{}");
				this.messages = {};
			}
		} catch (error) {
			console.error("Failed to initialize store:", error);
		}
	}

	/**
	 * Asynchronously saves current session data to JSON files.
	 * @returns {Promise<void>}
	 */
	async save() {
		try {
			await Promise.all([
				writeFile(
					this.path.contacts,
					JSON.stringify(this.contacts, null, 2)
				),
				writeFile(
					this.path.metadata,
					JSON.stringify(this.groupMetadata, null, 2)
				),
				writeFile(
					this.path.messages,
					JSON.stringify(this.messages, null, 2)
				),
			]);
		} catch (error) {
			console.error("Failed to save store:", error);
		}
	}

	/**
	 * Starts periodically saving session data to JSON files.
	 * @param {number} [interval=30000] - The interval in milliseconds at which to save the data. Defaults to 30 seconds.
	 */
	savePeriodically(interval = 30000) {
		if (this.saveInterval) {
			clearInterval(this.saveInterval);
		}
		this.saveInterval = setInterval(() => this.save(), interval);
	}

	/**
	 * Stops the periodic saving of session data.
	 */
	stopSaving() {
		if (this.saveInterval) {
			clearInterval(this.saveInterval);
		}
		this.saveInterval = null;
	}

	/**
	 * Updates contact information.
	 * @param {Array<object>} update - An array of contact objects with updates.
	 */
	updateContacts(update) {
		for (const contact of update) {
			const id = jidNormalizedUser(contact.id);
			this.contacts[id] = { ...(this.contacts[id] || {}), ...contact };
		}
	}

	/**
	 * Inserts or updates contact information, marking them as contacts.
	 * @param {Array<object>} update - An array of contact objects to upsert.
	 */
	upsertContacts(update) {
		for (const contact of update) {
			const id = jidNormalizedUser(contact.id);
			this.contacts[id] = { ...contact, isContact: true };
		}
	}

	/**
	 * Updates group metadata.
	 * @param {Array<object>} updates - An array of group metadata objects with updates.
	 */
	updateGroupMetadata(updates) {
		for (const update of updates) {
			const id = update.id;
			if (this.groupMetadata[id]) {
				this.groupMetadata[id] = {
					...this.groupMetadata[id],
					...update,
				};
			}
		}
	}

	/**
	 * Retrieves group metadata for a given JID.
	 * @param {string} jid - The JID of the group.
	 * @returns {object|undefined} The group metadata or undefined if not found.
	 */
	getGroupMetadata(jid) {
		return this.groupMetadata[jidNormalizedUser(jid)];
	}

	/**
	 * Sets group metadata for a given JID.
	 * @param {string} jid - The JID of the group.
	 * @param {object} metadata - The metadata object to set.
	 */
	setGroupMetadata(jid, metadata) {
		this.groupMetadata[jidNormalizedUser(jid)] = metadata;
	}

	/**
	 * Retrieves contact information for a given JID.
	 * @param {string} jid - The JID of the contact.
	 * @returns {object|undefined} The contact object or undefined if not found.
	 */
	getContact(jid) {
		return this.contacts[jidNormalizedUser(jid)];
	}

	/**
	 * Saves a message for a given JID.
	 * @param {string} jid - The JID of the chat.
	 * @param {object} message - The message object to save.
	 */
	saveMessage(jid, message) {
		const normalizedJid = jidNormalizedUser(jid);
		if (!this.messages[normalizedJid]) {
			this.messages[normalizedJid] = {};
		}
		this.messages[normalizedJid][message.key.id] = message;
	}

	/**
	 * Loads a message for a given JID and message ID.
	 * @param {string} jid - The JID of the chat.
	 * @param {string} id - The ID of the message to load.
	 * @returns {object|null} The message object or null if not found.
	 */
	loadMessage(jid, id) {
		const normalizedJid = jidNormalizedUser(jid);
		return this.messages[normalizedJid]?.[id] || null;
	}
}

/**
 * Represents a MongoDB-based store for session data.
 */
class Mongo {
	/**
	 * Creates an instance of Mongo.
	 * @param {string} sessionName - The name of the session, used as the database name.
	 */
	constructor(sessionName) {
		/**
		 * The name of the session, used as the database name.
		 * @type {string}
		 */
		this.sessionName = sessionName;
		/**
		 * Stores contact data.
		 * @type {object}
		 */
		this.contacts = {};
		/**
		 * Stores group metadata.
		 * @type {object}
		 */
		this.groupMetadata = {};
		/**
		 * Stores messages.
		 * @type {object}
		 */
		this.messages = {};
		/**
		 * Interval ID for periodic saving.
		 * @type {NodeJS.Timeout|null}
		 */
		this.saveInterval = null;
		/**
		 * The MongoDB client instance.
		 * @type {MongoClient|null}
		 */
		this.client = null;
		/**
		 * The MongoDB database instance.
		 * @type {Db|null}
		 */
		this.db = null;
		/**
		 * MongoDB collection instances.
		 * @type {object}
		 * @property {Collection} contacts - The contacts collection.
		 * @property {Collection} groupMetadata - The group metadata collection.
		 * @property {Collection} messages - The messages collection.
		 */
		this.coll = {};
	}

	/**
	 * Establishes a connection to MongoDB and initializes collections.
	 * @private
	 * @returns {Promise<void>}
	 */
	async _connect() {
		if (!this.client) {
			this.client = new MongoClient(MONGO_CONFIG.uri);
			await this.client.connect();
			this.db = this.client.db(this.sessionName);
			this.coll.contacts = this.db.collection("contacts");
			this.coll.groupMetadata = this.db.collection("groupMetadata");
			this.coll.messages = this.db.collection("messages");
		}
	}

	/**
	 * Asynchronously loads session data from MongoDB.
	 * @returns {Promise<void>}
	 */
	async load() {
		await this._connect();
		const [contacts, groupMetadata, messages] = await Promise.all([
			this.coll.contacts.find().toArray(),
			this.coll.groupMetadata.find().toArray(),
			this.coll.messages.find().toArray(),
		]);
		this.contacts = Object.fromEntries(contacts.map((c) => [c.id, c]));
		this.groupMetadata = Object.fromEntries(
			groupMetadata.map((g) => [g.id, g])
		);
		this.messages = {};
		for (const doc of messages) {
			if (!this.messages[doc.jid]) {
				this.messages[doc.jid] = {};
			}
			this.messages[doc.jid][doc.id] = doc.message;
		}
	}

	/**
	 * Asynchronously saves current session data to MongoDB.
	 * @returns {Promise<void>}
	 */
	async save() {
		await this._connect();
		await Promise.all(
			Object.values(this.contacts).map((c) =>
				this.coll.contacts.updateOne(
					{ id: c.id },
					{ $set: c },
					{ upsert: true }
				)
			)
		);
		await Promise.all(
			Object.values(this.groupMetadata).map((g) =>
				this.coll.groupMetadata.updateOne(
					{ id: g.id },
					{ $set: g },
					{ upsert: true }
				)
			)
		);
		for (const [jid, msgs] of Object.entries(this.messages)) {
			for (const [id, msg] of Object.entries(msgs)) {
				await this.coll.messages.updateOne(
					{ jid, id },
					{ $set: { jid, id, message: msg } },
					{ upsert: true }
				);
			}
		}
	}

	/**
	 * Starts periodically saving session data to MongoDB.
	 * @param {number} [interval=30000] - The interval in milliseconds at which to save the data. Defaults to 30 seconds.
	 */
	savePeriodically(interval = 30000) {
		if (this.saveInterval) {
			clearInterval(this.saveInterval);
		}
		this.saveInterval = setInterval(() => this.save(), interval);
	}

	/**
	 * Stops the periodic saving of session data.
	 */
	stopSaving() {
		if (this.saveInterval) {
			clearInterval(this.saveInterval);
		}
		this.saveInterval = null;
	}

	/**
	 * Updates contact information.
	 * @param {Array<object>} update - An array of contact objects with updates.
	 */
	updateContacts(update) {
		for (const contact of update) {
			const id = jidNormalizedUser(contact.id);
			this.contacts[id] = { ...(this.contacts[id] || {}), ...contact };
		}
	}

	/**
	 * Inserts or updates contact information, marking them as contacts.
	 * @param {Array<object>} update - An array of contact objects to upsert.
	 */
	upsertContacts(update) {
		for (const contact of update) {
			const id = jidNormalizedUser(contact.id);
			this.contacts[id] = { ...contact, isContact: true };
		}
	}

	/**
	 * Updates group metadata.
	 * @param {Array<object>} updates - An array of group metadata objects with updates.
	 */
	updateGroupMetadata(updates) {
		for (const update of updates) {
			const id = update.id;
			if (this.groupMetadata[id]) {
				this.groupMetadata[id] = {
					...this.groupMetadata[id],
					...update,
				};
			}
		}
	}

	/**
	 * Retrieves group metadata for a given JID.
	 * @param {string} jid - The JID of the group.
	 * @returns {object|undefined} The group metadata or undefined if not found.
	 */
	getGroupMetadata(jid) {
		return this.groupMetadata[jidNormalizedUser(jid)];
	}

	/**
	 * Sets group metadata for a given JID.
	 * @param {string} jid - The JID of the group.
	 * @param {object} metadata - The metadata object to set.
	 */
	setGroupMetadata(jid, metadata) {
		this.groupMetadata[jidNormalizedUser(jid)] = metadata;
	}

	/**
	 * Retrieves contact information for a given JID.
	 * @param {string} jid - The JID of the contact.
	 * @returns {object|undefined} The contact object or undefined if not found.
	 */
	getContact(jid) {
		return this.contacts[jidNormalizedUser(jid)];
	}

	/**
	 * Saves a message for a given JID.
	 * @param {string} jid - The JID of the chat.
	 * @param {object} message - The message object to save.
	 */
	saveMessage(jid, message) {
		const normalizedJid = jidNormalizedUser(jid);
		if (!this.messages[normalizedJid]) {
			this.messages[normalizedJid] = {};
		}
		this.messages[normalizedJid][message.key.id] = message;
	}

	/**
	 * Loads a message for a given JID and message ID.
	 * @param {string} jid - The JID of the chat.
	 * @param {string} id - The ID of the message to load.
	 * @returns {object|null} The message object or null if not found.
	 */
	loadMessage(jid, id) {
		const normalizedJid = jidNormalizedUser(jid);
		return this.messages[normalizedJid]?.[id] || null;
	}
}

/**
 * A versatile store class that delegates its operations to either a
 * local JSON-based store (`Local`) or a MongoDB-based store (`Mongo`)
 * depending on the `MONGO_CONFIG.USE_MONGO` flag.
 */
class Store {
	/**
	 * Creates an instance of Store.
	 * @param {string} sessionName - The name of the session, used for both local and MongoDB storage.
	 */
	constructor(sessionName) {
		/**
		 * The underlying storage backend, either a `Local` or `Mongo` instance.
		 * @type {Local|Mongo}
		 */
		if (MONGO_CONFIG.USE_MONGO) {
			this.backend = new Mongo(sessionName);
		} else {
			this.backend = new Local(sessionName);
		}
	}

	/**
	 * Loads session data from the configured backend.
	 * @returns {Promise<void>}
	 */
	load() {
		return this.backend.load();
	}

	/**
	 * Saves current session data to the configured backend.
	 * @returns {Promise<void>}
	 */
	save() {
		return this.backend.save();
	}

	/**
	 * Starts periodically saving session data to the configured backend.
	 * @param {number} interval - The interval in milliseconds at which to save the data.
	 * @returns {void}
	 */
	savePeriodically(interval) {
		return this.backend.savePeriodically(interval);
	}

	/**
	 * Stops the periodic saving of session data for the configured backend.
	 * @returns {void}
	 */
	stopSaving() {
		return this.backend.stopSaving();
	}

	/**
	 * Updates contact information in the configured backend.
	 * @param {Array<object>} update - An array of contact objects with updates.
	 * @returns {void}
	 */
	updateContacts(update) {
		return this.backend.updateContacts(update);
	}

	/**
	 * Inserts or updates contact information in the configured backend, marking them as contacts.
	 * @param {Array<object>} update - An array of contact objects to upsert.
	 * @returns {void}
	 */
	upsertContacts(update) {
		return this.backend.upsertContacts(update);
	}

	/**
	 * Updates group metadata in the configured backend.
	 * @param {Array<object>} updates - An array of group metadata objects with updates.
	 * @returns {void}
	 */
	updateGroupMetadata(updates) {
		return this.backend.updateGroupMetadata(updates);
	}

	/**
	 * Retrieves group metadata for a given JID from the configured backend.
	 * @param {string} jid - The JID of the group.
	 * @returns {object|undefined} The group metadata or undefined if not found.
	 */
	getGroupMetadata(jid) {
		return this.backend.getGroupMetadata(jid);
	}

	/**
	 * Sets group metadata for a given JID in the configured backend.
	 * @param {string} jid - The JID of the group.
	 * @param {object} metadata - The metadata object to set.
	 * @returns {void}
	 */
	setGroupMetadata(jid, metadata) {
		return this.backend.setGroupMetadata(jid, metadata);
	}

	/**
	 * Retrieves contact information for a given JID from the configured backend.
	 * @param {string} jid - The JID of the contact.
	 * @returns {object|undefined} The contact object or undefined if not found.
	 */
	getContact(jid) {
		return this.backend.getContact(jid);
	}

	/**
	 * Saves a message for a given JID in the configured backend.
	 * @param {string} jid - The JID of the chat.
	 * @param {object} message - The message object to save.
	 * @returns {void}
	 */
	saveMessage(jid, message) {
		return this.backend.saveMessage(jid, message);
	}

	/**
	 * Loads a message for a given JID and message ID from the configured backend.
	 * @param {string} jid - The JID of the chat.
	 * @param {string} id - The ID of the message to load.
	 * @returns {object|null} The message object or null if not found.
	 */
	loadMessage(jid, id) {
		return this.backend.loadMessage(jid, id);
	}
}

export default Store;
