/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        const appSettings = app.findCollectionByNameOrId("app_settings");

        appSettings.fields.add(
            new Field({
                name: "llm_endpoint",
                type: "text",
                required: false,
            }),
        );

        appSettings.fields.add(
            new Field({
                name: "llm_api_key",
                type: "text",
                required: false,
            }),
        );

        appSettings.fields.add(
            new Field({
                name: "llm_model",
                type: "text",
                required: false,
            }),
        );

        app.save(appSettings);
    },
    (app) => {
        const appSettings = app.findCollectionByNameOrId("app_settings");

        appSettings.fields.removeByName("llm_model");
        appSettings.fields.removeByName("llm_api_key");
        appSettings.fields.removeByName("llm_endpoint");

        app.save(appSettings);
    },
);
