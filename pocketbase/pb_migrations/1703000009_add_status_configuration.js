/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        const appSettings = app.findCollectionByNameOrId("app_settings");
        appSettings.fields.add(
            new Field({
                name: "statuses",
                type: "json",
                required: false,
                presentable: false,
                options: {
                    maxSize: 2000000,
                },
            }),
        );
        app.save(appSettings);

        const factsheetTypes = app.findCollectionByNameOrId("factsheet_types");
        factsheetTypes.fields.add(
            new Field({
                name: "status_overrides",
                type: "json",
                required: false,
                presentable: false,
                options: {
                    maxSize: 2000000,
                },
            }),
        );
        app.save(factsheetTypes);

        const factsheets = app.findCollectionByNameOrId("factsheets");
        factsheets.fields.add(
            new Field({
                name: "status_id",
                type: "text",
                required: false,
            }),
        );
        app.save(factsheets);
    },
    (app) => {
        const factsheets = app.findCollectionByNameOrId("factsheets");
        factsheets.fields.removeByName("status_id");
        app.save(factsheets);

        const factsheetTypes = app.findCollectionByNameOrId("factsheet_types");
        factsheetTypes.fields.removeByName("status_overrides");
        app.save(factsheetTypes);

        const appSettings = app.findCollectionByNameOrId("app_settings");
        appSettings.fields.removeByName("statuses");
        app.save(appSettings);
    },
);
