import { SerializableDto } from "@domain/core/Data";
import { Exclude, Expose, Transform, Type } from "class-transformer";

const CsvNumber = () => {
    return Transform(({ value }) => {
        if (value === undefined || value === null || value === "") {
            return undefined;
        }

        return Number(value);
    });
};

@Exclude()
export class FarmMetadataDto {
    @Expose()
    @Type(() => Date)
    declare lastUpdated: Date;
}

@Exclude()
export class FarmMapsetCsvDto {
    @Expose({ name: "s" })
    @CsvNumber()
    declare mapsetID: number;

    @Expose({ name: "art" })
    declare artist: string;

    @Expose({ name: "t" })
    declare title: string;

    @Expose()
    @CsvNumber()
    declare bpm: number;
}

@Exclude()
export class FarmMapCsvDto {
    @Expose({ name: "m" })
    @CsvNumber()
    declare mods: number;

    @Expose({ name: "b" })
    @CsvNumber()
    declare beatmapID: number;

    @Expose({ name: "s" })
    @CsvNumber()
    declare mapsetID: number;

    @Expose({ name: "x" })
    @CsvNumber()
    declare farmValue: number;

    @Expose({ name: "pp99" })
    @CsvNumber()
    declare pp?: number;

    @Expose({ name: "adj" })
    @CsvNumber()
    declare adjusted: number;

    @Expose({ name: "v" })
    declare version: string;

    @Expose({ name: "l" })
    @CsvNumber()
    declare length: number;

    @Expose({ name: "d" })
    @CsvNumber()
    declare stars: number;

    @Expose({ name: "p" })
    @CsvNumber()
    declare passCount: number;

    @Expose({ name: "h" })
    @CsvNumber()
    declare ageHours: number;

    @Expose({ name: "appr_h" })
    @CsvNumber()
    declare rankedHours: number;

    @Expose()
    @CsvNumber()
    declare ar: number;

    @Expose()
    @CsvNumber()
    declare accuracy: number;

    @Expose()
    @CsvNumber()
    declare cs: number;

    @Expose()
    @CsvNumber()
    declare drain: number;
}

@Exclude()
export class FarmMapDto extends SerializableDto {
    @Expose()
    declare beatmapID: number;

    @Expose()
    declare mapsetID: number;

    @Expose()
    declare artist: string;

    @Expose()
    declare title: string;

    @Expose()
    declare version: string;

    @Expose()
    declare mods: number;

    @Expose()
    declare pp?: number;

    @Expose()
    declare farmability: number;

    @Expose()
    declare stars: number;

    @Expose()
    declare bpm: number;

    @Expose()
    declare length: number;

    @Expose()
    @Type(() => Date)
    declare rankedAt: Date;

    @Expose()
    declare ar: number;

    @Expose()
    declare cs: number;

    @Expose()
    declare od: number;

    @Expose()
    declare hp: number;
}
