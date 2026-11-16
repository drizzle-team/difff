export const prettierJSONSettings = {
    semi: true,
    singleQuote: false,
    trailingComma: "none" as const,
    endOfLine: "lf" as const,
    printWidth: 100,
    bracketSameLine: true,
    parser: "json-stringify"
};

export const prettierJSSettings = {
    semi: true,
    singleQuote: false,
    trailingComma: "none" as const,
    endOfLine: "lf" as const,
    printWidth: 80,
    bracketSameLine: true,
    bracketSpacing: true,
    parser: "babel"
};

export const prettierSQLSettings = {
    keywordCase: "upper" as const,
    dataTypeCase: "upper" as const,
    functionCase: "upper" as const,
    linesBetweenQueries: 1,
    logicalOperatorNewline: "before" as const,
    expressionWidth: 80,
    denseOperators: false,
    newlineBeforeSemicolon: false,
    paramTypes: { custom: [{ regex: String.raw`\{\w+\}` }] }
};
