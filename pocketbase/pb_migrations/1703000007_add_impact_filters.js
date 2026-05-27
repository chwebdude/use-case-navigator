/// <reference path="../pb_data/types.d.ts" />
// Adds default filter settings for Impact Analysis page to app_settings
migrate(
    (app) => {
        const appSettings = app.findCollectionByNameOrId("app_settings");

        // Add default filters for Impact Analysis page
        appSettings.fields.add(
            new Field({
                name: "default_impact_filters",
                type: "json",
                required: false,
                presentable: false,
                options: {
                    maxSize: 2000000,
                },
            }),
        );

        app.save(appSettings);
    },
    (app) => {
        // Rollback: remove the field
        const appSettings = app.findCollectionByNameOrId("app_settings");
        appSettings.fields.removeByName("default_impact_filters");
        app.save(appSettings);
    },
);
