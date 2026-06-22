/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const factsheets = app.findCollectionByNameOrId("factsheets");

    factsheets.fields.add(
      new Field({
        name: "reviewed",
        type: "bool",
        required: false,
      }),
    );

    factsheets.fields.add(
      new Field({
        name: "review_comment",
        type: "text",
        required: false,
      }),
    );

    factsheets.fields.add(
      new Field({
        name: "reviewed_by",
        type: "text",
        required: false,
      }),
    );

    factsheets.fields.add(
      new Field({
        name: "reviewed_at",
        type: "text",
        required: false,
      }),
    );

    app.save(factsheets);
  },
  (app) => {
    const factsheets = app.findCollectionByNameOrId("factsheets");

    factsheets.fields.removeByName("reviewed");
    factsheets.fields.removeByName("review_comment");
    factsheets.fields.removeByName("reviewed_by");
    factsheets.fields.removeByName("reviewed_at");

    app.save(factsheets);
  },
);
