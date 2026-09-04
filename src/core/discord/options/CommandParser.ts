import { EInjectMode, EOptionType, IOptionMetadata, Trace } from "@/core/decorators";
import { CommandContext } from "../context/CommandContext";
import { MessageContext } from "../context/MessageContext";
import { SlashContext } from "../context/SlashContext";
import { ApplicationCommandOptionType, Attachment } from "discord.js";
import {
    CommandOption,
    EModMatchType,
    ICommandDateRange,
    ICommandMods,
    ICommandQueryData,
    ICommandRange,
} from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";

interface ICommandToken {
    /**
     * Original token, preserving quotes and escapes.
     *
     * Example:
     *   query="hatsune miku"
     */
    raw: string;

    /**
     * Decoded token value.
     *
     * Example:
     *   query=hatsune miku
     */
    value: string;

    /**
     * Whether the whole token started as a quoted value.
     *
     * `"hatsune miku cs=4"` => true
     * `query="hatsune miku"` => false
     */
    startsQuoted: boolean;

    /**
     * Whether quotes occurred anywhere in this token.
     */
    hadQuotes: boolean;
}

/**
 * The class responsible for parsing command options.
 */
export class CommandParser {
    @Trace()
    public static async parseAndValidate(
        ctx: CommandContext,
        optionsMeta: ReadonlyArray<IOptionMetadata>,
        internalState?: {
            prefixMap: Map<string, string>;
            rawContent: string;
        },
    ): Promise<Record<string, CommandOption<any>>> {
        const parsedData: Record<string, CommandOption<any>> = {};
        const prefixMap = internalState?.prefixMap ?? new Map<string, string>();

        let injectedContent = internalState?.rawContent ?? "";
        let extractedMods: Array<string> = [];

        if (!internalState && !ctx.isSlash) {
            const messageContext = ctx as MessageContext;

            const hasModsOption = optionsMeta.some(
                (meta) => meta.type === EOptionType.Mods || meta.type === EOptionType.ModsArray,
            );

            const parsed = CommandParser.preprocessPrefixContent(messageContext.rawContent, prefixMap, hasModsOption);

            injectedContent = parsed.content;
            extractedMods = parsed.mods;
        }

        const injectedValues = ctx.isSlash
            ? new Map<string, string>()
            : CommandParser.distributeInjectedContent(optionsMeta, injectedContent, prefixMap);

        for (const meta of optionsMeta) {
            let rawValue: any = null;

            if (meta.isInlineIndex && ctx.state.inlineIndex !== undefined) {
                rawValue = ctx.state.inlineIndex;
            } else if (meta.type === EOptionType.Mods) {
                if (ctx.isSlash) {
                    rawValue = (ctx as SlashContext).interaction.options.getString(meta.name);
                } else {
                    const explicitValue = CommandParser.getOptionValue(meta, prefixMap);

                    if (extractedMods.length > 1) {
                        throw new Exception(
                            EApplicationError.INPUT_ERROR,
                            `Option \`${meta.name}\` only accepts one mod expression.`,
                        );
                    }

                    rawValue = extractedMods[0] ?? explicitValue ?? null;
                }
            } else if (meta.type === EOptionType.ModsArray) {
                if (ctx.isSlash) {
                    rawValue = (ctx as SlashContext).interaction.options.getString(meta.name);
                } else {
                    const explicitValue = CommandParser.getOptionValue(meta, prefixMap);
                    if (explicitValue !== undefined && extractedMods.length > 0) {
                        throw new Exception(
                            EApplicationError.INPUT_ERROR,
                            `Option \`${meta.name}\` cannot mix \`${meta.name}=...\` with standalone mod expressions.`,
                        );
                    }

                    rawValue =
                        explicitValue !== undefined ? explicitValue : extractedMods.length > 0 ? extractedMods : null;
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
                    const explicitValue = CommandParser.getOptionValue(meta, prefixMap);
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
                const explicitValue = CommandParser.getOptionValue(meta, prefixMap);
                rawValue = explicitValue ?? injectedValues.get(meta.propertyKey) ?? null;
            } else if (ctx.isSlash && !internalState) {
                const slashCtx = ctx as SlashContext;

                if (meta.type === EOptionType.User) {
                    rawValue = slashCtx.interaction.options.getUser(meta.name);
                } else {
                    rawValue = slashCtx.interaction.options.get(meta.name)?.value;
                }
            } else {
                rawValue = CommandParser.getOptionValue(meta, prefixMap);
            }

            if ((rawValue === null || rawValue === undefined || rawValue === "") && meta.required) {
                throw new Exception(EApplicationError.INPUT_ERROR, `Option \`${meta.name}\` is required.`);
            }

            if (rawValue === null || rawValue === undefined || (rawValue === "" && meta.type !== EOptionType.Query)) {
                parsedData[meta.propertyKey] = new CommandOption(null);
                continue;
            }

            const finalValue = await CommandParser.validateType(meta, rawValue, ctx, prefixMap);

            parsedData[meta.propertyKey] = new CommandOption(finalValue);
        }

        return parsedData;
    }

    private static distributeInjectedContent(
        optionsMeta: ReadonlyArray<IOptionMetadata>,
        content: string,
        prefixMap: Map<string, string>,
    ): Map<string, string> {
        const result = new Map<string, string>();
        if (!content) {
            return result;
        }

        const injected = optionsMeta.filter(
            (meta) =>
                meta.inject !== undefined &&
                meta.type !== EOptionType.Query &&
                !CommandParser.hasOptionValue(meta, prefixMap),
        );

        if (!injected.length) {
            return result;
        }

        const tokens = CommandParser.tokenizeInjectedContent(content);
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

    private static getOptionKeys(meta: IOptionMetadata): Array<string> {
        return [meta.name.toLowerCase(), ...(meta.aliases ?? []).map((alias) => alias.toLowerCase())];
    }

    private static getOptionValue(meta: IOptionMetadata, prefixMap: Map<string, string>): string | undefined {
        for (const key of CommandParser.getOptionKeys(meta)) {
            const value = prefixMap.get(key);

            if (value !== undefined) {
                return value;
            }
        }

        return undefined;
    }

    private static hasOptionValue(meta: IOptionMetadata, prefixMap: Map<string, string>): boolean {
        return CommandParser.getOptionKeys(meta).some((key) => prefixMap.has(key));
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

        /*
         * A mods array may arrive as:
         *
         * Prefix:
         *   ["+HD", "-HR!"]
         *
         * Slash/explicit:
         *   "+HD -HR!"
         */
        if (meta.type === EOptionType.ModsArray) {
            return CommandParser.parseModsArray(value);
        }

        const strVal = String(value).trim();
        if (meta.type === EOptionType.Mods) {
            return CommandParser.parseMods(strVal);
        }

        if (meta.type === EOptionType.Query) {
            return CommandParser.parseQueryDto(meta, strVal, ctx, prefixMap);
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
                return CommandParser.parseDate(meta.name, strVal);
            case EOptionType.DateRange:
                return CommandParser.parseDateRange(meta.name, strVal);
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
            case EOptionType.Range: {
                const range = CommandParser.parseRange(meta.name, strVal);
                CommandParser.validateRangeBounds(meta, range);
                return range;
            }
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
        const normalized = input.trim().toUpperCase();

        const match = normalized.match(/^([+-])([A-Z0-9]{2,})(!)?$/);

        if (!match) {
            throw new Exception(EApplicationError.INPUT_ERROR, `Invalid mod combination: \`${input}\``);
        }

        const sign = match[1]!;
        const mods = match[2]!;
        const exact = match[3] === "!";

        if (sign === "-" && !exact) {
            throw new Exception(EApplicationError.INPUT_ERROR, `Invalid mod combination: \`${input}\``);
        }

        let type = EModMatchType.Include;

        if (sign === "-") {
            type = EModMatchType.Exclude;
        } else if (exact) {
            type = EModMatchType.Match;
        }

        return {
            type,
            mods,
        };
    }

    private static parseModsArray(input: string | Array<string>): Array<ICommandMods> {
        const values = Array.isArray(input) ? input : CommandParser.tokenizeInjectedContent(input);

        if (!values.length) {
            throw new Exception(EApplicationError.INPUT_ERROR, "At least one mod expression must be specified.");
        }

        return values.map((value) => CommandParser.parseMods(value));
    }

    private static async parseQueryDto(
        meta: IOptionMetadata,
        stringContent: string,
        ctx: CommandContext,
        globalPrefixMap: Map<string, string>,
    ): Promise<ICommandQueryData<any>> {
        const dtoClass = meta.queryDto;
        const properties = meta.queryProperties;

        if (typeof dtoClass !== "function") {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Query option \`${meta.name}\` has no generated DTO class.`,
            );
        }

        if (!properties) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Query option \`${meta.name}\` has no generated query metadata.`,
            );
        }

        let queryPrefixMap = new Map<string, string>();
        let cleanedContent = stringContent;
        const hasExplicitQuery = CommandParser.hasOptionValue(meta, globalPrefixMap);

        if (ctx.isSlash) {
            cleanedContent = CommandParser.extractKeyValuePairs(cleanedContent, queryPrefixMap);
        } else if (hasExplicitQuery) {
            cleanedContent = CommandParser.extractKeyValuePairs(cleanedContent, queryPrefixMap);
        } else {
            queryPrefixMap = globalPrefixMap;
            cleanedContent = meta.inject === EInjectMode.Greedy ? stringContent : "";
        }

        const parsedDtoFields = await CommandParser.parseAndValidate(ctx, properties, {
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

    private static parseDatePeriod(name: string, input: string): { start: Date; end: Date } | null {
        const match = input.trim().match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);

        if (!match) {
            return null;
        }

        const year = Number(match[1]);
        const month = match[2] !== undefined ? Number(match[2]) : undefined;
        const day = match[3] !== undefined ? Number(match[3]) : undefined;

        if (month !== undefined && (month < 1 || month > 12)) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `Option \`${name}\` must be a valid date (e.g., YYYY, YYYY-MM, or YYYY-MM-DD).`,
            );
        }

        if (day !== undefined) {
            if (month === undefined) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `Option \`${name}\` must be a valid date (e.g., YYYY, YYYY-MM, or YYYY-MM-DD).`,
                );
            }

