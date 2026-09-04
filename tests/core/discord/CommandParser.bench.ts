import { bench, describe } from "vitest";
import { EInjectMode, EOptionType, IOptionMetadata } from "@/core/decorators";
import { CommandParser } from "@/core/discord/options/CommandParser";
import { CommandContext } from "@/core/discord/context/CommandContext";

function createContext(rawContent: string): CommandContext {
    return {
        isSlash: false,
        rawContent,
        state: {},
    } as unknown as CommandContext;
}

function option(
    data: Partial<IOptionMetadata> & Pick<IOptionMetadata, "propertyKey" | "name" | "type">,
): IOptionMetadata {
    return {
        ...data,
        description: data.description ?? "",
        required: data.required ?? false,
    };
}

class QueryDto {}

const queryProperties: ReadonlyArray<IOptionMetadata> = [
    option({
        propertyKey: "cs",
        name: "cs",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "ar",
        name: "ar",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "od",
        name: "od",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "length",
        name: "length",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "creator",
        name: "creator",
        type: EOptionType.String,
    }),
];

const simpleOptions: ReadonlyArray<IOptionMetadata> = [
    option({
        propertyKey: "name",
        name: "name",
        type: EOptionType.String,
        inject: EInjectMode.Greedy,
    }),
];

const realisticOptions: ReadonlyArray<IOptionMetadata> = [
    option({
        propertyKey: "name",
        name: "name",
        type: EOptionType.String,
        inject: EInjectMode.Greedy,
    }),
    option({
        propertyKey: "query",
        name: "query",
        type: EOptionType.Query,

        queryDto: QueryDto,
        queryProperties,
    }),
    option({
        propertyKey: "mods",
        name: "mods",
        type: EOptionType.Mods,
    }),
];

const topIfOptions: ReadonlyArray<IOptionMetadata> = [
    option({
        propertyKey: "name",
        name: "name",
        type: EOptionType.String,
        inject: EInjectMode.Greedy,
    }),
    option({
        propertyKey: "mods",
        name: "mods",
        type: EOptionType.ModsArray,
    }),
];

describe("CommandParser", () => {
    bench("simple username", async () => {
        await CommandParser.parseAndValidate(createContext("mrekk"), simpleOptions);
    });

    bench("quoted username", async () => {
        await CommandParser.parseAndValidate(createContext('"spaced username"'), simpleOptions);
    });

    bench("query example", async () => {
        await CommandParser.parseAndValidate(
            createContext("mrekk cs>=4 ar=10 od>=9.8 length>64 creator=sotarks +HD"),
            realisticOptions,
        );
    });

    bench("multiple mod operations", async () => {
        await CommandParser.parseAndValidate(createContext("mrekk +HD -HR! +DT +FL -EZ!"), topIfOptions);
    });
});
