import fs from "fs";
import path from "path";
import axios from "axios";
import { SchemaEnum, SchemaModel, SchemaProvider } from "../adapter/builder";

const OUT_DIR = path.join(__dirname, "..", "generated", "adapter");
const PROVIDERS_DIR = path.join(__dirname, "..", "adapter", "providers");
const MODS_DIR = path.join(__dirname, "..", "adapter", "cache");

const MODS_URL = "https://raw.githubusercontent.com/ppy/osu-web/refs/heads/master/database/mods.json";

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function tsTypeFromField(field: any) {
    switch (field.$type) {
        case "Enum":
            return field.$enumDef!.$name;
        default:
            return tsType(field.$type);
    }
}

function tsType(type: any) {
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
        default:
            return "any";
    }
}

async function generateProviders() {
    const providersMeta: Array<{ id: string; file: string; exportName: string; provider: SchemaProvider }> = [];
    const providers: Array<SchemaProvider> = [];
    const start = Date.now();

    if (fs.existsSync(PROVIDERS_DIR)) {
        const files = fs.readdirSync(PROVIDERS_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
        for (const file of files) {
            const mod = require(path.join(PROVIDERS_DIR, file));
            for (const exportedKey in mod) {
                if (mod[exportedKey] instanceof SchemaProvider) {
                    const provider = mod[exportedKey];
                    providers.push(provider);
                    providersMeta.push({
                        id: provider.id,
                        file: file.replace(".ts", ""),
                        exportName: exportedKey,
                        provider: provider,
                    });
                }
            }
        }
    } else {
        console.warn(`Providers directory not found at ${PROVIDERS_DIR}`);
    }

    const models = new Map<string, SchemaModel>();
    const enums = new Map<string, typeof SchemaEnum.prototype>();
    const fieldOptionality = new Map<string, Set<string>>();

    function collectModelsDeep(model: SchemaModel) {
        if (models.has(model.name)) return;

        models.set(model.name, model);

        Object.values(model.fields).forEach((f) => {
            if (f.$nestedModel) collectModelsDeep(f.$nestedModel);
            if (f.$type === "Enum" && f.$enumDef) enums.set(f.$enumDef.$name, f.$enumDef);
        });
    }

    providers.forEach((p) => {
        Object.values(p.config.endpoints).forEach((ep) => {
            const model = "model" in ep.returns ? ep.returns.model : ep.returns;
            collectModelsDeep(model);

            if (ep.args) {
                Object.values(ep.args).forEach((argField) => {
                    if (argField.$type === "Enum" && argField.$enumDef) {
                        enums.set(argField.$enumDef.$name, argField.$enumDef);
                    }
                });
            }

            if (!fieldOptionality.has(model.name)) fieldOptionality.set(model.name, new Set());
            const optionalSet = fieldOptionality.get(model.name)!;

            Object.entries(model.fields).forEach(([fieldName, field]) => {
                const mapConfig = ep.mapping[fieldName];
                let isMissing = false;
                let hasDefault = false;

                if (!mapConfig) {
                    isMissing = true;
                } else if (typeof mapConfig === "object") {
                    if (!mapConfig.path && mapConfig.default === undefined) isMissing = true;
                    if (mapConfig.default !== undefined) hasDefault = true;
                }

                if ((isMissing && !hasDefault) || field.$isOptional) optionalSet.add(fieldName);
            });
        });
    });

    const dependencies = new Map<string, Set<string>>();
    const dependents = new Map<string, Set<string>>();

    for (const name of models.keys()) {
        dependencies.set(name, new Set());
        dependents.set(name, new Set());
    }

    for (const model of models.values()) {
        for (const field of Object.values(model.fields)) {
            if (field.$nestedModel) {
                dependencies.get(model.name)!.add(field.$nestedModel.name);
                dependents.get(field.$nestedModel.name)!.add(model.name);
            }
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

        for (const dependentName of dependents.get(currentName)!) {
            dependencies.get(dependentName)!.delete(currentName);
            if (dependencies.get(dependentName)!.size === 0) {
                queue.push(dependentName);
            }
        }
    }

    if (sortedModelNames.length !== models.size) {
        const remaining = Array.from(models.keys()).filter((name) => !sortedModelNames.includes(name));
        console.warn("\n⚠ WARNING: Circular dependency detected in models. Resolving via TS hoisting.");
        sortedModelNames.push(...remaining);
    }

    let outputTypeFile = `// AUTO-GENERATED - DO NOT EDIT MANUALLY, CHANGES WILL BE OVERWRITTEN
import "reflect-metadata";
import { Exclude, Expose, Type } from "class-transformer";
import type { AdapterHook } from "../../adapter/engine";
import type { ParsedMod } from "./mods";

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

    enums.forEach((enumDef, name) => {
        outputTypeFile += `export enum ${name} {\n`;
        Object.entries(enumDef.$values).forEach(([k, v]) => {
            const val = typeof v === "string" ? `"${v}"` : v;
            outputTypeFile += `    ${k} = ${val},\n`;
        });
        outputTypeFile += `}\n\n`;
    });

    for (const name of sortedModelNames) {
        const model = models.get(name)!;
        outputTypeFile += `@Exclude()\nexport class ${name} {\n`;
        const optionalSet = fieldOptionality.get(name) || new Set();

        Object.entries(model.fields).forEach(([fieldName, field]) => {
            const optional = optionalSet.has(fieldName) ? "?" : "";

            let tsTypeStr = "";
            if (field.$type === "Model") {
                tsTypeStr = `ReturnType<() => ${field.$nestedModel!.name}>`;
            } else {
                tsTypeStr = tsTypeFromField(field);
            }

            if (field.$isArray) {
                tsTypeStr = `Array<${tsTypeStr}>`;
            }

            outputTypeFile += `    @Expose()\n`;

            if (field.$type === "Model") {
                outputTypeFile += `    @Type(() => ${field.$nestedModel!.name})\n`;
            } else if (field.$type === "Date") {
                outputTypeFile += `    @Type(() => Date)\n`;
            }

            outputTypeFile += `    declare ${fieldName}${optional}: ${tsTypeStr};\n\n`;
        });

        outputTypeFile += `}\n\n`;
    }

    const globalEndpoints = new Map<string, { argsT: string; returnT: string }>();

    providers.forEach((p) => {
        Object.entries(p.config.endpoints).forEach(([epName, ep]) => {
            if (!globalEndpoints.has(epName)) {
                const model = "model" in ep.returns ? ep.returns.model.name : ep.returns.name;
                const isArray = "isArray" in ep.returns ? ep.returns.isArray : false;
                const returnT = isArray ? `${model}[]` : model;

                let argsT = "()";
                if (ep.args) {
                    const argProps = Object.entries(ep.args)
                        .map(([k, v]) => {
                            const optional = v.$isOptional ? "?" : "";
                            let type = tsTypeFromField(v);
                            if (v.$isArray) type += "[]";
                            return `${k}${optional}: ${type}`;
                        })
                        .join(", ");
                    argsT = `(args: { ${argProps} })`;
                }
                globalEndpoints.set(epName, { argsT, returnT });
            }
        });
    });

    outputTypeFile += `export type ProviderKeys = ${providers.map((p) => `"${p.id}"`).join(" | ")};\n\n`;
    outputTypeFile += `export enum AdapterProvider {\n`;
    providers.forEach((p) => {
        outputTypeFile += `    ${p.config.name} = "${p.id}",\n`;
    });
    outputTypeFile += `}\n\n`;

    providers.forEach((p) => {
        outputTypeFile += `export interface ${p.id}Client {\n`;
        outputTypeFile += `    $use: (hook: AdapterHook) => void;\n`;

        globalEndpoints.forEach(({ argsT, returnT }, epName) => {
            outputTypeFile += `    ${epName}${argsT}: Promise<${returnT}>;\n`;
        });

        outputTypeFile += `}\n\n`;
    });

    outputTypeFile += `export interface Adapter {\n`;
    outputTypeFile += `    $use: (hook: AdapterHook) => void;\n`;

    providers.forEach((prov) => {
        outputTypeFile += `    ${prov.id}: ${prov.id}Client;\n`;
    });

    outputTypeFile += `}\n`;

    fs.writeFileSync(path.join(OUT_DIR, "types.ts"), outputTypeFile);

    let outputClientFile = `// AUTO-GENERATED - DO NOT EDIT MANUALLY, CHANGES WILL BE OVERWRITTEN
import {
    AdapterEngine,
    AdapterFieldCodecs,
    AdapterHook,
} from "../../adapter/engine";
import type { Adapter } from "./types";
import { ModUtils } from "./mods";
`;

    outputClientFile += `
const adapterFieldCodecs: AdapterFieldCodecs = {
    Mods: {
        toPlain: (value) => ModUtils.toPlain(value as Parameters<typeof ModUtils.toPlain>[0]),
        toInstance: (value) => ModUtils.toInstance(value),
    },
};
`;

    providersMeta.forEach((pm) => {
        outputClientFile += `import { ${pm.exportName} } from "../../adapter/providers/${pm.file}";\n`;
    });

    // outputClientFile += `import { Exception, EApplicationError } from "@domain/core/Exception";\n`;

    outputClientFile += `\nexport class AdapterClient implements Adapter {\n`;
    outputClientFile += `    private readonly engines: AdapterEngine[] = [];\n\n`;

    providersMeta.forEach((pm) => {
        outputClientFile += `    public ${pm.id}: Adapter['${pm.id}'];\n`;
    });

    outputClientFile += `\n    constructor() {\n`;

    providersMeta.forEach((pm) => {
        outputClientFile += `
        const ${pm.id}Engine = new AdapterEngine(${pm.exportName}.config, adapterFieldCodecs);
        this.engines.push(${pm.id}Engine);
        
        this.${pm.id} = {
            $use: (hook: AdapterHook) => ${pm.id}Engine.addHook(hook),\n`;

        globalEndpoints.forEach((_, epName) => {
            const ep = pm.provider.config.endpoints[epName];
            if (ep) {
                outputClientFile += `            ${epName}: async (args?: any) => {\n`;
                outputClientFile += `                const data = await ${pm.id}Engine.execute('${epName}', args);\n`;
                outputClientFile += `                if (!data) return null;\n`;
                outputClientFile += `                return data;\n`;
                outputClientFile += `            },\n`;
            } else {
                outputClientFile += `            ${epName}: () => Promise.reject(new Exception(EApplicationError.NOT_IMPLEMENTED, "[${pm.provider.config.name}] Endpoint \\"${epName}\\" is not implemented.")),\n`;
            }
        });

        outputClientFile += `       };\n`;
    });

    outputClientFile += `    }\n`;

    outputClientFile += `
    public $use(hook: AdapterHook): void {
        for (const engine of this.engines) {
            engine.addHook(hook);
        }
    }`;

    outputClientFile += `\n}\n`;

    outputClientFile += `\nexport const ProviderMeta = {\n`;
    providersMeta.forEach((pm) => {
        outputClientFile += `    "${pm.id}": {\n`;
        outputClientFile += `        id: "${pm.id}",\n`;
        outputClientFile += `        name: "${pm.provider.config.name}",\n`;
        outputClientFile += `        display: ${pm.provider.config.display},\n`;
        outputClientFile += `        cache: ${pm.provider.config.cache},\n`;
        outputClientFile += `        formatters: ${pm.exportName}.config.formatters\n`;
        outputClientFile += `    },\n`;
    });
    outputClientFile += `} as const;\n\n`;

    fs.writeFileSync(path.join(OUT_DIR, "index.ts"), outputClientFile);
    console.log(`\n✔ Generated Adapter Client to ${path.relative(__dirname, OUT_DIR)} in ${Date.now() - start}ms\n`);
}

async function generateMods() {
    const modsPath = path.join(MODS_DIR, "mods.json");
    const noCache = process.argv.includes("--no-cache");
    const start = Date.now();

    let modsFile = `// AUTO-GENERATED - DO NOT EDIT MANUALLY, CHANGES WILL BE OVERWRITTEN\n\n`;

    let data: Array<any>;
    if (!fs.existsSync(modsPath) || noCache) {
        if (noCache) console.log("--no-cache provided. Redownloading the mods.json file...");

        const response = await axios.get(MODS_URL);
        const raw = response.data;

        fs.mkdirSync(MODS_DIR, { recursive: true });
        fs.writeFileSync(modsPath, JSON.stringify(raw), { encoding: "utf8" });

        data = raw;
    } else {
        data = JSON.parse(fs.readFileSync(modsPath, "utf8"));
    }

    const modMap = new Map<string, any>();
    const allModTypes = new Set<string>();

    data.forEach((ruleset: any) => {
        ruleset.Mods.forEach((m: any) => {
            if (!modMap.has(m.Acronym)) modMap.set(m.Acronym, m);
            if (m.Type) allModTypes.add(m.Type);
        });
    });

    modsFile += `export type ModType = ${Array.from(allModTypes)
        .map((t) => `"${t}"`)
        .join(" | ")} | "Unknown";\n\n`;

    const parsedModNames: Array<string> = [];

    modMap.forEach((mod) => {
        const interfaceName = `Mod${mod.Acronym}`;
        parsedModNames.push(interfaceName);

        modsFile += `export interface ${interfaceName} {\n`;
        modsFile += `    acronym: "${mod.Acronym}";\n`;
        modsFile += `    name: "${mod.Name.replace(/'/g, "\\'")}";\n`;
        modsFile += `    type: "${mod.Type}";\n`;

        if (mod.Settings && mod.Settings.length > 0) {
            modsFile += `    settings?: {\n`;
            mod.Settings.forEach((s: any) => {
                const tsType = s.Type === "number" ? "number" : s.Type === "boolean" ? "boolean" : "string";
                modsFile += `        "${s.Name}"?: ${tsType};\n`;
            });
            modsFile += `    };\n`;
        } else {
            modsFile += `    settings?: never;\n`;
        }
        modsFile += `}\n\n`;
    });

    modsFile += `export interface ModUnknown {\n  acronym: string;\n  name: string;\n  type: 'Unknown';\n  settings?: Record<string, any>;\n}\n\n`;

    modsFile += `export type ParsedMod = ${parsedModNames.join(" | ")} | ModUnknown;\n`;
    modsFile += `export type KnownModAcronym = ${parsedModNames.map((n) => `${n}['acronym']`).join(" | ")};\n\n`;

    modsFile += `const MOD_METADATA: Record<string, { name: string, type: ModType, incompatibleWith: string[] }> = {\n`;
    modMap.forEach((mod) => {
        const incompact = mod.IncompatibleMods ? JSON.stringify(mod.IncompatibleMods) : "[]";
        modsFile += `    "${mod.Acronym}": { name: "${mod.Name.replace(/'/g, "\\'")}", type: "${mod.Type}", incompatibleWith: ${incompact} },\n`;
    });
    modsFile += `};\n\n`;

    modsFile += `const MOD_BITMASK: Record<number, string> = {
    1: "NF", 2: "EZ", 4: "TD", 8: "HD", 16: "HR", 32: "SD", 64: "DT", 128: "RX",
    256: "HT", 512: "NC", 1024: "FL", 2048: "Auto", 4096: "SO", 8192: "AP", 16384: "PF",
    32768: "4K", 65536: "5K", 131072: "6K", 262144: "7K", 524288: "8K", 1048576: "FI",
    2097152: "RD", 4194304: "Cinema", 8388608: "Target", 16777216: "9K", 33554432: "KeyCoop",
    67108864: "1K", 134217728: "3K", 268435456: "2K", 536870912: "V2", 1073741824: "MR"
};\n\n`;

    modsFile += `export class ModUtils {
    static toInstance(data: unknown): Array<ParsedMod> {
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
            const meta = MOD_METADATA[acronym] ?? {
                name: "Unknown",
                type: "Unknown",
            };

            return {
                acronym,
                name: meta.name,
                type: meta.type,
                settings,
            } as ParsedMod;
        });
    }

    static parse(data: unknown): Array<ParsedMod> {
        return this.toInstance(data);
    }

    static fromString(str: string): Array<ParsedMod> {
        if (!str) return [];
        const acronyms = str.match(/.{1,2}/g) || [];
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
        if (acronyms.includes("NC")) filtered = filtered.filter(a => a !== "DT");
        if (acronyms.includes("PF")) filtered = filtered.filter(a => a !== "SD");

        return this.parse(filtered);
    }

    static has(mods: Array<ParsedMod>, acronym: KnownModAcronym | string): boolean {
        return mods.some((m) => m.acronym === acronym);
    }

    static get<T extends KnownModAcronym>(mods: Array<ParsedMod>, acronym: T): Extract<ParsedMod, { acronym: T }> | undefined {
        return mods.find((m) => m.acronym === acronym) as Extract<ParsedMod, { acronym: T }> | undefined;
    }

    static filterByType(mods: Array<ParsedMod>, type: ModType): Array<ParsedMod> {
        return mods.filter((m) => m.type === type);
    }

    static difficultyReduction(mods: Array<ParsedMod>): Array<ParsedMod> { return this.filterByType(mods, "DifficultyReduction"); }
    static difficultyIncrease(mods: Array<ParsedMod>): Array<ParsedMod> { return this.filterByType(mods, "DifficultyIncrease"); }
    static automation(mods: Array<ParsedMod>): Array<ParsedMod> { return this.filterByType(mods, "Automation"); }
    static conversion(mods: Array<ParsedMod>): Array<ParsedMod> { return this.filterByType(mods, "Conversion"); }
    static fun(mods: Array<ParsedMod>): Array<ParsedMod> { return this.filterByType(mods, "Fun"); }

    static performanceAffecting(mods: Array<ParsedMod>): Array<ParsedMod> {
        return mods.filter((m) => 
            m.type === "DifficultyIncrease" || 
            m.type === "DifficultyReduction" ||
            m.type === "Conversion" ||
            m.type === "Automation" ||
            m.acronym === "TD" ||
            m.acronym === "SO"
        );
    }

    static difficultyAffecting(mods: Array<ParsedMod>): Array<ParsedMod> {
        return mods.filter((m) => 
            m.type === "DifficultyIncrease" || 
            m.type === "DifficultyReduction" ||
            m.type === "Conversion" ||
            m.type === "Automation" ||
            m.acronym === "TD"
        );
    }

    static clockRate(mods: Array<ParsedMod>): number {
        const dt = this.get(mods, "DT");
        const nc = this.get(mods, "NC");
        if (dt || nc) return (dt?.settings?.speed_change || nc?.settings?.speed_change || 1.5);

        const ht = this.get(mods, "HT");
        const dc = this.get(mods, "DC");
        if (ht || dc) return (ht?.settings?.speed_change || dc?.settings?.speed_change || 0.75);

        return 1.0;
    }

    static findIncompatibilities(mods: Array<ParsedMod>): Record<string, Array<string>> {
        const conflicts: Record<string, Array<string>> = {};

        if (mods.length < 2) return conflicts;

        const acronyms = new Set(mods.map((mod) => mod.acronym));

        for (const mod of mods) {
            const incompatible = MOD_METADATA[mod.acronym]?.incompatibleWith ?? [];

            const currentConflicts = [
                ...new Set(
                    incompatible.filter(
                        (acronym) =>
                            acronym !== mod.acronym &&
                            acronyms.has(acronym),
                    ),
                ),
            ];

            if (currentConflicts.length > 0) {
                conflicts[mod.acronym] = currentConflicts;
            }
        }

        return conflicts;
    }

    static toPlain(mods: ReadonlyArray<ParsedMod> | undefined): Array<string> {
        if (!mods?.length) {
            return [];
        }

        return mods.map((mod) => mod.acronym);
    }
}\n`;

    fs.writeFileSync(path.join(OUT_DIR, "mods.ts"), modsFile);
    console.log(`\n✔ Generated Mods to ${path.relative(__dirname, OUT_DIR)} in ${Date.now() - start}ms`);
}

async function generate() {
    await generateMods();
    await generateProviders();
}

generate();
