import convict from "convict";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const config = convict({
    app: {
        name: {
            doc: "Name of the application.",
            format: String,
            default: "gurabot",
            env: "APP_NAME",
        },
        mode: {
            doc: "The application environment.",
            format: ["production", "development"],
            default: "development",
            env: "APP_MODE",
        },
        loglevel: {
            doc: "The application logging level.",
            format: String,
            default: "info",
            env: "APP_LOGLEVEL",
        },
        prefix: {
            doc: "The application prefix (for the bot).",
            format: String,
            default: "!",
            env: "APP_PREFIX",
        },
        is_cluster: {
            doc: "Whether the application is spawned as a cluster or not. Injected by the Cluster Manager.",
            format: Boolean,
            default: false,
            env: "APP_IS_CLUSTER",
        },
        cache: {
            doc: "Application folder for cache.",
            format: String,
            default: "cache",
            env: "APP_CACHE",
        },
        resources: {
            doc: "Application folder for resources.",
            format: String,
            default: "resources",
            env: "APP_RESOURCES",
        },
        domain: {
            doc: "Application domain",
            format: String,
            default: "https://gurabot.com",
            env: "APP_DOMAIN",
        },
        flagsDomain: {
            doc: "Application flags domain",
            format: String,
            default: "https://raw.githubusercontent.com/hitorisu39/flags-png/main/png256px/",
            env: "APP_FLAGS_DOMAIN",
        },
        supportServer: {
            doc: "Application Discord support server.",
            format: String,
            default: "https://discord.gg/Ed4yeNgWxj",
            env: "APP_SUPPORT_SERVER",
        },
        donate: {
            doc: "Application donate link.",
            format: String,
            default: "https://ko-fi.com/cornosu",
            env: "APP_DONATE",
        },
        invite: {
            doc: "Application invite link.",
            format: String,
            default:
                "https://discord.com/api/oauth2/authorize?client_id=777206490280755211&permissions=309238025216&scope=bot%20applications.commands",
            env: "APP_INVITE",
        },
    },
    database: {
        host: {
            doc: "PostgreSQL database host.",
            format: String,
            default: "localhost",
            env: "DATABASE_HOST",
        },
        user: {
            doc: "PostgreSQL database user.",
            format: String,
            default: "postgres",
            env: "DATABASE_USER",
        },
        password: {
            doc: "PostgreSQL database password.",
            format: String,
            default: "postgres",
            env: "DATABASE_PASSWORD",
        },
        name: {
            doc: "PostgreSQL database name.",
            format: String,
            default: "gurabot",
            env: "DATABASE_NAME",
        },
        port: {
            doc: "PostgreSQL database port.",
            format: Number,
            default: 5432,
            env: "DATABASE_PORT",
        },
        connection_limit: {
            doc: "PostgreSQL database connection limit.",
            format: Number,
            default: 10,
            env: "DATABASE_CONNECTION_LIMIT",
        },
    },
    redis: {
        host: {
            doc: "Redis host.",
            format: String,
            default: "127.0.0.1",
            env: "REDIS_HOST",
        },
        port: {
            doc: "Redis port.",
            format: Number,
            default: 6379,
            env: "REDIS_PORT",
        },
        password: {
            doc: "Redis password.",
            format: String,
            default: undefined,
            env: "REDIS_PASSWORD",
        },
        database: {
            doc: "Redis database number.",
            format: Number,
            default: 0,
            env: "REDIS_DATABASE",
        },
    },
    discord: {
        token: {
            doc: "Discord application token.",
            format: String,
            default: "",
            env: "DISCORD_TOKEN",
        },
        application_id: {
            doc: "Discord application ID.",
            format: Number,
            default: 0,
            env: "DISCORD_APPLICATION_ID",
        },
        cluster: {
            id: {
                doc: "Application cluster ID.",
                format: Number,
                default: 0,
                env: "DISCORD_CLUSTER_ID",
            },
            total: {
                doc: "Total clusters spawned.",
                format: Number,
                default: 1,
                env: "DISCORD_TOTAL_CLUSTERS",
            },
        },
        shards_per_cluster: {
            doc: "The amount of shards to spawn per cluster.",
            format: Number,
            default: 1,
            env: "DISCORD_SHARDS_PER_CLUSTER",
        },
        dev_id: {
            doc: "Discord bot developer ID.",
            format: String,
            default: "0",
            env: "DISCORD_DEV_ID",
        },
        status: {
            doc: "Discord bot status.",
            format: String,
            default: "!help",
            env: "DISCORD_STATUS"
        }
    },
    api: {
        host: {
            doc: "Backend API Service host.",
            format: String,
            default: "http://localhost:3000",
            env: "BACKEND_API_HOST",
        },
        secret: {
            doc: "Backend API Service secret.",
            format: String,
            default: "changeme",
            env: "BACKEND_API_SECRET",
        },
    },
    adapter: {
        osu: {
            client_id: {
                doc: "osu! Application client ID.",
                format: String,
                default: "",
                env: "OSU_CLIENT_ID",
            },
            client_secret: {
                doc: "osu! Application client secret.",
                format: String,
                default: "",
                env: "OSU_CLIENT_SECRET",
            },
            redirect_uri: {
                doc: "osu! Application rediect uri.",
                format: String,
                default: "http://localhost:3001/oauth/osu",
                env: "OSU_REDIRECT_URI",
            },
        },
    },
    calculator: {
        host: {
            doc: "Calculator gRPC host.",
            format: String,
            default: "localhost",
            env: "CALCULATOR_HOST",
        },
        port: {
            doc: "Calculator gRPC port.",
            format: Number,
            default: 5000,
            env: "CALCULATOR_PORT",
        },
    },
    prom: {
        port: {
            doc: "Prometheus HTTP metrics server port.",
            format: Number,
            default: 9090,
            env: "PROMETHEUS_PORT",
        },
    },
    loki: {
        enabled: {
            doc: "Loki status.",
            format: Boolean,
            default: false,
            env: "LOKI_ENABLED",
        },
        host: {
            doc: "Loki host.",
            format: String,
            default: "http://localhost:3100",
            env: "LOKI_HOST",
        },
    },
    web: {
        authPort: {
            doc: "Web Server auth port.",
            format: Number,
            default: 3001,
            env: "WEB_AUTH_PORT",
        },
    },
    ordr: {
        defaultSkin: {
            doc: "Default o!rdr skin.",
            format: String,
            default: "- a t m o s p h e r e -",
            env: "ORDR_DEFAULT_SKIN",
        },
        verificationKey: {
            doc: "o!rdr bot verification key.",
            format: String,
            default: "devmode_success",
            env: "ORDR_VERIFICATION_KEY",
        },
    },
});

config.validate({ allowed: "strict" });

export const getConfig = () => config.getProperties();
export type TConfig = ReturnType<typeof config.getProperties>;
