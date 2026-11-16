import type { Options as PrettierOptions } from "prettier";
import type { FormatOptions as SQLFormatOptions } from "sql-formatter";

/**
 * Prettier (~620 kB) and sql-formatter are only needed on JSON/JS and SQL pages,
 * so they are loaded on first use instead of being bundled into every tool page.
 */
export const formatWithPrettier = async (input: string, options: PrettierOptions) => {
    const [prettier, babel, estree] = await Promise.all([
        import("prettier/standalone"),
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree")
    ]);
    return prettier.format(input, { ...options, plugins: [babel, estree] });
};

export const formatSQL = async (input: string, options: Partial<SQLFormatOptions>) => {
    // formatDialect + a single dialect keeps the other ~20 SQL dialects out of the bundle.
    const { formatDialect, sql } = await import("sql-formatter");
    return formatDialect(input, { ...options, dialect: sql });
};
