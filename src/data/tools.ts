import type { ConversionName } from "~/utils/Converter";
import type { Formats, Tools } from "~/types";

type SingleEditor = {
    kind: "single";
    tool: Exclude<Tools, "converter">;
    format: Formats;
    placeholder: string;
    label: string;
};

type DoubleEditor = {
    kind: "double";
    formatLeft: Formats;
    placeholderLeft: string;
    labelLeft: string;
    formatRight: Formats;
    placeholderRight: string;
    labelRight: string;
    /** Kept as-is from the SvelteKit pages, including the swapped json/yaml helpers. */
    convert: ConversionName;
};

export type ToolPage = {
    /** URL path without trailing slash, "/" for the home page. */
    path: string;
    title: string;
    description: string;
    heading: string;
    subheading: string;
    /** Entry id in the `tools` content collection (src/content/tools). */
    article?: string;
    /** ISO date used for the sitemap's <lastmod>. */
    lastmod: string;
    editor: SingleEditor | DoubleEditor;
};

export const toolPages: ToolPage[] = [
    {
        path: "/",
        title: "Difff | JSON Formatter Online Tool, Beautifier & Validator",
        description:
            "Format, Minify & Validate JSON Online with difff.app. Our online tool provides JSON pretty print, minifies, beautifies, and converts text files.",
        heading: "JSON Formatter Online",
        subheading: "Validate, Format and Beautify your JSON",
        article: "formatters/json",
        lastmod: "2024-02-19",
        editor: {
            kind: "single",
            tool: "formatter",
            format: "json",
            placeholder: "Provide a JSON, link, or Drag & Drop a file",
            label: "JSON format field"
        }
    },
    {
        path: "/converter/json-to-xml",
        title: "JSON to XML Converter Online Tool | Difff",
        description:
            "Convert JSON to XML Online with difff.app. Our online tool will provide JSON and XML pretty print, beautifies, and validate it.",
        heading: "JSON to XML Converter Online",
        subheading: "Convert JSON to XML, Validate and Prettify it.",
        article: "converters/json-xml",
        lastmod: "2024-03-25",
        editor: {
            kind: "double",
            formatLeft: "json",
            placeholderLeft: "Provide a JSON, link, or Drag & Drop a file",
            labelLeft: "JSON to convert field",
            formatRight: "xml",
            placeholderRight: "Converted XML output",
            labelRight: "XML converted field",
            convert: "jsonToXml"
        }
    },
    {
        path: "/converter/json-to-yaml",
        title: "JSON to YAML Converter Online Tool | Difff",
        description:
            "Convert JSON to YAML Online with difff.app. Online tool provides JSON validation and formatting, convert it to YAML with pretty print.",
        heading: "JSON to YAML Converter Online",
        subheading: "Convert JSON format into YAML, with formatted and beautified output.",
        article: "converters/json-yaml",
        lastmod: "2024-03-25",
        editor: {
            kind: "double",
            formatLeft: "json",
            placeholderLeft: "Provide a JSON, link, or Drag & Drop a file",
            labelLeft: "JSON to convert field",
            formatRight: "yaml",
            placeholderRight: "Converted YAML output",
            labelRight: "YAML converted field",
            convert: "yamlToJson"
        }
    },
    {
        path: "/converter/xml-to-json",
        title: "XML to JSON Converter Online Tool | Difff",
        description:
            "XML to JSON Online converter. Our online tool provides XML validation and formatting, converting to JSON.",
        heading: "XML to JSON Converter Online",
        subheading: "Convert XML to JSON, after validation with pretty formatted output.",
        article: "converters/xml-json",
        lastmod: "2024-03-25",
        editor: {
            kind: "double",
            formatLeft: "xml",
            placeholderLeft: "Provide a XML or Drag & Drop a file",
            labelLeft: "XML to convert field",
            formatRight: "json",
            placeholderRight: "Converted JSON output",
            labelRight: "JSON converted field",
            convert: "xmlToJson"
        }
    },
    {
        path: "/converter/xml-to-yaml",
        title: "XML to YAML Converter Online Tool | Difff",
        description:
            "Online XML to YAML converting with difff.app. Tool provides YAML validate, beautify and converting to XML with output formatting.",
        heading: "XML to YAML Converter Online",
        subheading: "Transform XML into YAML format, with validation, the output beautify.",
        article: "converters/xml-yaml",
        lastmod: "2024-03-25",
        editor: {
            kind: "double",
            formatLeft: "xml",
            placeholderLeft: "Provide a XML, or Drag & Drop a file",
            labelLeft: "XML to convert field",
            formatRight: "yaml",
            placeholderRight: "Converted YAML output",
            labelRight: "YAML converted field",
            convert: "xmlToYaml"
        }
    },
    {
        path: "/converter/yaml-to-json",
        title: "YAML to JSON Converter Online Tool",
        description: "difff.app provides converting YAML to JSON with validation and pretty print.",
        heading: "YAML to JSON Converter Online",
        subheading: "Validate YAML, converter it to JSON with output pretty print.",
        article: "converters/yaml-json",
        lastmod: "2024-03-25",
        editor: {
            kind: "double",
            formatLeft: "yaml",
            placeholderLeft: "Provide a YAML, or Drag & Drop a file",
            labelLeft: "YAML to convert field",
            formatRight: "json",
            placeholderRight: "Converted JSON output",
            labelRight: "JSON converted field",
            convert: "jsonToYaml"
        }
    },
    {
        path: "/converter/yaml-to-xml",
        title: "Difff | YAML to XML Converter Online Tool",
        description:
            "Converter YAML to XML Online with difff.app. Our online tool provides YAML and XML  pretty print, beautifies, and converts it.",
        heading: "YAML to XML Converter Online",
        subheading: "Convert YAML to XML, Validate and Prettify it.",
        article: "converters/yaml-xml",
        lastmod: "2024-03-25",
        editor: {
            kind: "double",
            formatLeft: "yaml",
            placeholderLeft: "Provide a YAML, or Drag & Drop a file",
            labelLeft: "YAML to convert field",
            formatRight: "xml",
            placeholderRight: "Converted XML output",
            labelRight: "XML converted field",
            convert: "yamlToXml"
        }
    },
    {
        path: "/formatter/sql",
        title: "SQL Formatter Online, Formatter and Beautifier for SQL Statements | Difff",
        description:
            "Format, Validate & Beautify SQL Statements Online with difff.app. Our online tool provides SQL pretty print, beautifies, and converts text files effortlessly.",
        heading: "SQL Formatter Online",
        subheading: "Perform SQL Statements Validation, Format, and Prettify.",
        lastmod: "2024-04-19",
        editor: {
            kind: "single",
            tool: "formatter",
            format: "sql",
            placeholder: "Put your SQL or Drag & Drop a file",
            label: "SQL format field"
        }
    },
    {
        path: "/formatter/xml",
        title: "XML Formatter Online Tool, Beautifier & Validator | Difff",
        description:
            "Format, Validate & Minify XML Online with difff.app. Our online tool provides XML pretty print, minify, beautifies, and converts text files effortlessly.",
        heading: "XML Formatter Online",
        subheading: "Validate, Format and Prettify your XML",
        article: "formatters/xml",
        lastmod: "2024-03-12",
        editor: {
            kind: "single",
            tool: "formatter",
            format: "xml",
            placeholder: "Put your XML or Drag & Drop a file",
            label: "XML format field"
        }
    },
    {
        path: "/formatter/yaml",
        title: "YAML Formatter Online Tool, Beautifier & Validator | Difff",
        description:
            "Format & Validate YAML Online with difff.app. Our online tool provides YAML pretty print, beautifies, and converts text files effortlessly.",
        heading: "YAML Formatter Online",
        subheading: "Validate, Format and Prettify your YAML",
        article: "formatters/yaml",
        lastmod: "2024-02-28",
        editor: {
            kind: "single",
            tool: "formatter",
            format: "yaml",
            placeholder: "Put your YAML or Drag & Drop a file",
            label: "YAML format field"
        }
    },
    {
        path: "/minifier/js",
        title: "JavaScript Minifier Online, Minify Tool | Difff",
        description:
            "Minify, formatted JavaScript Online with difff.app. Our online tool provides minified JavaScript pretty print.",
        heading: "JavaScript Minifier Online",
        subheading: "Validate and Minify your JavaScript.",
        article: "minifiers/js",
        lastmod: "2024-03-29",
        editor: {
            kind: "single",
            tool: "minifier",
            format: "js",
            placeholder: "Provide a JavaScript, or Drag & Drop a file",
            label: "JavaScript format field"
        }
    },
    {
        path: "/minifier/json",
        title: "Online JSON Minify, Validator, Minifier Tool | Difff",
        description: "Using difff.app minify JSON. Get formatted and beautified output result.",
        heading: "JSON Minifier Online",
        subheading: "Minimize the size of valid JSON.",
        article: "minifiers/json",
        lastmod: "2024-03-29",
        editor: {
            kind: "single",
            tool: "minifier",
            format: "json",
            placeholder: "Provide a JSON, link, or Drag & Drop a file",
            label: "JSON format field"
        }
    },
    {
        path: "/minifier/xml",
        title: "XML Minifier Online Tool. Minify & Validate",
        description:
            "Minify, formatted XML Online with Our online tool. Difff.app offers XML pretty-printing, minification, beautification, and text file conversion.",
        heading: "XML Minifier Online",
        subheading: "Confirm XML's Validity and Reduce its Size.",
        article: "minifiers/xml",
        lastmod: "2024-03-29",
        editor: {
            kind: "single",
            tool: "minifier",
            format: "xml",
            placeholder: "Provide a XML, link, or Drag & Drop a file",
            label: "XML format field"
        }
    }
];
