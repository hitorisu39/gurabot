![gurabot](resources/branding/banner.png)
<h1 align="center">gurabot</h1>
<p align="center">A simple osu! Discord bot with a bunch of features.</p>
<p align="center">
  <a href="https://ko-fi.com/cornosu"><img src="https://img.shields.io/badge/Support_on_Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Support us on Ko-fi"></a>
  <a href="https://discord.gg/Ed4yeNgWxj"><img src="https://img.shields.io/discord/857929283757146144?style=for-the-badge&logo=discord&logoColor=white&label=Discord" alt="Join our Discord server"></a>
  <a href="https://discord.com/api/oauth2/authorize?client_id=777206490280755211&permissions=309238025216&scope=bot%20applications.commands"><img src="https://img.shields.io/badge/Add_to-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Add to Discord">
</a>
</p>

# Overview
gurabot is an open-source Discord bot for osu!, providing player information, score sharing, difficulty/pp calcs, replay rendering, and other useful commands directly through Discord.

After inviting the bot, use `!help` to get started or `!help [command]` to view information and examples for a specific command.

# Calculations
Difficulty, performance, and strain calculations are handled by a separate C# service built on the official osu! packages used by the game.

# Setup

## Development
Development requires:

- Node.js 22 or newer.
- Yarn 1.22.22
- .NET 8 SDK
- PostgreSQL
- Redis
- Docker and Docker Compose, recommended for PostgreSQL and Redis

Clone the repository and install the dependencies:
```
git clone https://github.com/hitorisu39/gurabot.git
cd gurabot
yarn install --frozen-lockfile
```

Copy the environment template:
```
cp .env.template .env
```
On Windows:
```
Copy-Item .env.template .env
```

At minimum, fill in the Discord and osu! credentials:
```
DISCORD_TOKEN=
DISCORD_APPLICATION_ID=
OSU_CLIENT_ID=
OSU_CLIENT_SECRET=
```

PostgreSQL and Redis must also be available using the connection details configured in `.env`.
If you installed Docker, you can start them up by running `yarn docker:dev`.

For complete functionality, fill in the remaining environment variables for services such as o!rdr, metrics, public URLs, and optional Loki logging.

Generate the Prisma client and apply the schema to the database:
```
yarn prisma generate
yarn prisma db push
```

Build the project:
```
yarn build
```

Start the bot and calculator in development mode:
```
yarn dev
```

When working only on Discord-related TypeScript code, `yarn dev` is sufficient. Rebuilding the adapter and calculator is generally unnecessary unless their source code or generated interfaces were changed.

## Production
The recommended production setup uses the prebuilt Docker images and the included Docker Compose files.
The production server requires:
- Docker Engine with Docker Compose v2
- Git

Node.js, Yarn, and the .NET SDK are not required unless you want to use the optional Yarn deployment scripts.

### 1. Clone a release
```
git clone https://github.com/hitorisu39/gurabot.git
cd gurabot

git fetch --tags
git checkout v1.0.0
```

### 2. Configure the environment
```
cp .env.template .env
```
Set the image repository and release version:
```
APP_IMAGE=ghcr.io/hitorisu39/gurabot
APP_IMAGE_TAG=1.0.0
```
Configure the required Discord and osu! credentials:
```
DISCORD_TOKEN=
DISCORD_APPLICATION_ID=
OSU_CLIENT_ID=
OSU_CLIENT_SECRET=
```
Configure any remaining integrations required by your deployment, such as OAuth URLs, o!rdr, Grafana, etc.

### 3. Start monitoring (optional)
Create the external network used by the application and monitoring stacks:
```
docker network inspect gurabot_monitoring >/dev/null 2>&1 || docker network create gurabot_monitoring
```
Start Prometheus, Loki, and Grafana:
```
docker compose --env-file .env -f monitoring/docker-compose.yml pull
docker compose --env-file .env -f monitoring/docker-compose.yml up -d --remove-orphans
```
The loki-init container exits after preparing Loki storage. An `Exited (0)` status for it is expected.

### 4. Start gurabot
Validate the configuration:
```
docker compose --profile prod config
```
Pull and start the production services:
```
docker compose --profile prod pull
docker compose --profile prod up -d --no-build --remove-orphans --wait
```
Check the status:
```
docker compose --profile prod ps
```

### 5. Updating
Check out the new release and update `APP_IMAGE_TAG`:
```
git fetch --tags
git checkout v1.0.1

// .env
APP_IMAGE_TAG=1.0.1
```
Pull and recreate the services:
```
docker compose --profile prod pull
docker compose --profile prod up -d --no-build --remove-orphans --wait
```

# Contributing
Contributions are welcome.
Contributors who are not yet familiar with the codebase are encouraged to begin with issues labeled `good first issue`.

Pull requests should clearly explain what was changed and why. Include screenshots when changing visible Discord messages, embeds, images, or components.
For questions about an implementation or the project structure, join the support server. Discussing larger changes before implementing them is recommended.

# Credits
gurabot relies on projects and services from the osu!, Discord, Node.js, .NET, PostgreSQL, Redis, Prisma, and wider open-source communities.
Special thanks to:
- [o!rdr](https://ordr.issou.best/) for replay rendering functionality.
- [osu!daily](https://osudaily.net/) for pp <-> rank convertation functionality.
- [osu!track](https://ameobea.me/osutrack/) for historic ranking data.
- everyone who has contributed code, testing, bug reports, suggestions, or provided other support.

# License
This project is available under the MIT License.
