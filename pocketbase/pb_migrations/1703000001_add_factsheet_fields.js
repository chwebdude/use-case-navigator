/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const factsheets = app.findCollectionByNameOrId("factsheets");

  // Add new descriptive fields to factsheets
  factsheets.fields.add(new Field({
    name: "responsibility",
    type: "text",
    required: false,
  }));

  factsheets.fields.add(new Field({
    name: "benefits",
    type: "editor",
    required: false,
  }));

  factsheets.fields.add(new Field({
    name: "what_it_does",
    type: "editor",
    required: false,
  }));

  factsheets.fields.add(new Field({
    name: "problems_addressed",
    type: "editor",
    required: false,
  }));

  factsheets.fields.add(new Field({
    name: "potential_ui",
    type: "editor",
    required: false,
  }));

  app.save(factsheets);
}, (app) => {
  // Rollback - remove the added fields
  const factsheets = app.findCollectionByNameOrId("factsheets");

  factsheets.fields.removeByName("responsibility");
  factsheets.fields.removeByName("benefits");
  factsheets.fields.removeByName("what_it_does");
  factsheets.fields.removeByName("problems_addressed");
  factsheets.fields.removeByName("potential_ui");

  app.save(factsheets);
});
