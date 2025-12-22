/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // factsheet_types collection - defines types like "Use Case", "Knowledge", "Data Source"
  const factsheetTypes = new Collection({
    name: "factsheet_types",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
      },
      {
        name: "color",
        type: "text",
        required: true,
      },
      {
        name: "icon",
        type: "text",
        required: false,
      },
      {
        name: "order",
        type: "number",
        required: false,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
    ],
  });
  app.save(factsheetTypes);

  // factsheets collection - generic factsheets with a type
  const factsheets = new Collection({
    name: "factsheets",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
      },
      {
        name: "description",
        type: "text",
        required: false,
      },
      {
        name: "type",
        type: "relation",
        required: true,
        collectionId: factsheetTypes.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["draft", "active", "archived"],
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
    ],
  });
  app.save(factsheets);

  // dependencies collection
  const dependencies = new Collection({
    name: "dependencies",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      {
        name: "factsheet",
        type: "relation",
        required: true,
        collectionId: factsheets.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "depends_on",
        type: "relation",
        required: true,
        collectionId: factsheets.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      {
        name: "description",
        type: "text",
        required: false,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
    ],
  });
  app.save(dependencies);

  // property_definitions collection - enum only
  const propertyDefinitions = new Collection({
    name: "property_definitions",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
      },
      {
        name: "options",
        type: "json",
        required: true,
      },
      {
        name: "order",
        type: "number",
        required: false,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
    ],
  });
  app.save(propertyDefinitions);

  // factsheet_properties collection
  const factsheetProperties = new Collection({
    name: "factsheet_properties",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      {
        name: "factsheet",
        type: "relation",
        required: true,
        collectionId: factsheets.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "property",
        type: "relation",
        required: true,
        collectionId: propertyDefinitions.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "value",
        type: "text",
        required: true,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
    ],
  });
  app.save(factsheetProperties);
}, (app) => {
  // Rollback
  const collections = [
    "factsheet_properties",
    "property_definitions",
    "dependencies",
    "factsheets",
    "factsheet_types"
  ];

  collections.forEach((name) => {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (col) app.delete(col);
    } catch (e) {
      // Collection may not exist
    }
  });
});
