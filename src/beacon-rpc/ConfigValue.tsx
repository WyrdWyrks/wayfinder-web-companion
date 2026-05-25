export const ConfigTypes = {
    NULL: 0,
    BOOLEAN: 1,
    INTEGER: 2,
    FLOAT: 3,
    STRING: 4,
    ARRAY: 5,
    OBJECT: 6,
    CONFIGURABLE_BOOLEAN: 7,
    CONFIGURABLE_INTEGER: 8,
    CONFIGURABLE_FLOAT: 9,
    CONFIGURABLE_STRING: 10,
    CONFIGURABLE_ENUM: 11,
} as const;
export type ConfigType = typeof ConfigTypes[keyof typeof ConfigTypes];

export type NullConfigValue = {
    cfgType: typeof ConfigTypes.NULL,
    cfgVal: null,
};

export type BooleanConfigValue = {
    cfgType: typeof ConfigTypes.BOOLEAN,
    cfgVal: boolean,
};

export type IntegerConfigValue = {
    cfgType: typeof ConfigTypes.INTEGER,
    cfgVal: number,
};

export type FloatConfigValue = {
    cfgType: typeof ConfigTypes.FLOAT,
    cfgVal: number,
};

export type StringConfigValue = {
    cfgType: typeof ConfigTypes.STRING,
    cfgVal: string,
};

export type ArrayConfigValue = {
    cfgType: typeof ConfigTypes.ARRAY,
    cfgVal: unknown[],
};

export type ObjectConfigValue = {
    cfgType: typeof ConfigTypes.OBJECT,
    cfgVal: { [key: string]: unknown },
};

export type ConfigurableBooleanConfigValue = {
    cfgType: 'bool',
    cfgVal: boolean,
};

export type ConfigurableIntegerConfigValue = {
    cfgType: 'int',
    cfgVal: number,

    minVal: number,
    maxVal: number,
    incVal: number,
};

export type ConfigurableFloatConfigValue = {
    cfgType: 'float',
    cfgVal: number,

    minVal: number,
    maxVal: number,
    incVal: number,
};

export type ConfigurableStringConfigValue = {
    cfgType: 'string',
    cfgVal: string,

    maxLen: number,
};

export type ConfigurableEnumConfigValue = {
    cfgType: 'enum',
    cfgVal: number,

    vals: number[],
    valTxt: string[],
};

export type ConfigValue =
    | NullConfigValue
    | BooleanConfigValue
    | IntegerConfigValue
    | FloatConfigValue
    | StringConfigValue
    | ArrayConfigValue
    | ObjectConfigValue
    | ConfigurableBooleanConfigValue
    | ConfigurableIntegerConfigValue
    | ConfigurableFloatConfigValue
    | ConfigurableStringConfigValue
    | ConfigurableEnumConfigValue;