/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // app_settings collection - stores global application settings
  const appSettings = new Collection({
    name: "app_settings",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null, // Prevent deletion
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "icon",
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
  app.save(appSettings);

  // Create default settings record
  const record = new Record(appSettings, {
    title: "Use Case Navigator",
    icon: "Cpu",
  });
  app.save(record);
}, (app) => {
  // Rollback
  try {
    const appSettings = app.findCollectionByNameOrId("app_settings");
    if (appSettings) app.delete(appSettings);
  } catch (e) {
    // Collection may not exist
  }
});
