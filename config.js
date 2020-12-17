/**
 * A class to parse user configurations
 * **/

class Config {

    constructor(config) {

        // Store configuration JSON
        this.config = config;

        // Parse composite fields
        this._parseCompositeFields()

    }

    _parseCompositeFields() {

        let configFields = this.config.fields;

        Object.keys(configFields).forEach((key) => {
            if(configFields[key].composite) {
                configFields[key].composite.map(el => {

                    // Capitalize current subfield
                    el = el.charAt(0).toUpperCase() + el.slice(1);
                    let newKey = key + el;

                    // Copy parent field
                    this.config.fields[newKey] = JSON.parse(JSON.stringify(configFields[key]));

                    // Translate subfields as principal fields
                    if (this.config.fields[newKey].input)
                        this.config.fields[newKey].input = configFields[key].input + el;

                    if (this.config.fields[newKey].wikidata)
                        this.config.fields[newKey].wikidata = configFields[key].wikidata + el;

                    if (this.config.fields[newKey].viaf)
                        this.config.fields[newKey].viaf = configFields[key].viaf + el;

                    if (this.config.fields[newKey].label)
                        this.config.fields[newKey].label = configFields[key].label + ' ' + el.toUpperCase();

                    delete this.config.fields[newKey].composite;

                });

            }
        })

    }

    getConfig() {
        return this.config;
    }

    getInputDictionary() {

        let inputDictionary = {};

        // Map config fields to get dictionary
        Object.keys(this.config.fields).map(el => inputDictionary[el] = this.config.fields[el].input);

        return inputDictionary;

    }

    getOutputDectionary() {

        let outputDictionary = {};

        // Map config fields to get dictionary
        Object.keys(this.config.fields).map(el => outputDictionary[this.config.fields[el].input] = el);

        return outputDictionary;

    }

    getWikidataDictionary() {

        let wikidataDictionary = {};

        // Map config fields to get dictionary
        Object.keys(this.config.fields).map(el => wikidataDictionary[el] = this.config.fields[el].wikidata);

        return wikidataDictionary;

    }

    getViafDictionary() {

        let viafDictionary = {};

        // Map config fields to get dictionary
        Object.keys(this.config.fields).map(el => viafDictionary[el] = this.config.fields[el].viaf);

        return viafDictionary;

    }

    getToFormatFields() {
        return Object.keys(this.config.fields).filter(el => this.config.fields[el].format)
    }

    isFieldComposite(field) {
        return this.config.fields[field].composite;
    }

}

// Exports
exports.Config = Config;