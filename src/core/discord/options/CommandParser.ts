import { EInjectMode, EOptionType, IOptionMetadata, Trace } from "@/core/decorators";
import { CommandContext } from "../context/CommandContext";
import { MessageContext } from "../context/MessageContext";
import { SlashContext } from "../context/SlashContext";
import { ApplicationCommandOptionType, Attachment } from "discord.js";
import { METAKEY_COMMAND_PROPERTIES } from "@/core/metakeys";
import {
    CommandOption,
    EModMatchType,
    ICommandDateRange,
    ICommandMods,
    ICommandQueryData,
    ICommandRange,
} from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";

/**
 * The class responsible for parsing command options.
 */
export class CommandParser {
    @Trace()
    public static async parseAndValidate(
        ctx: CommandContext,
        optionsMeta: Array<IOptionMetadata>,
        internalState?: {
            prefixMap: Map<string, string>;
            rawContent: string;
        },
    ): Promise<Record<string, CommandOption<any>>> {
        const parsedData: Record<string, CommandOption<any>> = {};
        const prefixMap = internalState?.prefixMap ?? new Map<string, string>();

        let injectedContent = internalState?.rawContent ?? "";
        let extractedMods: string | null = null;

        if (!internalState && !ctx.isSlash) {
            const messageContext = ctx as MessageContext;
            let content = messageContext.rawContent;

            const modsRegex = /(?:^|\s)([+-][a-zA-Z]{2,}!?)(?=\s|$)/;
            const modMatch = content.match(modsRegex);

            if (modMatch) {
                extractedMods = modMatch[1]!;
                content = content.replace(modsRegex, " ").trim();
            }

            injectedContent = this.extractKeyValuePairs(content, prefixMap);
        }

        const injectedValues = ctx.isSlash
            ? new Map<string, string>()
            : this.distributeInjectedContent(optionsMeta, injectedContent, prefixMap);

        for (const meta of optionsMeta) {
            let rawValue: any = null;

            if (meta.isInlineIndex && ctx.state.inlineIndex !== undefined) {
                rawValue = ctx.state.inlineIndex;
            } else if (meta.type === EOptionType.Mods) {
                if (ctx.isSlash) {
                    rawValue = (ctx as SlashContext).interaction.options.getString(meta.name);
                } else {
                    rawValue = extractedMods ?? this.getOptionValue(meta, prefixMap);
                }
            } else if (meta.type === EOptionType.Attachment) {
                if (ctx.isSlash) {
                    rawValue = (ctx as SlashContext).interaction.options.getAttachment(meta.name);
                } else {
                    rawValue = (ctx as MessageContext).message.attachments.first() ?? null;
                }
            } else if (meta.type === EOptionType.Query) {
                if (ctx.isSlash) {
                    rawValue = (ctx as SlashContext).interaction.options.getString(meta.name);
                } else {
                    const explicitValue = this.getOptionValue(meta, prefixMap);
                    if (explicitValue !== undefined) {
                        rawValue = explicitValue;
                    } else if (
                        meta.inject === EInjectMode.Greedy &&
                        (injectedContent.length > 0 || prefixMap.size > 0)
                    ) {
                        rawValue = injectedContent;
                    } else if (prefixMap.size > 0) {
                        /*
                         * An empty query still needs to be parsed when there are
                         * top-level key/value filters, such as:
                         *
                         * top cs>=4 ar=10
                         */
                        rawValue = "";
                    } else {
                        rawValue = null;
                    }
                }
            } else if (meta.inject !== undefined && !ctx.isSlash) {
                const explicitValue = this.getOptionValue(meta, prefixMap);
                rawValue = explicitValue ?? injectedValues.get(meta.propertyKey) ?? null;
            } else if (ctx.isSlash && !internalState) {
                const slashCtx = ctx as SlashContext;

                if (meta.type === EOptionType.User) {
                    rawValue = slashCtx.interaction.options.getUser(meta.name);
                } else {
                    rawValue = slashCtx.interaction.options.get(meta.name)?.value;
                }
            } else {
                rawValue = this.getOptionValue(meta, prefixMap);
            }

            if ((rawValue === null || rawValue === undefined || rawValue === "") && meta.required) {
                throw new Exception(EApplicationError.INPUT_ERROR, `Option \`${meta.name}\` is required.`);
            }

            if (rawValue === null || rawValue === undefined || (rawValue === "" && meta.type !== EOptionType.Query)) {
                parsedData[meta.propertyKey] = new CommandOption(null);
                continue;
            }

            const finalValue = await this.validateType(meta, rawValue, ctx, prefixMap);

            parsedData[meta.propertyKey] = new CommandOption(finalValue);
        }

        return parsedData;
    }

