export type FieldType = "Int" | "String" | "Float" | "Boolean" | "Model" | "Date" | "Enum" | "Mods";

export class SchemaField {
    public $isOptional: boolean = false;
    public $isArray: boolean = false;
    private _nestedThunk?: SchemaModel | (() => SchemaModel);

    constructor(
        public $type: FieldType,
        nestedModel?: SchemaModel | (() => SchemaModel),
        public $enumDef?: SchemaEnum,
    ) {
        this._nestedThunk = nestedModel;
    }

    get $nestedModel(): SchemaModel | undefined {
        if (!this._nestedThunk) return undefined;
        return typeof this._nestedThunk === "function" ? this._nestedThunk() : this._nestedThunk;
    }

    Optional() {
        this.$isOptional = true;
        return this;
    }

    Array() {
        this.$isArray = true;
        return this;
    }
}

export class SchemaEnum<T extends Record<string, string | number> = any> {
    constructor(
        public $name: string,
        public $values: T,
    ) {}

    static define<V extends Record<string, string | number>>(name: string, values: V): SchemaEnum<V> & V {
        const instance = new SchemaEnum(name, values);
        Object.assign(instance, values);
        return instance as SchemaEnum<V> & V;
    }
}

export const Field = {
    Int: () => new SchemaField("Int"),
    String: () => new SchemaField("String"),
    Float: () => new SchemaField("Float"),
    Boolean: () => new SchemaField("Boolean"),
    Model: (m: SchemaModel | (() => SchemaModel)) => new SchemaField("Model", m),
    Date: () => new SchemaField("Date"),
    Enum: (e: SchemaEnum) => new SchemaField("Enum", undefined, e),
    Mods: () => new SchemaField("Mods"),
};

export class SchemaModel {
    constructor(
        public name: string,
        public fields: Record<string, SchemaField>,
    ) {}

    static define(name: string, fields: Record<string, SchemaField>) {
        return new SchemaModel(name, fields);
    }
}

export type TransformConfig = {
    toInstance?: (val: any) => any;
    toPlain?: (val: any) => any;
};

export type EndpointResponseTransform = (data: unknown, args: Record<string, any>) => Promise<unknown> | unknown;

export type MappingConfig =
    | string
    | { path?: string; default?: any; nested?: Mapping; transform?: ((value: any) => any) | TransformConfig };
export type ArgType = FieldType | `${FieldType}?`;
export type Mapping = Record<string, MappingConfig>;

export interface EndpointConfig {
    path: (args: any) => string;
    method: "GET" | "POST";
    returns: SchemaModel | { model: SchemaModel; isArray?: boolean; dataPath?: string };
    args?: Record<string, SchemaField>;
    mapping: Mapping;
    transformResponse?: EndpointResponseTransform;
}

export interface ProviderFormatters {
    userProfile: (id: number | string, mode?: string, rx?: number) => string;
    userAvatar: (id: number | string, timestamp?: number) => string;
}

export interface ProviderConfig {
    name: string;
    base: string;
    domain: string;
    cache: boolean;
    display: boolean;
    accountProvider?: string;
    linkable?: boolean;
    transforms?: Record<string, TransformConfig>;
    endpoints: Record<string, EndpointConfig>;
    formatters: ProviderFormatters;
}

export class SchemaProvider {
    constructor(
        public id: string,
        public config: ProviderConfig,
    ) {}

    static define(id: string, config: ProviderConfig) {
        return new SchemaProvider(id, config);
    }
}
