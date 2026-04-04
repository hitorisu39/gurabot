import { getConfig } from "./env";
import { Logger } from "./logger";
import path from "path";
import { AutoResharderManager, ClusterManager, HeartbeatManager, ReClusterManager } from "discord-hybrid-sharding";

const config = getConfig();
const logger = new Logger(config, { name: "Sharder" });

async function bootstrapSharder() {
    const boot = path.resolve(__dirname, "index.js");
    const isProduction = config.app.mode === "production";

    const manager = new ClusterManager(boot, {
        token: config.discord.token,
        totalShards: isProduction ? "auto" : 1,
        shardsPerClusters: config.discord.shards_per_cluster,
        mode: "process",
        respawn: true,
    });

    manager.extend(
        new ReClusterManager(),
        new HeartbeatManager({
            interval: 10000,
            maxMissedHeartbeats: 4,
        }),
        new AutoResharderManager({
            debug: true,
            ShardsPerCluster: "useManagerOption",
            MinGuildsPerShard: "auto",
            MaxGuildsPerShard: 2300,
            restartOptions: {
                restartMode: "gracefulSwitch",
            },
        }),
    );

    manager.on("clusterCreate", (cluster) => {
        cluster.env.DISCORD_TOTAL_CLUSTERS = manager.totalClusters.toString();
        cluster.env.DISCORD_CLUSTER_ID = cluster.id.toString();
        cluster.env.APP_IS_CLUSTER = "true";

        cluster.on("death", () => logger.warn(`Cluster ${cluster.id} died, respawning...`));
    });

    await manager.spawn({ timeout: -1 });
    return manager;
}

bootstrapSharder();
