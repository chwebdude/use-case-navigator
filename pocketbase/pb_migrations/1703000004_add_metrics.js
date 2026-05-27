/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // metrics collection - groups multiple properties under a named metric
    const metrics = new Collection({
        name: "metrics",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
        fields: [
            {
                name: "name",
                type: "text",
                required: true,
            },
            {
                name: "description",
                type: "text",
                required: false,
            },
            {
                name: "properties",
                type: "relation",
                required: true,
                // reference property_definitions
                collectionId: app.findCollectionByNameOrId("property_definitions").id,
                cascadeDelete: false,
                // allow multiple property selections for a metric
                maxSelect: 999,
            },
            {
                name: "order",
                type: "number",
                required: false,
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
    app.save(metrics);
}, (app) => {
    // Rollback
    try {
        const metrics = app.findCollectionByNameOrId("metrics");
        if (metrics) app.delete(metrics);
    } catch (e) {
        // ignore
    }
});
