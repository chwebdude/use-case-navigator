/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // use_cases collection
  const useCases = new Collection({
    name: "use_cases",
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
  app.save(useCases);

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
        name: "use_case",
        type: "relation",
        required: true,
        collectionId: useCases.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["data", "knowledge", "system"],
      },
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
        name: "depends_on",
        type: "relation",
        required: false,
        collectionId: useCases.id,
        cascadeDelete: false,
        maxSelect: 1,
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

  // property_definitions collection
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
        name: "type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["enum", "number", "text"],
      },
      {
        name: "options",
        type: "json",
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
  app.save(propertyDefinitions);

  // use_case_properties collection
  const useCaseProperties = new Collection({
    name: "use_case_properties",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      {
        name: "use_case",
        type: "relation",
        required: true,
        collectionId: useCases.id,
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
  app.save(useCaseProperties);
}, (app) => {
  // Rollback
  const collections = [
    "use_case_properties",
    "property_definitions",
    "dependencies",
    "use_cases"
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