            const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
            if (day < 1 || day > daysInMonth) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `Option \`${name}\` must be a valid date (e.g., YYYY, YYYY-MM, or YYYY-MM-DD).`,
                );
            }
        }

        if (month === undefined) {
            return {
                start: new Date(Date.UTC(year, 0, 1)),
                end: new Date(Date.UTC(year + 1, 0, 1) - 1),
            };
        }

        if (day === undefined) {
            return {
                start: new Date(Date.UTC(year, month - 1, 1)),
                end: new Date(Date.UTC(year, month, 1) - 1),
            };
        }

        return {
            start: new Date(Date.UTC(year, month - 1, day)),
            end: new Date(Date.UTC(year, month - 1, day + 1) - 1),
        };
    }

    private static parseDateRange(name: string, input: string): ICommandDateRange {
        const rangeObj: ICommandDateRange = {
            minInclusive: false,
            maxInclusive: false,
        };

        const operatorMatch = input.match(/^([<>]=?)(.+)$/);

        if (operatorMatch) {
            const operator = operatorMatch[1]!;
            const rawDate = operatorMatch[2]!.trim();

            const period = CommandParser.parseDatePeriod(name, rawDate);
            const exactDate = period ? null : CommandParser.parseDate(name, rawDate);

            if (operator === ">") {
                rangeObj.min = period?.end ?? exactDate!;
            } else if (operator === ">=") {
                rangeObj.min = period?.start ?? exactDate!;
                rangeObj.minInclusive = true;
            } else if (operator === "<") {
                rangeObj.max = period?.start ?? exactDate!;
            } else if (operator === "<=") {
                rangeObj.max = period?.end ?? exactDate!;
                rangeObj.maxInclusive = true;
            }

            rangeObj.display = `${operator}${rawDate}`;

            return rangeObj;
        }

        const splitMatch = input.split(/(?:\.\.|\/|\s+to\s+)/i);

        if (splitMatch.length === 2) {
            const rawMin = splitMatch[0]!.trim();
            const rawMax = splitMatch[1]!.trim();

            const minPeriod = CommandParser.parseDatePeriod(name, rawMin);
            const maxPeriod = CommandParser.parseDatePeriod(name, rawMax);

            rangeObj.min = minPeriod?.start ?? CommandParser.parseDate(name, rawMin);
            rangeObj.max = maxPeriod?.end ?? CommandParser.parseDate(name, rawMax);

            rangeObj.minInclusive = true;
            rangeObj.maxInclusive = true;
            rangeObj.display = `=${rawMin}..${rawMax}`;

            return rangeObj;
        }

        const period = CommandParser.parseDatePeriod(name, input);

        if (period) {
            return {
                min: period.start,
                max: period.end,
                minInclusive: true,
                maxInclusive: true,
                display: `=${input}`,
            };
        }

        const exactDate = CommandParser.parseDate(name, input);

        return {
            min: exactDate,
            max: exactDate,
            minInclusive: true,
            maxInclusive: true,
            exact: exactDate,
            display: `=${input}`,
        };
    }

    private static parseRange(name: string, input: string): ICommandRange {
        const rangeObj: ICommandRange = {
            min: -Infinity,
            max: Infinity,
            minInclusive: false,
            maxInclusive: false,
        };

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

        const dashMatch = input.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);

        if (dashMatch) {
            rangeObj.min = Number(dashMatch[1]);

            rangeObj.max = Number(dashMatch[2]);

            rangeObj.minInclusive = true;
            rangeObj.maxInclusive = true;

            return rangeObj;
        }

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
        if (meta.autocomplete && meta.type === EOptionType.Enum) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Option \`${meta.name}\` cannot use autocomplete because it has predefined enum choices.`,
            );
        }

        if (
            meta.autocomplete &&
            ![
                EOptionType.String,
                EOptionType.Number,
                EOptionType.Integer,
                EOptionType.Range,
                EOptionType.Date,
                EOptionType.DateRange,
                EOptionType.Mods,
                EOptionType.ModsArray,
                EOptionType.Query,
            ].includes(meta.type)
        ) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Option \`${meta.name}\` cannot use autocomplete with type ${meta.type}.`,
            );
        }

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

        if (meta.type === EOptionType.String) {
            return {
                ...base,
                type: ApplicationCommandOptionType.String,
                minLength: meta.min,
                maxLength: meta.max,
                autocomplete: meta.autocomplete || undefined,
            };
        }

        if (meta.type === EOptionType.Range || meta.type === EOptionType.Date || meta.type === EOptionType.DateRange) {
            return {
                ...base,
                type: ApplicationCommandOptionType.String,
                autocomplete: meta.autocomplete || undefined,
            };
        }

        if (meta.type === EOptionType.Integer) {
            return {
                ...base,
                type: ApplicationCommandOptionType.Integer,
                minValue: meta.min,
                maxValue: meta.max,
                autocomplete: meta.autocomplete || undefined,
            };
        }

        if (meta.type === EOptionType.Number) {
            return {
                ...base,
                type: ApplicationCommandOptionType.Number,
                minValue: meta.min,
                maxValue: meta.max,
                autocomplete: meta.autocomplete || undefined,
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
            autocomplete: meta.autocomplete || undefined,
        };
    }

    /**
     * Performs prefix preprocessing in a single token-aware pass.
     *
     * Extracts:
     *
     *   creator=sotarks
     *   pp>=500
     *   query="hatsune miku"
     *
     * and optionally standalone mod shorthand:
     *
     *   +HD
     *   +DT!
     *   -HR!
     *
     * Quoted standalone content is never interpreted as an option:
     *
     *   "name cs=4"
     *   "+HD"
     */
    private static preprocessPrefixContent(
        content: string,
        prefixMap: Map<string, string>,
        extractMods: boolean,
    ): {
        content: string;
        mods: Array<string>;
    } {
        const tokens = CommandParser.tokenizeContent(content);

        const remaining: Array<string> = [];
        const mods: Array<string> = [];

        for (const token of tokens) {
            const option = CommandParser.parseKeyValueToken(token);

            if (option) {
                prefixMap.set(option.key, option.value);

                continue;
            }

            if (extractMods && !token.hadQuotes && CommandParser.isModsExpression(token.value)) {
                mods.push(token.value);
                continue;
            }

            /*
             * Preserve the original token rather than token.value.
             *
             * This is important because remaining content may later be
             * tokenized again for injected arguments.
             *
             * `"spaced name"` must remain one token.
             */
            remaining.push(token.raw);
        }

        return {
            content: remaining.join(" ").trim(),
            mods,
        };
    }

    /**
     * Extracts only key/value options.
     *
     * This remains as a convenience wrapper because query DTO parsing needs
     * the same behavior without interpreting mod shorthand.
     */
    private static extractKeyValuePairs(content: string, prefixMap: Map<string, string>): string {
        return CommandParser.preprocessPrefixContent(content, prefixMap, false).content;
    }

    /**
     * Attempts to interpret one token as a key/value option.
     *
     * Examples:
     *
     * creator=sotarks
     * pp>=500
     * rankdate=2024
     * query="hatsune miku"
     */
    private static parseKeyValueToken(token: ICommandToken): { key: string; value: string } | null {
        /*
         * A token beginning with a quote is plain positional content.
         *
         * `"hatsune miku cs=4"`
         *
         * should not expose cs=4 as a command option.
         */
        if (token.startsQuoted) {
            return null;
        }

        const match = token.value.match(/^([a-zA-Z0-9_]+)(==|>=|<=|>|<|=|:(?!\/\/))(.+)$/);
        if (!match) {
            return null;
        }

        const key = match[1]!.toLowerCase();
        const operator = match[2]!;
        let value = match[3]!;

        /*
         * For range operators, keep the operator as part of the resulting
         * value because IsRange/IsDateRange consume it.
         *
         * pp>=500
         *
         * becomes:
         *
         * key   = pp
         * value = >=500
         */
        if (!["=", ":", "=="].includes(operator)) {
            value = operator + value;
        }

        return {
            key,
            value,
        };
    }

    private static isModsExpression(value: string): boolean {
        return /^(?:\+[a-zA-Z0-9]{2,}!?|-[a-zA-Z0-9]{2,}!)$/.test(value);
    }

    private static validateRangeBounds(meta: IOptionMetadata, range: ICommandRange): void {
        const values = [range.min, range.max].filter((value) => Number.isFinite(value));

        if (meta.min !== undefined) {
            const invalid = values.find((value) => value < meta.min!);
            if (invalid !== undefined) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `Option \`${meta.name}\` cannot contain values below ${meta.min}.`,
                );
            }
        }

        if (meta.max !== undefined) {
            const invalid = values.find((value) => value > meta.max!);
            if (invalid !== undefined) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `Option \`${meta.name}\` cannot contain values above ${meta.max}.`,
                );
            }
        }
    }

    /**
     * Tokenizes prefix input while respecting:
     *
     * - normal quotes: "..."
     * - smart quotes:  “...”
     * - backslash escaping
     *
     * Quotes are removed from `value`, but preserved in `raw`.
     */
    private static tokenizeContent(content: string): Array<ICommandToken> {
        const tokens: Array<ICommandToken> = [];

        let raw = "";
        let value = "";

        let closingQuote: '"' | "”" | null = null;

        let escaped = false;
        let startsQuoted = false;
        let hadQuotes = false;

        const push = () => {
            if (!raw.length) {
                return;
            }

            tokens.push({
                raw,
                value,
                startsQuoted,
                hadQuotes,
            });

            raw = "";
            value = "";
            startsQuoted = false;
            hadQuotes = false;
        };

        for (const char of content) {
            if (escaped) {
                raw += char;
                value += char;
                escaped = false;

                continue;
            }

            if (char === "\\") {
                raw += char;
                escaped = true;

                continue;
            }

            if (closingQuote) {
                raw += char;

                if (char === closingQuote) {
                    closingQuote = null;
                } else {
                    value += char;
                }

                continue;
            }

            if (char === '"' || char === "“") {
                if (!raw.length) {
                    startsQuoted = true;
                }

                raw += char;
                hadQuotes = true;

                closingQuote = char === '"' ? '"' : "”";

                continue;
            }

            if (/\s/.test(char)) {
                push();
                continue;
            }

            raw += char;
            value += char;
        }

        /*
         * Preserve a trailing escaped backslash in the decoded value.
         */
        if (escaped) {
            value += "\\";
        }

        if (closingQuote) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Unclosed quote in command arguments.");
        }

        push();
        return tokens;
    }

    private static tokenizeInjectedContent(content: string): Array<string> {
        return CommandParser.tokenizeContent(content).map((token) => token.value);
    }
}
