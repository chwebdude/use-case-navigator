/// <reference path="../pb_data/types.d.ts" />
// Adds default filter settings for each page to app_settings
migrate(
    (app) => {
        const appSettings = app.findCollectionByNameOrId("app_settings");

        // Add default filters for Factsheet List page
        appSettings.fields.add(
            new Field({
                name: "default_factsheet_filters",
                type: "json",
                required: false,
                presentable: false,
                options: {
                    maxSize: 2000000,
                },
            }),
        );

        // Add default filters for Dependencies page
        appSettings.fields.add(
            new Field({
                name: "default_dependencies_filters",
                type: "json",
                required: false,
                presentable: false,
                options: {
                    maxSize: 2000000,
                },
            }),
        );

        // Add default filters for Matrix page
        appSettings.fields.add(
            new Field({
                name: "default_matrix_filters",
                type: "json",
                required: false,
                presentable: false,
                options: {
                    maxSize: 2000000,
                },
            }),
        );

        // Add default filters for Spider page
        appSettings.fields.add(
            new Field({
                name: "default_spider_filters",
                type: "json",
                required: false,
                presentable: false,
                options: {
                    maxSize: 2000000,
                },
            }),
        );

        // Add default filters for Scatter page
        appSettings.fields.add(
            new Field({
                name: "default_scatter_filters",
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
        // Rollback: remove the fields
        const appSettings = app.findCollectionByNameOrId("app_settings");
        appSettings.fields.removeByName("default_factsheet_filters");
        appSettings.fields.removeByName("default_dependencies_filters");
        appSettings.fields.removeByName("default_matrix_filters");
        appSettings.fields.removeByName("default_spider_filters");
        appSettings.fields.removeByName("default_scatter_filters");
        app.save(appSettings);
    },
);
