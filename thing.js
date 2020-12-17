/**
 * A class to model author card
 * **/
class Thing {

    constructor(rawBody, config) {

        // Store request body and config
        this.rawBody = rawBody;
        this.config = config;

        // Parse author fields
        this._parseBody();

    };

    _flatAndStoreCompositeField(key, value) {

        // Collect composite object
        let compositeObject = {};
        let totalObject = [];

        // Collect array elements in a single array
        if(Array.isArray(value))
            value.map(el => Object.assign(compositeObject, el));
        // Or store current composite field
        else
            compositeObject = value;

        Object.keys(compositeObject).forEach((objKey) => {

            // Get and format subfield key
            let subKey = objKey.toLowerCase();
            subKey = subKey.charAt(0).toUpperCase() + subKey.slice(1);

            // Store current subfield
            if(Array.isArray(compositeObject[objKey])) {

                // Trim all strings in collection
                let trimmedField = compositeObject[objKey].map(el => el.trim());

                // Store trimmed field
                this[key + subKey] = trimmedField;
                totalObject = totalObject.concat(trimmedField)

            } else {

                // Store trimmed field
                this[key + subKey] = compositeObject[objKey].trim();
                totalObject.append(compositeObject[objKey].trim());

            }

        });

        // Store total object
        this[key] = totalObject;

    }

    _parseName() {

        // Store raw name
        this.rawName = this.name;

        // Parse name
        if(Array.isArray(this.name))
            this.name = this.name[0];

        this.name = this.name.split('(')[0];

    }

    _parseBody() {

        // Author map
        let map = this.config.getInputDictionary();

        // Map fields
        Object.keys(map).map(key => {
            if (this.rawBody[map[key]]) {

                // Handle composite fields
                if(this.config.isFieldComposite(key))
                    this._flatAndStoreCompositeField(key, this.rawBody[map[key]]);
                else {
                    if(Array.isArray(this.rawBody[map[key]]))
                        this[key] = this.rawBody[map[key]].map(el => el.trim());
                    else
                        this[key] = this.rawBody[map[key]].trim()
                }

                if(key === 'name')
                    this._parseName()

            } else if(!this[key])
                this[key] = null;
        });

    };

    getString() {
        this.string = JSON.stringify(this);
    }

}

// Exports
exports.Thing = Thing;