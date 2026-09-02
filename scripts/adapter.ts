import fs from "fs";
import path from "path";
import axios from "axios";

import { SchemaEnum, SchemaField, SchemaModel, SchemaProvider } from "../adapter/builder";

const OUT_DIR = path.join(__dirname, "..", "generated", "adapter");
const PROVIDERS_DIR = path.join(__dirname, "..", "adapter", "providers");
const MODS_DIR = path.join(__dirname, "..", "adapter", "cache");

const MODS_URL = "https://raw.githubusercontent.com/ppy/osu-web/refs/heads/master/database/mods.json";

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, {
        recursive: true,
    });
}

function tsTypeFromField(field: SchemaField): string {
    switch (field.$type) {
        case "Enum":
            return field.$enumDef!.$name;
        default:
            return tsType(field.$type);
    }
}

function tsType(type: SchemaField["$type"]): string {
    switch (type) {
        case "Int":
        case "Float":
            return "number";
        case "String":
            return "string";
        case "Boolean":
            return "boolean";
        case "Date":
            return "Date";
        case "Mods":
            return "ParsedMod[]";
        case "Json":
            return "JsonValue";
        case "Model":
        case "Enum":
            throw new Error(`Field type "${type}" must be resolved separately`);
        default: {
            const exhaustive: never = type;
            throw new Error(`Unknown field type: ${exhaustive}`);
        }
    }
}

function fieldTypeSignature(field: SchemaField): string {
    let type = tsTypeFromField(field);

    if (field.$isArray) {
        type = `${type}[]`;
    }

    return type;
}

interface ProviderMetadata {
    id: string;
    file: string;
    exportName: string;
    provider: SchemaProvider;
}

interface GlobalEndpointArgument {
    types: Set<string>;
    presentInImplementations: number;
    requiredInImplementations: number;
}

interface GlobalEndpoint {
    implementationCount: number;
    implementationsWithArgs: number;
    returnTypes: Set<string>;
    arguments: Map<string, GlobalEndpointArgument>;
}

function endpointReturnType(endpoint: SchemaProvider["config"]["endpoints"][string]): string {
    const returns = endpoint.returns;

    if ("raw" in returns) {
        return "Uint8Array";
    }

    const model = "model" in returns ? returns.model.name : returns.name;
    const isArray = "isArray" in returns ? Boolean(returns.isArray) : false;

    return isArray ? `${model}[]` : model;
}

function buildEndpointArgumentsType(endpoint: GlobalEndpoint): string {
    if (endpoint.arguments.size === 0) {
        return "()";
    }

    const properties = Array.from(endpoint.arguments.entries())
        .map(([name, argument]) => {
            const optional =
                argument.presentInImplementations < endpoint.implementationCount ||
                argument.requiredInImplementations < endpoint.implementationCount;

            const type = Array.from(argument.types).join(" | ");

            return `${name}${optional ? "?" : ""}: ${type}`;
        })
        .join("; ");

    const argsObjectOptional = endpoint.implementationsWithArgs < endpoint.implementationCount;

    return `(args${argsObjectOptional ? "?" : ""}: { ${properties} })`;
}

function getAccountProviderID(provider: SchemaProvider): string {
    return provider.config.accountProvider ?? provider.id;
}

function adapterProviderMember(provider: SchemaProvider): string {
    return `AdapterProvider[${JSON.stringify(provider.config.name)}]`;
}

