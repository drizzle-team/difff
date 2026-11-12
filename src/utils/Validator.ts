import { validateXML, type XMLValidationError } from "~/utils/helper";
import * as yaml from "js-yaml";
import { prettierJSSettings, prettierJSONSettings, prettierSQLSettings } from "~/utils/settings";
import { formatSQL, formatWithPrettier } from "~/utils/lazy";
import type { Formats } from "~/types";

class Validator {
    format: Formats;
    constructor(format: Formats) {
        this.format = format;
    }

    private validateYAML = (input: string): true | unknown => {
        try {
            yaml.load(input);
            return true;
        } catch (err) {
            return err;
        }
    };

    private validateXML = (input: string): true | XMLValidationError => validateXML(input);

    private validateJSON = (input: string): Promise<true | unknown> => {
        return formatWithPrettier(input, prettierJSONSettings)
            .then(() => {
                return true;
            })
            .catch((err) => {
                return err;
            });
    };

    private validateJS = (input: string): Promise<true | unknown> => {
        return formatWithPrettier(input, prettierJSSettings)
            .then(() => {
                return true;
            })
            .catch((err) => {
                return err;
            });
    };

    private validateSQL = async (input: string): Promise<true | unknown> => {
        try {
            await formatSQL(input, prettierSQLSettings);
            return true;
        } catch (err) {
            return err;
        }
    };

    public validate = (userInput: string) => {
        if (this.format === "json") return this.validateJSON(userInput);

        if (this.format === "xml") return this.validateXML(userInput);

        if (this.format === "yaml") return this.validateYAML(userInput);

        if (this.format === "js") return this.validateJS(userInput);

        if (this.format === "sql") return this.validateSQL(userInput);
    };
}

export default Validator;
