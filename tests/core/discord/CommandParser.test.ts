import { describe, expect, test } from "vitest";
import { EInjectMode, EOptionType, IOptionMetadata } from "@/core/decorators";
import { CommandParser } from "@/core/discord/options/CommandParser";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { EModMatchType, ICommandDateRange, ICommandQueryData, ICommandRange } from "@domain/core/Command";
import { EApplicationError } from "@domain/core/Exception";

/**
 * CommandParser only needs a small subset of MessageContext for normal
 * prefix parsing.
 */
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

async function parse(content: string, options: ReadonlyArray<IOptionMetadata>) {
    return await CommandParser.parseAndValidate(createContext(content), options);
}

async function expectInputError(promise: Promise<unknown>, message: string): Promise<void> {
    await expect(promise).rejects.toMatchObject({
        code: EApplicationError.INPUT_ERROR,
        extra_message: message,
    });
}

function iso(date: Date | undefined): string | undefined {
    return date?.toISOString();
}

class TestTopQueryDto {}

const topQueryProperties: ReadonlyArray<IOptionMetadata> = [
    option({
        propertyKey: "accuracy",
        name: "accuracy",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "combo",
        name: "combo",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "misses",
        name: "misses",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "artist",
        name: "artist",
        type: EOptionType.String,
    }),
    option({
        propertyKey: "creator",
        name: "creator",
        type: EOptionType.String,
    }),
    option({
        propertyKey: "title",
        name: "title",
        type: EOptionType.String,
    }),
    option({
        propertyKey: "version",
        name: "version",
        type: EOptionType.String,
    }),
    option({
        propertyKey: "rankedDate",
        name: "rankdate",
        type: EOptionType.DateRange,
    }),
    option({
        propertyKey: "length",
        name: "length",
        type: EOptionType.Range,
    }),
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
        propertyKey: "hp",
        name: "hp",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "od",
        name: "od",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "bpm",
        name: "bpm",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "stars",
        name: "stars",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "pp",
        name: "pp",
        type: EOptionType.Range,
    }),
    option({
        propertyKey: "ppfc",
        name: "ppfc",
        type: EOptionType.Range,
    }),
];

enum TestScoreSort {
    CS = "CS",
    AR = "AR",
    OD = "OD",
    Date = "Date",
    Length = "Length",
    Accuracy = "Accuracy",
    Misses = "Misses",
    Combo = "Combo",
    PP = "PP",
    PPFC = "PPFC",
    Stars = "Stars",
    RankDate = "RankDate",
}

enum TestSortOrder {
    Ascending = "Asc",
    Descending = "Desc",
}

const nameOption = option({
    propertyKey: "name",
    name: "name",
    type: EOptionType.String,
    inject: EInjectMode.Greedy,
});

const modsOption = option({
    propertyKey: "mods",
    name: "mods",
    type: EOptionType.Mods,
});

const modsArrayOption = option({
    propertyKey: "mods",
    name: "mods",
    type: EOptionType.ModsArray,
});

const queryOption = option({
    propertyKey: "query",
    name: "query",
    aliases: ["search", "s", "q"],
    type: EOptionType.Query,
    queryDto: TestTopQueryDto,
    queryProperties: topQueryProperties,
});

const sortOption = option({
    propertyKey: "sort",
    name: "sort",
    type: EOptionType.Enum,
    enumData: TestScoreSort,
});

const orderOption = option({
    propertyKey: "order",
    name: "order",
    type: EOptionType.Enum,
    enumData: TestSortOrder,
});