    private static distributeInjectedContent(
        optionsMeta: Array<IOptionMetadata>,
        content: string,
        prefixMap: Map<string, string>,
    ): Map<string, string> {
        const result = new Map<string, string>();
        if (!content) {
            return result;
        }

        const injected = optionsMeta.filter(
            (meta) =>
                meta.inject !== undefined && meta.type !== EOptionType.Query && !this.hasOptionValue(meta, prefixMap),
        );
        if (!injected.length) {
            return result;
        }

        const tokens = content.split(/\s+/).filter(Boolean);
        const matchOptions = injected.filter((meta) => meta.inject === EInjectMode.Match);

        for (const meta of matchOptions) {
            if (!meta.injectMatcher) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Matched injected option \`${meta.name}\` has no matcher.`,
                );
            }

            const tokenIndex = tokens.findIndex((token) => meta.injectMatcher!(token));
            if (tokenIndex === -1) {
                continue;
            }

            const [token] = tokens.splice(tokenIndex, 1);
            result.set(meta.propertyKey, token!);
        }

        const tokenOptions = injected.filter((meta) => meta.inject === EInjectMode.Token);
        for (const meta of tokenOptions) {
            const token = tokens.shift();

            if (token === undefined) {
                break;
            }

            result.set(meta.propertyKey, token);
        }

        const greedyOptions = injected.filter((meta) => meta.inject === EInjectMode.Greedy);
        if (greedyOptions.length > 1) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "A command cannot have multiple unresolved greedy injected options.",
            );
        }

        const greedyOption = greedyOptions[0];
        if (greedyOption && tokens.length > 0) {
            result.set(greedyOption.propertyKey, tokens.join(" "));
        }

        return result;
    }

    private static getOptionKeys(meta: IOptionMetadata): string[] {
        return [meta.name.toLowerCase(), ...(meta.aliases ?? []).map((alias) => alias.toLowerCase())];
    }

    private static getOptionValue(meta: IOptionMetadata, prefixMap: Map<string, string>): string | undefined {
        for (const key of this.getOptionKeys(meta)) {
            const value = prefixMap.get(key);

            if (value !== undefined) {
                return value;
            }
        }

        return undefined;
    }

    private static hasOptionValue(meta: IOptionMetadata, prefixMap: Map<string, string>): boolean {
        return this.getOptionKeys(meta).some((key) => prefixMap.has(key));
    }

    private static async validateType(
        meta: IOptionMetadata,
        value: any,
        ctx: CommandContext,
        prefixMap: Map<string, string>,
    ): Promise<any> {
        if (meta.type === EOptionType.Attachment) {
            if (
                !value ||
                typeof value.name !== "string" ||
                typeof value.url !== "string" ||
                typeof value.size !== "number"
            ) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `Option \`${meta.name}\` must be a valid attachment.`,
                );
            }

            return value as Attachment;
        }

        const strVal = String(value).trim();

        if (meta.type === EOptionType.Mods) {
            return this.parseMods(strVal);
        }

        if (meta.type === EOptionType.Query) {
            return this.parseQueryDto(meta, strVal, ctx, prefixMap);
        }

        switch (meta.type) {
            case EOptionType.User: {
                const match = strVal.match(/^<@!?(\d+)>$/) || strVal.match(/^(\d+)$/);

                if (!match) {
                    throw new Exception(
                        EApplicationError.INPUT_ERROR,
                        `Option \`${meta.name}\` must be a valid user mention or ID.`,
                    );
                }

                const userID = match[1]!;

                try {
                    return await ctx.author.client.users.fetch(userID);
                } catch {
                    throw new Exception(
                        EApplicationError.INPUT_ERROR,
                        `Could not find a user with the ID \`${userID}\` for option \`${meta.name}\`.`,
                    );
                }
            }

            case EOptionType.Date:
                return this.parseDate(meta.name, strVal);

            case EOptionType.DateRange:
                return this.parseDateRange(meta.name, strVal);

            case EOptionType.String: {
                if (meta.min !== undefined && strVal.length < meta.min) {
                    throw new Exception(
                        EApplicationError.INPUT_ERROR,
                        `Option \`${meta.name}\` must be at least ${meta.min} characters.`,
                    );
                }

                if (meta.max !== undefined && strVal.length > meta.max) {
                    throw new Exception(
                        EApplicationError.INPUT_ERROR,
                        `Option \`${meta.name}\` must be at most ${meta.max} characters.`,
                    );
                }

                return strVal;
            }

            case EOptionType.Number:
            case EOptionType.Integer: {
                const numVal = Number(value);

                if (Number.isNaN(numVal)) {
                    throw new Exception(
                        EApplicationError.INPUT_ERROR,
                        `Option \`${meta.name}\` must be a valid number.`,
                    );
                }

                if (meta.type === EOptionType.Integer && !Number.isInteger(numVal)) {
                    throw new Exception(EApplicationError.INPUT_ERROR, `Option \`${meta.name}\` must be an integer.`);
                }

                if (meta.min !== undefined && numVal < meta.min) {
                    throw new Exception(
                        EApplicationError.INPUT_ERROR,
                        `Option \`${meta.name}\` must be at least ${meta.min}.`,
                    );
                }

                if (meta.max !== undefined && numVal > meta.max) {
                    throw new Exception(
                        EApplicationError.INPUT_ERROR,
                        `Option \`${meta.name}\` must be at most ${meta.max}.`,
                    );
                }

                return numVal;
            }

            case EOptionType.Enum: {
                const validValues = Object.values(meta.enumData);

                const matchedValue = validValues.find(
                    (enumValue: any) => String(enumValue).toLowerCase() === strVal.toLowerCase(),
                );

                if (matchedValue === undefined) {
                    throw new Exception(
                        EApplicationError.INPUT_ERROR,
                        `Option \`${meta.name}\` must be one of: ${validValues.join(", ")}`,
                    );
                }

                return matchedValue;
            }

            case EOptionType.Range:
                return this.parseRange(meta.name, strVal);

            case EOptionType.Boolean: {
                const lowerVal = strVal.toLowerCase();

                if (["true", "yes", "1", "y", "t"].includes(lowerVal)) {
                    return true;
                }

                if (["false", "no", "0", "n", "f"].includes(lowerVal)) {
                    return false;
                }

                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `Option \`${meta.name}\` must be a boolean (true/false).`,
                );
            }

            default:
                return strVal;
        }
    }

    private static parseMods(input: string): ICommandMods {
        input = input.toUpperCase();

        let type = EModMatchType.Include;

        if (input.startsWith("+") && input.endsWith("!")) {
            type = EModMatchType.Match;
        } else if (input.startsWith("-") && input.endsWith("!")) {
            type = EModMatchType.Exclude;
        } else if (input.startsWith("+")) {
            type = EModMatchType.Include;
        } else {
            type = input.endsWith("!") ? EModMatchType.Match : EModMatchType.Include;
        }

        const mods = input.replace(/[+!-]/g, "");

        if (!mods || mods.length % 2 !== 0) {
            throw new Exception(EApplicationError.INPUT_ERROR, `Invalid mod combination: \`${input}\``);
        }

        return { type, mods };
    }

    private static async parseQueryDto(
        meta: IOptionMetadata,
        stringContent: string,
        ctx: CommandContext,
        globalPrefixMap: Map<string, string>,
    ): Promise<ICommandQueryData<any>> {
        const dtoClass = meta.queryDto;

        const properties: Array<IOptionMetadata> =
            Reflect.getMetadata(METAKEY_COMMAND_PROPERTIES, dtoClass.prototype) ?? [];

        let queryPrefixMap = new Map<string, string>();
        let cleanedContent = stringContent;

        const hasExplicitQuery = this.hasOptionValue(meta, globalPrefixMap);

        if (ctx.isSlash) {
            cleanedContent = this.extractKeyValuePairs(cleanedContent, queryPrefixMap);
        } else if (hasExplicitQuery) {
            cleanedContent = this.extractKeyValuePairs(cleanedContent, queryPrefixMap);
        } else {
            queryPrefixMap = globalPrefixMap;
            cleanedContent = meta.inject === EInjectMode.Greedy ? stringContent : "";
        }

        const parsedDtoFields = await this.parseAndValidate(ctx, properties, {
            prefixMap: queryPrefixMap,
            rawContent: cleanedContent,
        });

        const dtoInstance = new dtoClass();
        for (const [key, value] of Object.entries(parsedDtoFields)) {
            dtoInstance[key] = value;
        }

        return {
            data: dtoInstance,
            cleanedContent,
        };
    }

    private static parseDate(name: string, input: string): Date {
        const date = new Date(input);

        if (Number.isNaN(date.getTime())) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `Option \`${name}\` must be a valid date (e.g., YYYY-MM-DD).`,
            );
        }

        return date;
    }

    private static parseDateRange(name: string, input: string): ICommandDateRange {
        const rangeObj: ICommandDateRange = {
            minInclusive: false,
            maxInclusive: false,
        };

        /*
         * Operators:
         *
         * >2023-01-01
         * >=2023-01-01
         * <2023-01-01
         * <=2023-01-01
         */
        const operatorMatch = input.match(/^([<>]=?)(.+)$/);

        if (operatorMatch) {
            const operator = operatorMatch[1]!;
            const dateVal = this.parseDate(name, operatorMatch[2]!.trim());

            if (operator === ">") {
                rangeObj.min = dateVal;
            } else if (operator === ">=") {
                rangeObj.min = dateVal;
                rangeObj.minInclusive = true;
            } else if (operator === "<") {
                rangeObj.max = dateVal;
            } else if (operator === "<=") {
                rangeObj.max = dateVal;
                rangeObj.maxInclusive = true;
            }

            return rangeObj;
        }

        /*
         * Split ranges:
         *
         * 2023-01-01..2023-12-31
         * 2023-01-01 / 2023-12-31
         * 2023-01-01 to 2023-12-31
         */
        const splitMatch = input.split(/(?:\.\.|\/|\s+to\s+)/i);

        if (splitMatch.length === 2) {
            rangeObj.min = this.parseDate(name, splitMatch[0]!.trim());
            rangeObj.max = this.parseDate(name, splitMatch[1]!.trim());
            rangeObj.minInclusive = true;
            rangeObj.maxInclusive = true;

            return rangeObj;
        }

        const exactDate = this.parseDate(name, input);

        return {
            min: exactDate,
            max: exactDate,
            minInclusive: true,
            maxInclusive: true,
            exact: exactDate,
        };
    }

    private static parseRange(name: string, input: string): ICommandRange {
        const rangeObj: ICommandRange = {
            min: -Infinity,
            max: Infinity,
            minInclusive: false,
            maxInclusive: false,
        };

        /*
         * Exact value:
         *
         * 5
         * 5.5
         */
        if (/^\d+(?:\.\d+)?$/.test(input)) {
            const value = Number(input);

            return {
                min: value,
                max: value,
                minInclusive: true,
                maxInclusive: true,
                exact: value,
            };
        }

        /*
         * Dash range:
         *
         * 1-6
         * 1.5-6.5
         */
        const dashMatch = input.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);

        if (dashMatch) {
            rangeObj.min = Number(dashMatch[1]);
            rangeObj.max = Number(dashMatch[2]);
            rangeObj.minInclusive = true;
            rangeObj.maxInclusive = true;

            return rangeObj;
        }

        /*
         * Operator range:
         *
         * >5
         * >=5
         * <10
         * <=10
         */
        const operatorMatch = input.match(/^([<>]=?)(\d+(?:\.\d+)?)$/);

        if (operatorMatch) {
            const operator = operatorMatch[1]!;
            const value = Number(operatorMatch[2]);

            if (operator === ">") {
                rangeObj.min = value;
            } else if (operator === ">=") {
                rangeObj.min = value;
                rangeObj.minInclusive = true;
            } else if (operator === "<") {
                rangeObj.max = value;
            } else if (operator === "<=") {
                rangeObj.max = value;
                rangeObj.maxInclusive = true;
            }

            return rangeObj;
        }

        throw new Exception(
            EApplicationError.INPUT_ERROR,
            `Option \`${name}\` is not a valid range. Valid examples: 1-6, >5, <=10`,
        );
    }

    public static mapToDiscordOption(meta: IOptionMetadata): any {
        const base = {
            name: meta.name.toLowerCase(),
            description: meta.description,
            required: meta.required,
        };

        if (meta.type === EOptionType.User) {
            return {
                ...base,
                type: ApplicationCommandOptionType.User,
            };
        }

        if (
            meta.type === EOptionType.String ||
            meta.type === EOptionType.Range ||
            meta.type === EOptionType.Date ||
            meta.type === EOptionType.DateRange
        ) {
            return {
                ...base,
                type: ApplicationCommandOptionType.String,
            };
        }

        if (meta.type === EOptionType.Integer) {
            return {
                ...base,
                type: ApplicationCommandOptionType.Integer,
                minValue: meta.min,
                maxValue: meta.max,
            };
        }

        if (meta.type === EOptionType.Number) {
            return {
                ...base,
                type: ApplicationCommandOptionType.Number,
                minValue: meta.min,
                maxValue: meta.max,
            };
        }

        if (meta.type === EOptionType.Enum) {
            return {
                ...base,
                type: ApplicationCommandOptionType.String,
                choices: Object.entries(meta.enumData).map(([name, value]) => ({
                    name,
                    value: String(value),
                })),
            };
        }

        if (meta.type === EOptionType.Boolean) {
            return {
                ...base,
                type: ApplicationCommandOptionType.Boolean,
            };
        }

        if (meta.type === EOptionType.Attachment) {
            return {
                ...base,
                type: ApplicationCommandOptionType.Attachment,
            };
        }

        return {
            ...base,
            type: ApplicationCommandOptionType.String,
        };
    }

    private static extractKeyValuePairs(content: string, prefixMap: Map<string, string>): string {
        const kvRegex = /([a-zA-Z0-9_]+)([=><]+|:(?!\/\/))(?:"([^"]+)"|([^\s]+))/g;

        let match: RegExpExecArray | null;

        while ((match = kvRegex.exec(content)) !== null) {
            const key = match[1]!.toLowerCase();
            const operator = match[2]!;
            let value = match[3] !== undefined ? match[3] : match[4]!;

            if (!["=", ":", "=="].includes(operator)) {
                value = operator + value;
            }

            prefixMap.set(key, value);
        }

        return content.replace(kvRegex, "").replace(/\s+/g, " ").trim();
    }
}
