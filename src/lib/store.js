import { jidNormalizedUser } from "baileys";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * @typedef {object} Contact
 * @property {string} id - The JID of the contact.
 * @property {string} [name] - The name of the contact.
 * @property {boolean} [isContact] - Indicates if the contact is in the user's contact list.
 */

/**
 * @typedef {object} GroupMetadata
 * @property {string} id - The JID of the group.
 * @property {string} subject - The subject (name) of the group.
 * @property {number} creation - The timestamp of group creation.
 * @property {string} owner - The JID of the group owner.
 * @property {Array<object>} participants - List of group participants.
 */

/**
 * @typedef {object} BaileysMessageKey
 * @property {string} id - The ID of the message.
 * @property {boolean} [fromMe] - Indicates if the message was sent by the current user.
 * @property {string} [remoteJid] - The JID of the remote party.
 * @property {string} [participant] - The JID of the participant in a group chat.
 */

/**
 * @typedef {object} BaileysMessage
 * @property {BaileysMessageKey} key - The key of the message.
 * @property {object} message - The message content.
 * // Add other relevant properties for Baileys message as needed
 */

/**
 * Manages the storage and retrieval of session data, including contacts, group metadata, and messages.
 * Data is persisted to JSON files within a specified session directory.
 */
class Store {
	/**
	 * The name of the session.
	 * @type {string}
	 */
	sessionName;

	/**
	 * Stores contact information, indexed by normalized JID.
	 * @type {object.<string, Contact>}
	 */
	contacts;

	/**
	 * Stores group metadata, indexed by normalized group JID.
	 * @type {object.<string, GroupMetadata>}
	 */
	groupMetadata;

	/**
	 * Stores messages, nested by normalized JID and then by message ID.
	 * @type {object.<string, object.<string, BaileysMessage>>}
	 */
	messages;

	/**
	 * Paths to the JSON files for storing different types of data.
	 * @type {{contacts: string, metadata: string, messages: string}}
	 */
	path;

	/**
	 * The interval ID for periodic saving.
	 * @type {NodeJS.Timeout|null}
	 */
	saveInterval;

	/**
	 * Creates an instance of Store.
	 * @param {string} sessionName - The name of the session, used for creating a dedicated directory.
	 */
	constructor(sessionName) {
		this.sessionName = sessionName;
		this.contacts = {};
		this.groupMetadata = {};
		this.messages = {};
		this.path = {
			contacts: join(process.cwd(), `${sessionName}/contacts.json`),
			metadata: join(process.cwd(), `${sessionName}/groupMetadata.json`),
			messages: join(process.cwd(), `${sessionName}/messages.json`),
		};
		this.saveInterval = null;
	}

	/**
	 * Asynchronously loads existing session data (contacts, group metadata, messages) from disk.
	 * If files do not exist, it creates empty ones.
	 * @returns {Promise<void>}
	 */
	async load() {
		try {
			await mkdir(this.sessionName, { recursive: true });

			try {
				const contactsData = await readFile(
					this.path.contacts,
					"utf-8"
				);
				this.contacts = JSON.parse(contactsData);
			} catch (error) {
				if (error.code === "ENOENT" || error instanceof SyntaxError) {
					await writeFile(this.path.contacts, "{}");
					this.contacts = {};
				} else {
					throw error;
				}
			}

			try {
				const metaData = await readFile(this.path.metadata, "utf-8");
				this.groupMetadata = JSON.parse(metaData);
			} catch (error) {
				if (error.code === "ENOENT" || error instanceof SyntaxError) {
					await writeFile(this.path.metadata, "{}");
					this.groupMetadata = {};
				} else {
					throw error;
				}
			}

			try {
				const messagesData = await readFile(
					this.path.messages,
					"utf-8"
				);
				this.messages = JSON.parse(messagesData);
			} catch (error) {
				if (error.code === "ENOENT" || error instanceof SyntaxError) {
					await writeFile(this.path.messages, "{}");
					this.messages = {};
				} else {
					throw error;
				}
			}
		} catch (error) {
			console.error("Failed to initialize store:", error);
		}
	}

