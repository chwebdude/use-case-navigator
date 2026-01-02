/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const factsheets = app.findCollectionByNameOrId("factsheets");

  // change_log collection - tracks all changes to factsheets
  const changeLog = new Collection({
    name: "change_log",
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
        name: "username",
        type: "text",
        required: true,
      },
      {
        name: "action",
        type: "select",
        required: true,
        maxSelect: 1,
        values: [
          "created",
          "updated",
          "deleted",
          "dependency_added",
          "dependency_removed",
          "dependency_updated"
        ],
      },
      {
        name: "description",
        type: "text",
        required: true,
      },
      {
        name: "related_factsheet",
        type: "relation",
        required: false,
        collectionId: factsheets.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      {
        name: "details",
        type: "json",
        required: false,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
    ],
  });
  app.save(changeLog);
}, (app) => {
  // Rollback
  try {
    const changeLog = app.findCollectionByNameOrId("change_log");
    if (changeLog) app.delete(changeLog);
  } catch (e) {
    // Collection may not exist
  }
});
