import type { FormatJSONError, FormatYamlError } from "~/types";
import { SyntaxValidator } from "fast-xml-validator";

export const isJSONError = (error: unknown): error is FormatJSONError => {
    return <FormatJSONError>error !== undefined && (<FormatJSONError>error).loc !== undefined;
};

export const isYamlError = (error: unknown): error is FormatYamlError => {
    return (
        <FormatYamlError>error !== undefined &&
        (<FormatYamlError>error).mark !== undefined &&
        (<FormatYamlError>error).mark.line !== undefined &&
        (<FormatYamlError>error).mark.position !== undefined &&
        (<FormatYamlError>error).reason !== undefined
    );
};

export type XMLValidationError = {
    err: { code: string; msg: string; line: number; col: number };
};

/**
 * fast-xml-validator throws on invalid XML; keep the `true | { err }` result shape
 * that the editor's error highlighting expects (it was fast-xml-parser's API).
 */
export const validateXML = (
    input: string,
    allowBooleanAttributes = false
): true | XMLValidationError => {
    try {
        return SyntaxValidator.validate(input, { allowBooleanAttributes });
    } catch (error) {
        const { code, line, col, message } = error as Error &
            Partial<{ code: string; line: number; col: number }>;
        return {
            err: { code: code ?? "InvalidXml", msg: message, line: line ?? 1, col: col ?? 0 }
        };
    }
};

export const isXMLError = (error: unknown): error is XMLValidationError => {
    return (
        <XMLValidationError>error !== undefined &&
        (<XMLValidationError>error).err !== undefined &&
        (<XMLValidationError>error).err.line !== undefined &&
        (<XMLValidationError>error).err.msg !== undefined
    );
};

export const isURL = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

export const getErrorLine = (error: Error) => {
    const matchLineNum = error.message.match(/line (\d+)/);
    if (matchLineNum && matchLineNum[1]) return +matchLineNum[1];
    return 0;
};
