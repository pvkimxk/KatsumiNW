<div align="center">
    <h1>Katsumi</h1>
    <img
        src="https://files.catbox.moe/1g4qtd.png"
        alt="Katsumi"
        style="border-radius: 10px; max-width: 100%; height: auto;"
    />
</div>


# 🌸 Why You'll Love Katsumi

- ⚡ <b>Lightning Fast</b>: Feels instant, even with tons of features!
- 🧩 <b>Plug & Play Modular</b>: Add new features as simply as drag-and-drop.
- 🗄️ <b>Data Your Way</b>: Works with MySQL, MongoDB, or simple JSON.
- 🦄 <b>Extreme Customization</b>: Change all settings in one `.env` file—no headaches!

## 🌈 Core Features

### 🔗 Multi-Database
> Use **MongoDB**, **MySQL**, or JSON—effortless to switch. Perfect for any deployment style.

### 🎛️ Plugin System
> Every feature is a tidy module. Install, remove, or upgrade with zero pain. Minimal bloat, max power.

### 🛠️ Full Customization
> Tweak bot prefixes, owner, DB, experimental flags, and more via `.env`.

## 🚀 Getting Started

#### 1. Clone Katsumi

```bash
git clone https://github.com/nat9h/Katsumi.git
cd Katsumi
```

#### 2. Install Everything

```bash
npm install
```

#### 3. Set Up Your Environment

```bash
cp .env.example .env
```

#### 4. Edit `.env` With Your Settings

| Variable         | Description                        | Default                           |
|------------------|------------------------------------|-----------------------------------|
| MYSQL_HOST       | MySQL database host                | localhost                         |
| MYSQL_PORT       | MySQL database port                | 3306                              |
| MYSQL_USER       | MySQL username                     | root                              |
| MYSQL_PASSWORD   | MySQL password                     | password                          |
| MYSQL_DATABASE   | MySQL database name                | baileys                           |
| BOT_SESSION_NAME | Session storage identifier         | session                           |
| BOT_PREFIXES     | Command prefixes (comma-separated) | !,.,?                             |
| USE_MONGO        | Enable MongoDB storage (true/false)| false                             |
| MONGO_URI        | MongoDB connection URI             | mongodb://localhost:27017/database|

---

## 💥 Running the Bot

- **Production:**  
  ```bash
  npm start
  ```
- **Development (auto-reload):**  
  ```bash
  npm run dev
  ```
- **Using PM2:**  
  ```bash
  npm run pm2
  ```

---

## 🌟 Plugins: Power & Simplicity

Every plugin = a single `.js` file.  
*Example: `ping.js` — shows latency & server info.*

```javascript
import os from "os";
import { performance } from "perf_hooks";

export default {
  name: "ping",
  description: "Displays bot response speed and server info",
  command: ["ping", "p"],
  permissions: "all",
  hidden: false,
  category: "info",
  cooldown: 0,

  async execute(m) {
    const start = performance.now();
    const ram = (os.totalmem() / Math.pow(1024, 3)).toFixed(2) + " GB";
    const freeRam = (os.freemem() / Math.pow(1024, 3)).toFixed(2) + " GB";
    await m.reply(
`🚀 *PONG!*
⏱️ Response Time: ${(performance.now() - start).toFixed(2)}ms
💻 CPU: ${os.cpus().length} Core(s)
📦 RAM: ${freeRam} / ${ram}
🆙 Uptime: ${Math.floor(os.uptime() / 86400)} days`
    );
  },
};
```
or

```javascript
import os from "os";
import { performance } from "perf_hooks";

export default {
  name: "ping",
  description: "Displays bot response speed and server info",
  command: ["ping", "p"],
  permissions: "all",
  hidden: false,
  category: "info",
  cooldown: 0,

  execute: async(m) => {
    const start = performance.now();
    const ram = (os.totalmem() / Math.pow(1024, 3)).toFixed(2) + " GB";
    const freeRam = (os.freemem() / Math.pow(1024, 3)).toFixed(2) + " GB";
    await m.reply(
`🚀 *PONG!*
⏱️ Response Time: ${(performance.now() - start).toFixed(2)}ms
💻 CPU: ${os.cpus().length} Core(s)
📦 RAM: ${freeRam} / ${ram}
🆙 Uptime: ${Math.floor(os.uptime() / 86400)} days`
    );
  },
};
```

**Result:**

```
🚀 PONG!
⏱️ Response Time: 12.34ms
💻 CPU: 8 Core(s)
📦 RAM: 3.21 GB / 16.00 GB
🆙 Uptime: 15 days
```

---

### 🎯 Plugin Option Reference

| Option       | Description             | Example/Values             |
|--------------|------------------------|----------------------------|
| command      | Plugin triggers         | ["ping", "p"]              |
| permissions  | Who can use             | "all", "admin", "owner"   |
| category     | Help menu group         | "info", "utils", ...       |
| cooldown     | Cooldown in seconds     | 0 (no cooldown)            |
| group        | Enable in groups?       | true/false                 |
| private      | Enable in private chat? | true/false                 |

---

## 🧑‍💻 Dev Tools

- **Lint:**  
  ```bash
  npm run lint
  ```
- **Prettier:**  
  ```bash
  npm run prettier
  ```

---

<div align="center" style="margin: 32px 0; font-size:1.25em;">
  <b>
    🚀 <a href="https://github.com/nat9h/Katsumi">Get Katsumi on GitHub</a> &nbsp;|&nbsp;
    <a href="https://github.com/nat9h/Katsumi/issues">Report Issue</a>
  </b>
  <br>
  <span style="font-size:1em; color:#a0a0a0;">MIT License © 2025 Natsumi &nbsp;|&nbsp; Made with <span style="color:#fd6c9e;">♥</span></span>
</div>
