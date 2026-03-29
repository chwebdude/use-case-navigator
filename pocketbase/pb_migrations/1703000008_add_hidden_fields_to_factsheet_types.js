/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const factsheetTypes = app.findCollectionByNameOrId("factsheet_types");

    factsheetTypes.fields.add(new Field({
        name: "hidden_fields",
        type: "json",
        required: false,
    }));

    app.save(factsheetTypes);
}, (app) => {
    // Rollback - remove the hidden_fields field
    const factsheetTypes = app.findCollectionByNameOrId("factsheet_types");

    factsheetTypes.fields.removeByName("hidden_fields");

    app.save(factsheetTypes);
});
