import { Client } from "@/core/discord/Client";
import { TConfig } from "@/env";
import { Logger } from "@/logger";

import { PrismaClient } from "@generated/prisma/client";
import { Dispatcher } from "./dispatcher";
import { Cache } from "@/cache";
import { AdapterClient } from "@generated/adapter/index";
import { Calculator } from "@/calculator";
import { Metrics } from "@/metrics";

export type TConstructor<T> = new (...args: any[]) => T;
export type TObjectKeys<T> = { [K in keyof T]: T[K] extends object ? K : never }[keyof T];

export type TDiscordClient = Client;
export type TLogger = Logger;
export type TDispatcher = Dispatcher;
export type TAdapter = AdapterClient;
export type TCalculator = Calculator;
export type TMetrics = Metrics;

export type TServiceRepository = Omit<PrismaClient, "$connect" | "$disconnect">;
export type TRepository = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
export type TCache = Omit<Cache, "connect" | "disconnect">;

export interface IApplicationContext {
    config: TConfig;
    discord: TDiscordClient;
    logger: TLogger;
    repository: TServiceRepository;
    dispatcher: TDispatcher;
    cache: TCache;
    adapter: TAdapter;
    calculator: TCalculator;
    metrics: TMetrics;
}
