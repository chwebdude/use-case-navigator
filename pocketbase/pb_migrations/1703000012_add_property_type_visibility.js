/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const propertyDefinitions = app.findCollectionByNameOrId(
      "property_definitions",
    );
    const factsheetTypes = app.findCollectionByNameOrId("factsheet_types");

    propertyDefinitions.fields.add(
      new Field({
        name: "factsheet_types",
        type: "relation",
        required: false,
        collectionId: factsheetTypes.id,
        cascadeDelete: false,
        maxSelect: 999,
      }),
    );

    app.save(propertyDefinitions);
  },
  (app) => {
    const propertyDefinitions = app.findCollectionByNameOrId(
      "property_definitions",
    );

    propertyDefinitions.fields.removeByName("factsheet_types");

    app.save(propertyDefinitions);
  },
);