function generateDocComment(doc: string, indent = ""): string {
    const normalized = doc
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .join("\n")
        .replace(/\*\//g, "*\\/");

    const lines = normalized.split("\n");
    let output = `${indent}/**\n`;

    for (const line of lines) {
        output += `${indent} *${line ? ` ${line}` : ""}\n`;
    }

    output += `${indent} */\n`;
    return output;
}

async function generateProviders(): Promise<void> {
    const providersMeta: ProviderMetadata[] = [];
    const providers: SchemaProvider[] = [];

    const start = Date.now();

    if (!fs.existsSync(PROVIDERS_DIR)) {
        console.warn(`Providers directory not found at ${PROVIDERS_DIR}`);
    } else {
        const files = fs
            .readdirSync(PROVIDERS_DIR)
            .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
            .sort();

        for (const file of files) {
            const modulePath = path.join(PROVIDERS_DIR, file);

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const moduleExports = require(modulePath);

            for (const exportedKey of Object.keys(moduleExports)) {
                const exportedValue = moduleExports[exportedKey];

                if (!(exportedValue instanceof SchemaProvider)) {
                    continue;
                }

                providers.push(exportedValue);

                providersMeta.push({
                    id: exportedValue.id,
                    file: file.replace(/\.ts$/, ""),
                    exportName: exportedKey,
                    provider: exportedValue,
                });
            }
        }
    }

    const providersByID = new Map<string, ProviderMetadata>();

    for (const providerMeta of providersMeta) {
        if (providersByID.has(providerMeta.id)) {
            throw new Error(`Duplicate adapter provider ID "${providerMeta.id}".`);
        }

        providersByID.set(providerMeta.id, providerMeta);
    }

    for (const providerMeta of providersMeta) {
        const accountProviderID = getAccountProviderID(providerMeta.provider);

        if (!providersByID.has(accountProviderID)) {
            throw new Error(
                `Provider "${providerMeta.id}" references unknown ` + `account provider "${accountProviderID}".`,
            );
        }
    }

    const models = new Map<string, SchemaModel>();
    const enums = new Map<string, SchemaEnum>();

    function collectModelsDeep(model: SchemaModel): void {
        if (models.has(model.name)) {
            return;
        }

        models.set(model.name, model);

        for (const field of Object.values(model.fields)) {
            const nestedModel = field.$nestedModel;

            if (nestedModel) {
                collectModelsDeep(nestedModel);
            }

            if (field.$type === "Enum" && field.$enumDef) {
                enums.set(field.$enumDef.$name, field.$enumDef);
            }
        }
    }

    for (const provider of providers) {
        for (const endpoint of Object.values(provider.config.endpoints)) {
            const returns = endpoint.returns;

            if (!("raw" in returns)) {
                const model = "model" in returns ? returns.model : returns;
                collectModelsDeep(model);
            }

            if (!endpoint.args) {
                continue;
            }

            for (const argument of Object.values(endpoint.args)) {
                if (argument.$type === "Enum" && argument.$enumDef) {
                    enums.set(argument.$enumDef.$name, argument.$enumDef);
                }
            }
        }
    }

    const dependencies = new Map<string, Set<string>>();
    const dependents = new Map<string, Set<string>>();

    for (const name of models.keys()) {
        dependencies.set(name, new Set());
        dependents.set(name, new Set());
    }

    for (const model of models.values()) {
        for (const field of Object.values(model.fields)) {
            const nestedModel = field.$nestedModel;

            if (!nestedModel) {
                continue;
            }

            dependencies.get(model.name)!.add(nestedModel.name);
            dependents.get(nestedModel.name)!.add(model.name);
        }
    }

    const sortedModelNames: string[] = [];
    const queue: string[] = [];

    for (const [name, deps] of dependencies.entries()) {
        if (deps.size === 0) {
            queue.push(name);
        }
    }

    while (queue.length > 0) {
        const currentName = queue.shift()!;

        sortedModelNames.push(currentName);

        for (const dependentName of dependents.get(currentName) ?? []) {
            const dependentDependencies = dependencies.get(dependentName)!;

            dependentDependencies.delete(currentName);

            if (dependentDependencies.size === 0) {
                queue.push(dependentName);
            }
        }
    }

    if (sortedModelNames.length !== models.size) {
        const remaining = Array.from(models.keys()).filter((name) => !sortedModelNames.includes(name));

        console.warn(
            "\n⚠ WARNING: Circular dependency detected in models. " + "Resolving through deferred @Type callbacks.",
        );

        sortedModelNames.push(...remaining);
    }

    let outputTypeFile = `// AUTO-GENERATED - DO NOT EDIT MANUALLY, CHANGES WILL BE OVERWRITTEN
import "reflect-metadata";
import { Exclude, Expose, Type } from "class-transformer";

import type { AdapterHook } from "../../adapter/engine";
import type { ParsedMod } from "./mods";

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export type {
    AdapterErrorContext,
    AdapterHook,
    AdapterResponseContext,
} from "../../adapter/engine";

export {
    AdapterConfigurationError,
    AdapterEndpointNotImplementedError,
    AdapterError,
    AdapterRequestError,
} from "../../adapter/error";

export type {
    AdapterConfigurationErrorOptions,
    AdapterEndpointNotImplementedErrorOptions,
    AdapterRequestErrorKind,
    AdapterRequestErrorOptions,
} from "../../adapter/error";

`;

    for (const [name, enumDefinition] of enums.entries()) {
        outputTypeFile += `export enum ${name} {\n`;

        for (const [key, value] of Object.entries(enumDefinition.$values)) {
            const generatedValue = typeof value === "string" ? JSON.stringify(value) : value;

            outputTypeFile += `    ${key} = ${generatedValue},\n`;
        }

        outputTypeFile += `}\n\n`;
    }

    for (const name of sortedModelNames) {
        const model = models.get(name)!;

        outputTypeFile += `@Exclude()\n`;
        outputTypeFile += `export class ${name} {\n`;

        for (const [fieldName, field] of Object.entries(model.fields)) {
            const optional = field.$isOptional ? "?" : "";

            let generatedType: string;

            if (field.$type === "Model") {
                generatedType = `ReturnType<() => ${field.$nestedModel!.name}>`;
            } else {
                generatedType = tsTypeFromField(field);
            }

            if (field.$isArray) {
                generatedType = `Array<${generatedType}>`;
            }

            outputTypeFile += `    @Expose()\n`;

            if (field.$type === "Model") {
                outputTypeFile += `    @Type(() => ${field.$nestedModel!.name})\n`;
            } else if (field.$type === "Date") {
                outputTypeFile += `    @Type(() => Date)\n`;
            }

            outputTypeFile += `    declare ${fieldName}${optional}: ${generatedType};\n\n`;
        }

        outputTypeFile += `}\n\n`;
    }

    const globalEndpoints = new Map<string, GlobalEndpoint>();

    for (const provider of providers) {
        for (const [endpointName, endpoint] of Object.entries(provider.config.endpoints)) {
            let globalEndpoint = globalEndpoints.get(endpointName);

            if (!globalEndpoint) {
                globalEndpoint = {
                    implementationCount: 0,
                    implementationsWithArgs: 0,
                    returnTypes: new Set(),
                    arguments: new Map(),
                };

                globalEndpoints.set(endpointName, globalEndpoint);
            }

            globalEndpoint.implementationCount += 1;
            globalEndpoint.returnTypes.add(endpointReturnType(endpoint));

            if (!endpoint.args) {
                continue;
            }

            globalEndpoint.implementationsWithArgs += 1;

            for (const [argumentName, argumentField] of Object.entries(endpoint.args)) {
                let globalArgument = globalEndpoint.arguments.get(argumentName);

                if (!globalArgument) {
                    globalArgument = {
                        types: new Set(),
                        presentInImplementations: 0,
                        requiredInImplementations: 0,
                    };

                    globalEndpoint.arguments.set(argumentName, globalArgument);
                }

                globalArgument.types.add(fieldTypeSignature(argumentField));
                globalArgument.presentInImplementations += 1;

                if (!argumentField.$isOptional) {
                    globalArgument.requiredInImplementations += 1;
                }
            }
        }
    }

    const providerKeyType =
        providers.length > 0 ? providers.map((provider) => JSON.stringify(provider.id)).join(" | ") : "never";

    outputTypeFile += `export type ProviderKeys = ${providerKeyType};\n\n`;

    outputTypeFile += `export enum AdapterProvider {\n`;

    for (const provider of providers) {
        outputTypeFile += `    ${provider.config.name} = ${JSON.stringify(provider.id)},\n`;
    }

    outputTypeFile += `}\n\n`;

    for (const provider of providers) {
        outputTypeFile += `export interface ${provider.id}Client {\n`;
        outputTypeFile += `    $use: (hook: AdapterHook) => void;\n`;

        for (const [endpointName, globalEndpoint] of globalEndpoints.entries()) {
            const argsType = buildEndpointArgumentsType(globalEndpoint);
            const returnType = Array.from(globalEndpoint.returnTypes).join(" | ");

            const implementation = provider.config.endpoints[endpointName];
            if (implementation?.doc) {
                outputTypeFile += generateDocComment(implementation.doc, "    ");
            }

            outputTypeFile += `    ${endpointName}${argsType}: Promise<${returnType}>;\n`;
        }

        outputTypeFile += `}\n\n`;
    }

    outputTypeFile += `export interface Adapter {\n`;
    outputTypeFile += `    $use: (hook: AdapterHook) => void;\n`;

    for (const provider of providers) {
        outputTypeFile += `    ${provider.id}: ${provider.id}Client;\n`;
    }

    outputTypeFile += `}\n`;

    fs.writeFileSync(path.join(OUT_DIR, "types.ts"), outputTypeFile, {
        encoding: "utf8",
    });

    let outputClientFile = `// AUTO-GENERATED - DO NOT EDIT MANUALLY, CHANGES WILL BE OVERWRITTEN
import {
    AdapterEngine,
} from "../../adapter/engine";

import type {
    AdapterFieldCodecs,
    AdapterHook,
} from "../../adapter/engine";

import {
    type Adapter,
    AdapterProvider,
} from "./types";

import {
    ModUtils,
} from "./mods";

import {
    EApplicationError,
    Exception,
} from "@domain/core/Exception";
`;

    for (const providerMeta of providersMeta) {
        outputClientFile +=
            `import { ${providerMeta.exportName} } ` + `from "../../adapter/providers/${providerMeta.file}";\n`;
    }

    outputClientFile += `
const adapterFieldCodecs: AdapterFieldCodecs = {
    Mods: {
        toPlain: (value) =>
            ModUtils.toPlain(
                value as Parameters<typeof ModUtils.toPlain>[0],
            ),

        toInstance: (value) =>
            ModUtils.toInstance(value),
    },
};

export class AdapterClient implements Adapter {
    private readonly engines: AdapterEngine[] = [];
`;

    for (const providerMeta of providersMeta) {
        outputClientFile += `    public ${providerMeta.id}: Adapter["${providerMeta.id}"];\n`;
    }

    outputClientFile += `
    constructor() {
`;

    for (const providerMeta of providersMeta) {
        outputClientFile += `
        const ${providerMeta.id}Engine = new AdapterEngine(
            ${providerMeta.exportName}.config,
            adapterFieldCodecs,
        );

        this.engines.push(${providerMeta.id}Engine);

        this.${providerMeta.id} = {
            $use: (hook: AdapterHook): void =>
                ${providerMeta.id}Engine.addHook(hook),
`;

        for (const endpointName of globalEndpoints.keys()) {
            const endpoint = providerMeta.provider.config.endpoints[endpointName];

            if (endpoint) {
                outputClientFile += `
            ${endpointName}: async (args?: any) => {
                const data = await ${providerMeta.id}Engine.execute(
                    ${JSON.stringify(endpointName)},
                    args,
                );

                if (
                    data === undefined ||
                    data === null
                ) {
                    return null;
                }

                return data;
            },
`;
            } else {
                const message =
                    `[${providerMeta.provider.config.name}] ` + `Endpoint "${endpointName}" is not implemented.`;

                outputClientFile += `
            ${endpointName}: (_args?: any) =>
                Promise.reject(
                    new Exception(
                        EApplicationError.NOT_IMPLEMENTED,
                        ${JSON.stringify(message)},
                    ),
                ),
`;
            }
        }

        outputClientFile += `
        };
`;
    }

    outputClientFile += `
    }

    public $use(hook: AdapterHook): void {
        for (const engine of this.engines) {
            engine.addHook(hook);
        }
    }
}

export const LinkableAdapterProvider = {
`;

    const linkableProviderNames = new Set<string>();

    for (const providerMeta of providersMeta) {
        if (providerMeta.provider.config.linkable === false) {
            continue;
        }

        const providerName = providerMeta.provider.config.name;

        if (linkableProviderNames.has(providerName)) {
            throw new Error(
                `Duplicate linkable provider display name "${providerName}". ` +
                    `LinkableAdapterProvider keys must be unique.`,
            );
        }

        linkableProviderNames.add(providerName);

        outputClientFile +=
            `    ${JSON.stringify(providerName)}: ` + `${adapterProviderMember(providerMeta.provider)},\n`;
    }

    outputClientFile += `} as const;

export type LinkableAdapterProvider =
    (typeof LinkableAdapterProvider)[keyof typeof LinkableAdapterProvider];

export const ProviderMeta = {
`;

    for (const providerMeta of providersMeta) {
        const accountProviderID = getAccountProviderID(providerMeta.provider);
        const accountProviderMeta = providersByID.get(accountProviderID)!;

        const linkTargets = providersMeta.filter(
            (candidate) => getAccountProviderID(candidate.provider) === accountProviderID,
        );

        outputClientFile += `    ${JSON.stringify(providerMeta.id)}: {\n`;
        outputClientFile += `        id: ${JSON.stringify(providerMeta.id)},\n`;
        outputClientFile += `        name: ${JSON.stringify(providerMeta.provider.config.name)},\n`;
        outputClientFile += `        display: ${providerMeta.provider.config.display},\n`;
        outputClientFile += `        cache: ${providerMeta.provider.config.cache},\n`;
        outputClientFile += `        accountProvider: ` + `${adapterProviderMember(accountProviderMeta.provider)},\n`;

        outputClientFile += `        linkTargets: [\n`;

        for (const target of linkTargets) {
            outputClientFile += `            ${adapterProviderMember(target.provider)},\n`;
        }

        outputClientFile += `        ] as const,\n`;
        outputClientFile += `        linkable: ${providerMeta.provider.config.linkable ?? true},\n`;
        outputClientFile += `        formatters: ${providerMeta.exportName}.config.formatters,\n`;
        outputClientFile += `    },\n`;
    }

    outputClientFile += `} as const;\n`;

    fs.writeFileSync(path.join(OUT_DIR, "index.ts"), outputClientFile, {
        encoding: "utf8",
    });

    console.log(
        `\n✔ Generated Adapter Client to ` + `${path.relative(__dirname, OUT_DIR)} ` + `in ${Date.now() - start}ms\n`,
    );
}

async function generateMods(): Promise<void> {
    const modsPath = path.join(MODS_DIR, "mods.json");
    const noCache = process.argv.includes("--no-cache");
    const start = Date.now();

    let modsFile = `// AUTO-GENERATED - DO NOT EDIT MANUALLY, ` + `CHANGES WILL BE OVERWRITTEN\n\n`;

    let data: Array<any>;

    if (!fs.existsSync(modsPath) || noCache) {
        if (noCache) {
            console.log("--no-cache provided. Redownloading the mods.json file...");
        }

        const response = await axios.get<Array<any>>(MODS_URL);
        const raw = response.data;

        fs.mkdirSync(MODS_DIR, {
            recursive: true,
        });

        fs.writeFileSync(modsPath, JSON.stringify(raw), {
            encoding: "utf8",
        });

        data = raw;
    } else {
        data = JSON.parse(fs.readFileSync(modsPath, "utf8"));
    }

    const modMap = new Map<string, any>();
    const allModTypes = new Set<string>();

    for (const ruleset of data) {
        for (const mod of ruleset.Mods) {
            if (!modMap.has(mod.Acronym)) {
                modMap.set(mod.Acronym, mod);
            }

            if (mod.Type) {
                allModTypes.add(mod.Type);
            }
        }
    }

    modsFile +=
        `export type ModType = ` +
        `${Array.from(allModTypes)
            .map((type) => JSON.stringify(type))
            .join(" | ")} | "Unknown";\n\n`;

    const parsedModNames: string[] = [];

    for (const mod of modMap.values()) {
        const interfaceName = `Mod${mod.Acronym}`;

        parsedModNames.push(interfaceName);

        modsFile += `export interface ${interfaceName} {\n`;
        modsFile += `    acronym: ${JSON.stringify(mod.Acronym)};\n`;
        modsFile += `    name: ${JSON.stringify(mod.Name)};\n`;
        modsFile += `    type: ${JSON.stringify(mod.Type)};\n`;

        if (Array.isArray(mod.Settings) && mod.Settings.length > 0) {
            modsFile += `    settings?: {\n`;

            for (const setting of mod.Settings) {
                const settingType =
                    setting.Type === "number" ? "number" : setting.Type === "boolean" ? "boolean" : "string";

                modsFile += `        ${JSON.stringify(setting.Name)}?: ${settingType};\n`;
            }

            modsFile += `    };\n`;
        } else {
            modsFile += `    settings?: never;\n`;
        }

        modsFile += `}\n\n`;
    }

    modsFile += `export interface ModUnknown {
    acronym: string;
    name: string;
    type: "Unknown";
    settings?: Record<string, any>;
}

`;

    modsFile += `export type ParsedMod = ` + `${parsedModNames.join(" | ")} | ModUnknown;\n`;

    modsFile +=
        `export type KnownModAcronym = ` + `${parsedModNames.map((name) => `${name}["acronym"]`).join(" | ")};\n\n`;

    modsFile +=
        `const MOD_METADATA: Record<string, ` + `{ name: string; type: ModType; incompatibleWith: string[] }> = {\n`;

    for (const mod of modMap.values()) {
        const incompatibleMods = Array.isArray(mod.IncompatibleMods) ? JSON.stringify(mod.IncompatibleMods) : "[]";

        modsFile +=
            `    ${JSON.stringify(mod.Acronym)}: { ` +
            `name: ${JSON.stringify(mod.Name)}, ` +
            `type: ${JSON.stringify(mod.Type)}, ` +
            `incompatibleWith: ${incompatibleMods} ` +
            `},\n`;
    }

    modsFile += `};

`;

    modsFile += `const MOD_BITMASK: Record<number, string> = {
    1: "NF",
    2: "EZ",
    4: "TD",
    8: "HD",
    16: "HR",
    32: "SD",
    64: "DT",
    128: "RX",
    256: "HT",
    512: "NC",
    1024: "FL",
    2048: "Auto",
    4096: "SO",
    8192: "AP",
    16384: "PF",
    32768: "4K",
    65536: "5K",
    131072: "6K",
    262144: "7K",
    524288: "8K",
    1048576: "FI",
    2097152: "RD",
    4194304: "Cinema",
    8388608: "Target",
    16777216: "9K",
    33554432: "KeyCoop",
    67108864: "1K",
    134217728: "3K",
    268435456: "2K",
    536870912: "V2",
    1073741824: "MR",
};

`;

    modsFile += `export class ModUtils {
    static toInstance(data: unknown): Array<ParsedMod> {
        if (typeof data === "number" && Number.isFinite(data)) {
            return this.fromBits(data);
        }

        if (typeof data === "string" && /^\\d+$/.test(data)) {
            return this.fromBits(Number(data));
        }

        if (!Array.isArray(data)) {
            return [];
        }

        return data.map((value: unknown) => {
            const raw = typeof value === "string" ? { acronym: value } : value;
            if (!raw || typeof raw !== "object" || !("acronym" in raw)) {
                return {
                    acronym: String(value),
                    name: "Unknown",
                    type: "Unknown",
                } as ParsedMod;
            }

            const acronym = String(raw.acronym);
            const settings = "settings" in raw ? raw.settings : undefined;
            const metadata = MOD_METADATA[acronym] ?? {
                name: "Unknown",
                type: "Unknown",
                incompatibleWith: [],
            };

            return {
                acronym,
                name: metadata.name,
                type: metadata.type,
                settings,
            } as ParsedMod;
        });
    }

    static parse(data: unknown): Array<ParsedMod> {
        return this.toInstance(data);
    }

    static fromString(value: string): Array<ParsedMod> {
        const normalized = value.trim().toUpperCase();

        if (!normalized) {
            return [];
        }

        const knownAcronyms = Object.keys(MOD_METADATA).sort((a, b) => b.length - a.length);

        const acronyms: Array<string> = [];
        let offset = 0;

        while (offset < normalized.length) {
            const matched = knownAcronyms.find((acronym) => normalized.startsWith(acronym, offset));
            if (matched) {
                acronyms.push(matched);
                offset += matched.length;
                continue;
            }

            const remaining = normalized.length - offset;
            const length = Math.min(2, remaining);

            acronyms.push(normalized.slice(offset, offset + length));

            offset += length;
        }

        return this.parse(acronyms);
    }

    static fromBits(bits: number): Array<ParsedMod> {
        const acronyms: string[] = [];

        for (const [bit, acronym] of Object.entries(MOD_BITMASK)) {
            if ((bits & Number(bit)) !== 0) {
                acronyms.push(acronym);
            }
        }

        let filtered = acronyms;

        if (acronyms.includes("NC")) {
            filtered = filtered.filter((acronym) => acronym !== "DT");
        }

        if (acronyms.includes("PF")) {
            filtered = filtered.filter((acronym) => acronym !== "SD");
        }

        return this.parse(filtered);
    }

    static has(mods: Array<ParsedMod>, acronym: KnownModAcronym | string): boolean {
        return mods.some((mod) => mod.acronym === acronym);
    }

    static get<T extends KnownModAcronym>(
        mods: Array<ParsedMod>,
        acronym: T,
    ): Extract<ParsedMod, { acronym: T }> | undefined {
        return mods.find((mod) => mod.acronym === acronym) as Extract<ParsedMod, { acronym: T }> | undefined;
    }

    static filterByType(mods: Array<ParsedMod>, type: ModType): Array<ParsedMod> {
        return mods.filter((mod) => mod.type === type);
    }

    static difficultyReduction(mods: Array<ParsedMod>): Array<ParsedMod> {
        return this.filterByType(mods, "DifficultyReduction");
    }

    static difficultyIncrease(mods: Array<ParsedMod>): Array<ParsedMod> {
        return this.filterByType(mods, "DifficultyIncrease");
    }

    static automation(mods: Array<ParsedMod>): Array<ParsedMod> {
        return this.filterByType(mods, "Automation");
    }

    static conversion(mods: Array<ParsedMod>): Array<ParsedMod> {
        return this.filterByType(mods, "Conversion");
    }

    static fun(mods: Array<ParsedMod>): Array<ParsedMod> {
        return this.filterByType(mods, "Fun");
    }

    static isNoMod(value: string): boolean {
        return value.trim().toUpperCase() === "NM";
    }

    static performanceAffecting(mods: Array<ParsedMod>): Array<ParsedMod> {
        return mods.filter(
            (mod) =>
                mod.type === "DifficultyIncrease" ||
                mod.type === "DifficultyReduction" ||
                mod.type === "Conversion" ||
                mod.type === "Automation" ||
                mod.acronym === "TD" ||
                mod.acronym === "SO",
        );
    }

    static difficultyAffecting(mods: Array<ParsedMod>): Array<ParsedMod> {
        return mods.filter(
            (mod) =>
                mod.type === "DifficultyIncrease" ||
                mod.type === "DifficultyReduction" ||
                mod.type === "Conversion" ||
                mod.type === "Automation" ||
                mod.acronym === "TD",
        );
    }

    static clockRate(mods: Array<ParsedMod>): number {
        const doubleTime = this.get(mods, "DT");
        const nightcore = this.get(mods, "NC");

        if (doubleTime || nightcore) {
            return doubleTime?.settings?.speed_change ?? nightcore?.settings?.speed_change ?? 1.5;
        }

        const halfTime = this.get(mods, "HT");
        const daycore = this.get(mods, "DC");

        if (halfTime || daycore) {
            return halfTime?.settings?.speed_change ?? daycore?.settings?.speed_change ?? 0.75;
        }

        return 1;
    }

    static areIncompatible(first: KnownModAcronym | string, second: KnownModAcronym | string): boolean {
        if (first === second) {
            return false;
        }

        const firstIncompatible = MOD_METADATA[first]?.incompatibleWith ?? [];
        const secondIncompatible = MOD_METADATA[second]?.incompatibleWith ?? [];

        return firstIncompatible.includes(second) || secondIncompatible.includes(first);
    }

    static findIncompatibilities(mods: ReadonlyArray<ParsedMod>): Record<string, Array<string>> {
        const conflicts: Record<string, Array<string>> = {};

        if (mods.length < 2) {
            return conflicts;
        }

        const acronyms = new Set(mods.map((mod) => mod.acronym));

        for (const mod of mods) {
            const incompatible = MOD_METADATA[mod.acronym]?.incompatibleWith ?? [];
            const currentConflicts = [
                ...new Set(
                    incompatible.filter((acronym) => acronym !== mod.acronym && acronyms.has(acronym)),
                ),
            ];

            if (currentConflicts.length > 0) {
                conflicts[mod.acronym] = currentConflicts;
            }
        }

        return conflicts;
    }

    static incompatibilities(acronym: string): ReadonlyArray<string> {
        return MOD_METADATA[acronym]?.incompatibleWith ?? [];
    }

    static toPlain(mods: ReadonlyArray<ParsedMod> | undefined): Array<string> {
        if (!mods?.length) {
            return [];
        }

        return mods.map((mod) => mod.acronym);
    }
}
`;

    fs.writeFileSync(path.join(OUT_DIR, "mods.ts"), modsFile, {
        encoding: "utf8",
    });

    console.log(`\n✔ Generated Mods to ` + `${path.relative(__dirname, OUT_DIR)} ` + `in ${Date.now() - start}ms`);
}

async function generate(): Promise<void> {
    await generateMods();
    await generateProviders();
}

generate().catch((error: unknown) => {
    console.error("\n✖ Adapter generation failed.");

    if (error instanceof Error) {
        console.error(error.stack ?? error.message);
    } else {
        console.error(error);
    }

    process.exitCode = 1;
});
