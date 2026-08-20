import { instanceToPlain } from "class-transformer";

export abstract class SerializableDto {
    public toJSON(): Record<string, unknown> {
        return instanceToPlain(this, { excludeExtraneousValues: true });
    }
}