describe("CommandParser", () => {
    describe("injected content", () => {
        test("parses ordinary greedy content", async () => {
            const result = await parse("mrekk", [nameOption]);
            expect(result.name?.unwrap()).toBe("mrekk");
        });

        test("keeps a quoted username together", async () => {
            const result = await parse('"spaced username"', [nameOption]);
            expect(result.name?.unwrap()).toBe("spaced username");
        });

        test("supports smart quotes", async () => {
            const result = await parse("“spaced username”", [nameOption]);
            expect(result.name?.unwrap()).toBe("spaced username");
        });

        test("supports escaped whitespace", async () => {
            const result = await parse("spaced\\ username", [nameOption]);
            expect(result.name?.unwrap()).toBe("spaced username");
        });

        test("does not extract key/value syntax from quoted positional content", async () => {
            const result = await parse('"player cs=4 ar=10 pp>=500"', [nameOption]);
            expect(result.name?.unwrap()).toBe("player cs=4 ar=10 pp>=500");
        });

        test("does not treat a URL as an explicit option", async () => {
            const result = await parse("https://osu.ppy.sh/users/7562902", [nameOption]);
            expect(result.name?.unwrap()).toBe("https://osu.ppy.sh/users/7562902");
        });

        test("rejects an unclosed normal quote", async () => {
            await expectInputError(parse('"unclosed username', [nameOption]), "Unclosed quote in command arguments.");
        });

        test("rejects an unclosed smart quote", async () => {
            await expectInputError(parse("“unclosed username", [nameOption]), "Unclosed quote in command arguments.");
        });
    });

    describe("explicit options", () => {
        test("parses key=value", async () => {
            const result = await parse("name=mrekk", [nameOption]);
            expect(result.name?.unwrap()).toBe("mrekk");
        });

        test("parses quoted key/value content", async () => {
            const result = await parse('name="spaced username"', [nameOption]);
            expect(result.name?.unwrap()).toBe("spaced username");
        });

        test("supports aliases", async () => {
            const result = await parse("n=mrekk", [
                option({
                    propertyKey: "name",
                    name: "name",
                    aliases: ["n"],
                    type: EOptionType.String,
                }),
            ]);

            expect(result.name?.unwrap()).toBe("mrekk");
        });

        test("explicit option takes precedence over injected content", async () => {
            const result = await parse("injected-user name=explicit-user", [nameOption]);
            expect(result.name?.unwrap()).toBe("explicit-user");
        });
    });

    describe("ranges", () => {
        const ppOption = option({
            propertyKey: "pp",
            name: "pp",
            type: EOptionType.Range,
        });

        test("parses an exact range value", async () => {
            const result = await parse("pp=500", [ppOption]);
            const range = result.pp?.unwrap() as ICommandRange;

            expect(range).toEqual({
                min: 500,
                max: 500,
                minInclusive: true,
                maxInclusive: true,
                exact: 500,
            });
        });

        test("parses >=", async () => {
            const result = await parse("pp>=500", [ppOption]);
            const range = result.pp?.unwrap() as ICommandRange;

            expect(range.min).toBe(500);
            expect(range.minInclusive).toBe(true);
            expect(range.max).toBe(Infinity);
        });

        test("parses >", async () => {
            const result = await parse("pp>500", [ppOption]);
            const range = result.pp?.unwrap() as ICommandRange;

            expect(range.min).toBe(500);
            expect(range.minInclusive).toBe(false);
            expect(range.max).toBe(Infinity);
        });

        test("parses <=", async () => {
            const result = await parse("pp<=500", [ppOption]);
            const range = result.pp?.unwrap() as ICommandRange;

            expect(range.max).toBe(500);
            expect(range.maxInclusive).toBe(true);
            expect(range.min).toBe(-Infinity);
        });

        test("parses <", async () => {
            const result = await parse("pp<500", [ppOption]);
            const range = result.pp?.unwrap() as ICommandRange;

            expect(range.max).toBe(500);
            expect(range.maxInclusive).toBe(false);
            expect(range.min).toBe(-Infinity);
        });

        test("parses a dash range", async () => {
            const result = await parse("pp=500-700", [ppOption]);

            expect(result.pp?.unwrap()).toEqual({
                min: 500,
                max: 700,
                minInclusive: true,
                maxInclusive: true,
            });
        });

        test("parses decimal ranges", async () => {
            const result = await parse("pp=500.5-700.25", [ppOption]);

            expect(result.pp?.unwrap()).toEqual({
                min: 500.5,
                max: 700.25,
                minInclusive: true,
                maxInclusive: true,
            });
        });

        test("rejects malformed ranges", async () => {
            await expectInputError(
                parse("pp=hello", [ppOption]),
                "Option `pp` is not a valid range. Valid examples: 1-6, >5, <=10",
            );
        });

        test("accepts a range within configured bounds", async () => {
            const boundedOption = option({
                propertyKey: "accuracy",
                name: "accuracy",
                type: EOptionType.Range,
                min: 0,
                max: 100,
            });

            const result = await parse("accuracy=95-100", [boundedOption]);

            expect(result.accuracy?.unwrap()).toMatchObject({
                min: 95,
                max: 100,
            });
        });

        test("rejects a range below configured minimum", async () => {
            const boundedOption = option({
                propertyKey: "accuracy",
                name: "accuracy",
                type: EOptionType.Range,
                min: 10,
                max: 100,
            });

            await expectInputError(
                parse("accuracy=5", [boundedOption]),
                "Option `accuracy` cannot contain values below 10.",
            );
        });

        test("rejects a range above configured maximum", async () => {
            const boundedOption = option({
                propertyKey: "accuracy",
                name: "accuracy",
                type: EOptionType.Range,
                min: 0,
                max: 100,
            });

            await expectInputError(
                parse("accuracy=80-120", [boundedOption]),
                "Option `accuracy` cannot contain values above 100.",
            );
        });
    });

    describe("dates", () => {
        describe("Date", () => {
            const dateOption = option({
                propertyKey: "date",
                name: "date",
                type: EOptionType.Date,
            });

            test("parses a complete date", async () => {
                const result = await parse("date=2024-02-29", [dateOption]);
                const date = result.date?.unwrap() as Date;

                expect(date.toISOString()).toBe("2024-02-29T00:00:00.000Z");
            });

            test("parses a complete timestamp", async () => {
                const result = await parse("date=2024-02-29T12:34:56Z", [dateOption]);
                const date = result.date?.unwrap() as Date;

                expect(date.toISOString()).toBe("2024-02-29T12:34:56.000Z");
            });

            test("rejects a completely invalid date", async () => {
                await expectInputError(
                    parse("date=not-a-date", [dateOption]),
                    "Option `date` must be a valid date (e.g., YYYY-MM-DD).",
                );
            });
        });

        describe("DateRange", () => {
            const rankDateOption = option({
                propertyKey: "rankedDate",
                name: "rankdate",
                type: EOptionType.DateRange,
            });

            test("treats a year as the whole calendar year", async () => {
                const result = await parse("rankdate=2012", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2012-01-01T00:00:00.000Z");
                expect(iso(range.max)).toBe("2012-12-31T23:59:59.999Z");

                expect(range.minInclusive).toBe(true);
                expect(range.maxInclusive).toBe(true);
                expect(range.display).toBe("=2012");
            });

            test("treats a month as the whole calendar month", async () => {
                const result = await parse("rankdate=2012-02", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2012-02-01T00:00:00.000Z");
                expect(iso(range.max)).toBe("2012-02-29T23:59:59.999Z");
            });

            test("treats a day as the whole calendar day", async () => {
                const result = await parse("rankdate=2024-06-12", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2024-06-12T00:00:00.000Z");
                expect(iso(range.max)).toBe("2024-06-12T23:59:59.999Z");
            });

            test("parses >= partial date from the beginning of its period", async () => {
                const result = await parse("rankdate>=2012", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2012-01-01T00:00:00.000Z");

                expect(range.minInclusive).toBe(true);
                expect(range.max).toBeUndefined();
                expect(range.display).toBe(">=2012");
            });

            test("parses > partial date from the end of its period", async () => {
                const result = await parse("rankdate>2012", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2012-12-31T23:59:59.999Z");

                expect(range.minInclusive).toBe(false);
                expect(range.display).toBe(">2012");
            });

            test("parses <= partial date through the end of its period", async () => {
                const result = await parse("rankdate<=2012-06", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.max)).toBe("2012-06-30T23:59:59.999Z");

                expect(range.maxInclusive).toBe(true);
                expect(range.display).toBe("<=2012-06");
            });

            test("parses < partial date from the beginning of its period", async () => {
                const result = await parse("rankdate<2012-06", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.max)).toBe("2012-06-01T00:00:00.000Z");

                expect(range.maxInclusive).toBe(false);
                expect(range.display).toBe("<2012-06");
            });

            test("parses year-to-year ranges", async () => {
                const result = await parse("rankdate=2012..2014", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2012-01-01T00:00:00.000Z");
                expect(iso(range.max)).toBe("2014-12-31T23:59:59.999Z");

                expect(range.minInclusive).toBe(true);
                expect(range.maxInclusive).toBe(true);
                expect(range.display).toBe("=2012..2014");
            });

            test("parses month-to-month ranges", async () => {
                const result = await parse("rankdate=2012-01..2012-06", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2012-01-01T00:00:00.000Z");
                expect(iso(range.max)).toBe("2012-06-30T23:59:59.999Z");
            });

            test("parses slash-separated date ranges", async () => {
                const result = await parse('rankdate="2023-01-01 / 2023-12-31"', [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2023-01-01T00:00:00.000Z");
                expect(iso(range.max)).toBe("2023-12-31T23:59:59.999Z");
            });

            test("parses 'to' date ranges", async () => {
                const result = await parse('rankdate="2023-01-01 to 2023-12-31"', [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2023-01-01T00:00:00.000Z");
                expect(iso(range.max)).toBe("2023-12-31T23:59:59.999Z");
            });

            test("rejects an invalid month", async () => {
                await expectInputError(
                    parse("rankdate=2024-13", [rankDateOption]),
                    "Option `rankdate` must be a valid date (e.g., YYYY, YYYY-MM, or YYYY-MM-DD).",
                );
            });

            test("rejects an invalid day", async () => {
                await expectInputError(
                    parse("rankdate=2024-04-31", [rankDateOption]),
                    "Option `rankdate` must be a valid date (e.g., YYYY, YYYY-MM, or YYYY-MM-DD).",
                );
            });

            test("rejects February 29 on a non-leap year", async () => {
                await expectInputError(
                    parse("rankdate=2023-02-29", [rankDateOption]),
                    "Option `rankdate` must be a valid date (e.g., YYYY, YYYY-MM, or YYYY-MM-DD).",
                );
            });

            test("accepts February 29 on a leap year", async () => {
                const result = await parse("rankdate=2024-02-29", [rankDateOption]);
                const range = result.rankedDate?.unwrap() as ICommandDateRange;

                expect(iso(range.min)).toBe("2024-02-29T00:00:00.000Z");
                expect(iso(range.max)).toBe("2024-02-29T23:59:59.999Z");
            });
        });
    });

    describe("mods", () => {
        test("parses included mods", async () => {
            const result = await parse("+HD", [modsOption]);

            expect(result.mods?.unwrap()).toEqual({
                type: EModMatchType.Include,
                mods: "HD",
            });
        });

        test("parses exact mods", async () => {
            const result = await parse("+HDDT!", [modsOption]);

            expect(result.mods?.unwrap()).toEqual({
                type: EModMatchType.Match,
                mods: "HDDT",
            });
        });

        test("parses excluded mods", async () => {
            const result = await parse("-DT!", [modsOption]);

            expect(result.mods?.unwrap()).toEqual({
                type: EModMatchType.Exclude,
                mods: "DT",
            });
        });

        test("normalizes mods to uppercase", async () => {
            const result = await parse("+hddt", [modsOption]);

            expect(result.mods?.unwrap()).toEqual({
                type: EModMatchType.Include,
                mods: "HDDT",
            });
        });

        test("does not interpret quoted mod syntax as shorthand", async () => {
            const result = await parse('"+HD"', [nameOption, modsOption]);

            expect(result.name?.unwrap()).toBe("+HD");
            expect(result.mods?.some()).toBe(false);
        });

        test("rejects exclusion without !", async () => {
            await expectInputError(parse("mods=-HD", [modsOption]), "Invalid mod combination: `-HD`");
        });
    });

    describe("mods arrays", () => {
        test("parses multiple standalone mod expressions in order", async () => {
            const result = await parse("+HD -HR! +DT", [modsArrayOption]);

            expect(result.mods?.unwrap()).toEqual([
                {
                    type: EModMatchType.Include,
                    mods: "HD",
                },
                {
                    type: EModMatchType.Exclude,
                    mods: "HR",
                },
                {
                    type: EModMatchType.Include,
                    mods: "DT",
                },
            ]);
        });

        test("preserves operation ordering", async () => {
            const first = await parse("+DT! +HD", [modsArrayOption]);
            const second = await parse("+HD +DT!", [modsArrayOption]);

            expect(first.mods?.unwrap()).toEqual([
                {
                    type: EModMatchType.Match,
                    mods: "DT",
                },
                {
                    type: EModMatchType.Include,
                    mods: "HD",
                },
            ]);

            expect(second.mods?.unwrap()).toEqual([
                {
                    type: EModMatchType.Include,
                    mods: "HD",
                },
                {
                    type: EModMatchType.Match,
                    mods: "DT",
                },
            ]);
        });

        test("removes standalone mods before greedy injection", async () => {
            const result = await parse("mrekk +HD -HR!", [nameOption, modsArrayOption]);

            expect(result.name?.unwrap()).toBe("mrekk");

            expect(result.mods?.unwrap()).toEqual([
                {
                    type: EModMatchType.Include,
                    mods: "HD",
                },
                {
                    type: EModMatchType.Exclude,
                    mods: "HR",
                },
            ]);
        });

        test("supports explicit quoted mods array", async () => {
            const result = await parse('mods="+HD -HR! +DT!"', [modsArrayOption]);

            expect(result.mods?.unwrap()).toEqual([
                {
                    type: EModMatchType.Include,
                    mods: "HD",
                },
                {
                    type: EModMatchType.Exclude,
                    mods: "HR",
                },
                {
                    type: EModMatchType.Match,
                    mods: "DT",
                },
            ]);
        });

        test("rejects mixing explicit and standalone array syntax", async () => {
            await expectInputError(
                parse("mods=+DT! +HD", [modsArrayOption]),
                "Option `mods` cannot mix `mods=...` with standalone mod expressions.",
            );
        });
    });

    describe("query DTOs", () => {
        test("parses filters directly from top-level prefix arguments", async () => {
            const result = await parse("cs>=4 ar=10 creator=sotarks", [queryOption]);
            const query = result.query?.unwrap() as ICommandQueryData<TestTopQueryDto>;
            const dto = query.data as any;

            expect(dto.cs.unwrap()).toMatchObject({
                min: 4,
                minInclusive: true,
            });

            expect(dto.ar.unwrap()).toMatchObject({
                exact: 10,
            });

            expect(dto.creator.unwrap()).toBe("sotarks");

            expect(query.cleanedContent).toBe("");
        });

        test("parses filters from an explicit query string while preserving free text", async () => {
            const result = await parse('query="hatsune miku cs>=4 ar=10"', [queryOption]);
            const query = result.query?.unwrap() as ICommandQueryData<TestTopQueryDto>;
            const dto = query.data as any;

            expect(query.cleanedContent).toBe("hatsune miku");

            expect(dto.cs.unwrap()).toMatchObject({
                min: 4,
                minInclusive: true,
            });

            expect(dto.ar.unwrap()).toMatchObject({
                exact: 10,
            });
        });

        test("supports query option alias", async () => {
            const result = await parse('q="hatsune miku stars>=7"', [queryOption]);
            const query = result.query?.unwrap() as ICommandQueryData<TestTopQueryDto>;
            const dto = query.data as any;

            expect(query.cleanedContent).toBe("hatsune miku");

            expect(dto.stars.unwrap()).toMatchObject({
                min: 7,
                minInclusive: true,
            });
        });

        test("parses rankdate inside a query DTO", async () => {
            const result = await parse("rankdate=2018..2020", [queryOption]);
            const query = result.query?.unwrap() as ICommandQueryData<TestTopQueryDto>;
            const rankedDate = (query.data as any).rankedDate.unwrap() as ICommandDateRange;

            expect(iso(rankedDate.min)).toBe("2018-01-01T00:00:00.000Z");

            expect(iso(rankedDate.max)).toBe("2020-12-31T23:59:59.999Z");
        });
    });

    describe("possible usage regressions", () => {
        test("top cs>=4 ar=10 od>=9.8 length>64 +hd", async () => {
            const result = await parse("cs>=4 ar=10 od>=9.8 length>64 +hd", [nameOption, queryOption, modsOption]);

            expect(result.name?.some()).toBe(false);

            expect(result.mods?.unwrap()).toEqual({
                type: EModMatchType.Include,
                mods: "HD",
            });

            const query = result.query?.unwrap() as ICommandQueryData<TestTopQueryDto>;
            const dto = query.data as any;

            expect(dto.cs.unwrap()).toMatchObject({
                min: 4,
                minInclusive: true,
            });

            expect(dto.ar.unwrap()).toMatchObject({
                exact: 10,
            });

            expect(dto.od.unwrap()).toMatchObject({
                min: 9.8,
                minInclusive: true,
            });

            expect(dto.length.unwrap()).toMatchObject({
                min: 64,
                minInclusive: false,
            });
        });

        test("top mrekk cs>=4 ar=10 od>=9.8 length>64 +hd", async () => {
            const result = await parse("mrekk cs>=4 ar=10 od>=9.8 length>64 +hd", [
                nameOption,
                queryOption,
                modsOption,
            ]);

            expect(result.name?.unwrap()).toBe("mrekk");

            expect(result.mods?.unwrap()).toEqual({
                type: EModMatchType.Include,
                mods: "HD",
            });

            const query = result.query?.unwrap() as ICommandQueryData<TestTopQueryDto>;

            const dto = query.data as any;

            expect(dto.cs.unwrap().min).toBe(4);
            expect(dto.ar.unwrap().exact).toBe(10);
            expect(dto.od.unwrap().min).toBe(9.8);
            expect(dto.length.unwrap().min).toBe(64);
        });

        test("top creator=sotarks +dt bpm>215 sort=date order=asc", async () => {
            const result = await parse("creator=sotarks +dt bpm>215 sort=date order=asc", [
                nameOption,
                queryOption,
                modsOption,
                sortOption,
                orderOption,
            ]);

            expect(result.name?.some()).toBe(false);

            expect(result.mods?.unwrap()).toEqual({
                type: EModMatchType.Include,
                mods: "DT",
            });

            expect(result.sort?.unwrap()).toBe(TestScoreSort.Date);
            expect(result.order?.unwrap()).toBe(TestSortOrder.Ascending);

            const query = result.query?.unwrap() as ICommandQueryData<TestTopQueryDto>;
            const dto = query.data as any;

            expect(dto.creator.unwrap()).toBe("sotarks");

            expect(dto.bpm.unwrap()).toMatchObject({
                min: 215,
                minInclusive: false,
            });
        });

        test('top spaced name query="hatsune miku cs>=4"', async () => {
            const result = await parse('spaced name query="hatsune miku cs>=4"', [nameOption, queryOption]);
            expect(result.name?.unwrap()).toBe("spaced name");

            const query = result.query?.unwrap() as ICommandQueryData<TestTopQueryDto>;
            expect(query.cleanedContent).toBe("hatsune miku");

            expect((query.data as any).cs.unwrap()).toMatchObject({
                min: 4,
                minInclusive: true,
            });
        });

        test("top mrekk rankdate=2019..2022 pp>=500 +hd", async () => {
            const result = await parse("mrekk rankdate=2019..2022 pp>=500 +hd", [nameOption, queryOption, modsOption]);

            expect(result.name?.unwrap()).toBe("mrekk");

            expect(result.mods?.unwrap()).toEqual({
                type: EModMatchType.Include,
                mods: "HD",
            });

            const query = result.query?.unwrap() as ICommandQueryData<TestTopQueryDto>;
            const dto = query.data as any;
            const rankedDate = dto.rankedDate.unwrap() as ICommandDateRange;

            expect(iso(rankedDate.min)).toBe("2019-01-01T00:00:00.000Z");
            expect(iso(rankedDate.max)).toBe("2022-12-31T23:59:59.999Z");

            expect(dto.pp.unwrap()).toMatchObject({
                min: 500,
                minInclusive: true,
            });
        });

        test("topif mrekk +hd -hr!", async () => {
            const result = await parse("mrekk +hd -hr!", [nameOption, modsArrayOption]);

            expect(result.name?.unwrap()).toBe("mrekk");

            expect(result.mods?.unwrap()).toEqual([
                {
                    type: EModMatchType.Include,
                    mods: "HD",
                },
                {
                    type: EModMatchType.Exclude,
                    mods: "HR",
                },
            ]);
        });

        test("topif mrekk +dt! +hd preserves operation order", async () => {
            const result = await parse("mrekk +dt! +hd", [nameOption, modsArrayOption]);

            expect(result.mods?.unwrap()).toEqual([
                {
                    type: EModMatchType.Match,
                    mods: "DT",
                },
                {
                    type: EModMatchType.Include,
                    mods: "HD",
                },
            ]);
        });

        test("quoted username containing filter-looking content remains a username", async () => {
            const result = await parse('"some player cs=4 pp>=500" +HD', [nameOption, queryOption, modsOption]);

            expect(result.name?.unwrap()).toBe("some player cs=4 pp>=500");
            expect(result.query?.some()).toBe(false);

            expect(result.mods?.unwrap()).toEqual({
                type: EModMatchType.Include,
                mods: "HD",
            });
        });
    });

    describe("required options", () => {
        test("rejects a missing required option", async () => {
            await expectInputError(
                parse("", [
                    option({
                        propertyKey: "name",
                        name: "name",
                        type: EOptionType.String,
                        required: true,
                    }),
                ]),
                "Option `name` is required.",
            );
        });

        test("accepts a provided required option", async () => {
            const result = await parse("name=mrekk", [
                option({
                    propertyKey: "name",
                    name: "name",
                    type: EOptionType.String,
                    required: true,
                }),
            ]);

            expect(result.name?.unwrap()).toBe("mrekk");
        });
    });
});