	/**
	 * Asynchronously saves the current state of contacts, group metadata, and messages to their respective JSON files.
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
	 * Starts a periodic saving mechanism that calls the `save` method at a specified interval.
	 * If already running, it will clear the existing interval and start a new one.
	 * @param {number} [interval=30000] - The interval in milliseconds at which to save data (default: 30 seconds).
	 * @returns {void}
	 */
	savePeriodically(interval = 30000) {
		if (this.saveInterval) {
			clearInterval(this.saveInterval);
		}
		this.saveInterval = setInterval(() => this.save(), interval);
	}

	/**
	 * Stops the periodic saving mechanism.
	 * @returns {void}
	 */
	stopSaving() {
		if (this.saveInterval) {
			clearInterval(this.saveInterval);
			this.saveInterval = null;
		}
	}

	/**
	 * Updates existing contact information or adds new contacts.
	 * For each contact in the update, it merges the new data with existing data.
	 * @param {Array<Partial<Contact>>} update - An array of contact objects with partial or full information to update.
	 * @returns {void}
	 */
	updateContacts(update) {
		for (const contact of update) {
			const id = jidNormalizedUser(contact.id);
			this.contacts[id] = {
				...(this.contacts[id] || {}),
				...contact,
			};
		}
	}

	/**
	 * Inserts or updates contact information, explicitly setting `isContact` to true.
	 * This method is useful when you want to ensure a contact is marked as a known contact.
	 * @param {Array<Partial<Contact>>} update - An array of contact objects to upsert.
	 * @returns {void}
	 */
	upsertContacts(update) {
		for (const contact of update) {
			const id = jidNormalizedUser(contact.id);
			this.contacts[id] = {
				...contact,
				isContact: true,
			};
		}
	}

	/**
	 * Updates existing group metadata. Only properties for existing groups will be updated.
	 * @param {Array<Partial<GroupMetadata>>} updates - An array of group metadata objects with partial or full information to update.
	 * @returns {void}
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
	 * Retrieves the metadata for a specific group.
	 * @param {string} jid - The JID of the group.
	 * @returns {GroupMetadata|undefined} The group metadata if found, otherwise `undefined`.
	 */
	getGroupMetadata(jid) {
		return this.groupMetadata[jidNormalizedUser(jid)];
	}

	/**
	 * Sets or updates the metadata for a specific group.
	 * @param {string} jid - The JID of the group.
	 * @param {GroupMetadata} metadata - The full group metadata object to set.
	 * @returns {void}
	 */
	setGroupMetadata(jid, metadata) {
		this.groupMetadata[jidNormalizedUser(jid)] = metadata;
	}

	/**
	 * Retrieves a contact by their JID.
	 * @param {string} jid - The JID of the contact.
	 * @returns {Contact|undefined} The contact object if found, otherwise `undefined`.
	 */
	getContact(jid) {
		return this.contacts[jidNormalizedUser(jid)];
	}

	/**
	 * Saves a message to the store under the given JID.
	 * Messages are stored by normalized JID and then by their unique message ID.
	 * @param {string} jid - The JID associated with the message (e.g., chat JID).
	 * @param {BaileysMessage} message - The message object to save.
	 * @returns {void}
	 */
	saveMessage(jid, message) {
		const normalizedJid = jidNormalizedUser(jid);
		if (!this.messages[normalizedJid]) {
			this.messages[normalizedJid] = {};
		}
		this.messages[normalizedJid][message.key.id] = message;
	}

	/**
	 * Loads a specific message from the store for a given JID and message ID.
	 * @param {string} jid - The JID associated with the message.
	 * @param {string} id - The unique ID of the message.
	 * @returns {BaileysMessage|null} The message object if found, otherwise `null`.
	 */
	loadMessage(jid, id) {
		const normalizedJid = jidNormalizedUser(jid);
		return this.messages[normalizedJid]?.[id] || null;
	}
}

export default Store;
