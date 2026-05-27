/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        const appSettings = app.findCollectionByNameOrId("app_settings");

        appSettings.fields.add(
            new Field({
                name: "elastic_apm_server_url",
                type: "text",
                required: false,
            }),
        );

        app.save(appSettings);
    },
    (app) => {
        const appSettings = app.findCollectionByNameOrId("app_settings");

        appSettings.fields.removeByName("elastic_apm_server_url");

        app.save(appSettings);
    },
);
