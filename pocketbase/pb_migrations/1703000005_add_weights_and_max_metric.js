/// <reference path="../pb_data/types.d.ts" />
// Adds weight to property_options and max_metric_weight to app_settings
migrate(
    (app) => {
        // Add weight to property_options
        const propertyOptions = app.findCollectionByNameOrId("property_options");
        propertyOptions.fields.add(
            new Field({
                name: "weight",
                type: "number",
                required: false,
                presentable: false,
                unique: false,
                options: {
                    min: 0,
                    max: null,
                    noDecimal: false,
                },
            }),
        );
        app.save(propertyOptions);

        // Add max_metric_weight to app_settings
        const appSettings = app.findCollectionByNameOrId("app_settings");
        appSettings.fields.add(
            new Field({
                name: "max_metric_weight",
                type: "number",
                required: false,
                presentable: false,
                unique: false,
                options: {
                    min: 0,
                    max: null,
                    noDecimal: false,
                },
            }),
        );
        app.save(appSettings);
    },
    (app) => {
        // Remove weight from property_options
        const propertyOptions = app.findCollectionByNameOrId("property_options");
        propertyOptions.fields.removeByName("weight");
        app.save(propertyOptions);

        // Remove max_metric_weight from app_settings
        const appSettings = app.findCollectionByNameOrId("app_settings");
        appSettings.fields.removeByName("max_metric_weight");
        app.save(appSettings);
    },
);
