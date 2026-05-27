# How to Set Default Filters

## Overview

The system now stores default filters for each visualization page. Users can set these defaults through the Settings page.

## Step-by-Step Setup

### 1. **Run the Migration**

First, update your PocketBase schema to add the new fields:

```bash
cd pocketbase
./pocketbase serve
```

The migration `1703000006_add_default_filters.js` will automatically run and add these fields to the `app_settings` collection:
* `default_factsheet_filters` (json)
* `default_dependencies_filters` (json)
* `default_matrix_filters` (json)
* `default_spider_filters` (json)
* `default_scatter_filters` (json)

### 2. **Using the SaveDefaultsButton Component**

On each page (FactsheetList, DependenciesPage, MatrixPage, SpiderPage, ScatterPage), you can add a button that lets users save the current filters as defaults.

**Example for FactsheetList:**

```tsx
import { SaveDefaultsButton } from "../components/SaveDefaultsButton";
import { useAppSettings } from "../hooks/useAppSettings";

export default function FactsheetList() {
  const { setSettings: setAppSettings } = useAppSettings();
  const [state, setState] = useQueryStates({
    search: "",
    statusFilter: "",
    typeFilter: "",
    propertyFilters: {} as Record<string, string>,
  });

  // ... existing code ...

  return (
    <div>
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <h1>Factsheets</h1>
        <SaveDefaultsButton
          type="factsheet"
          filters={state}
          onSave={(filters) => {
            setAppSettings({ defaultFactsheetFilters: filters });
          }}
        />
      </div>
      {/* ... rest of page ... */}
    </div>
  );
}
```

### 3. **Settings Page**

The Settings page ( `/settings` ) now displays all configured defaults with a "Clear Defaults" button for each:
* Shows what filters are currently saved
* Allows clearing individual page defaults
* Helps users understand what will be applied to each page

## How It Works

### Data Flow:

1. User navigates to a page (e.g., `/factsheets`)
2. Page loads filters from URL query parameters
3. If no query parameters exist → fallback to `useAppSettings().settings.defaultFactsheetFilters`
4. User sets filters as desired
5. User clicks "Save as Factsheet Default" button
6. Defaults are stored in PocketBase `app_settings` collection
7. Next time they (or any user) visits with no filters → defaults apply

### On Each Page:

To implement, integrate `SaveDefaultsButton` in your page header/toolbar:

```tsx
// Import the component and hook
import { SaveDefaultsButton } from "../components/SaveDefaultsButton";
import { useAppSettings } from "../hooks/useAppSettings";

// In your component:
const { setSettings: setAppSettings } = useAppSettings();

// In your JSX:
<SaveDefaultsButton
  type="factsheet"
  filters={state}
  onSave={(filters) => {
    setAppSettings({ defaultFactsheetFilters: filters });
  }}
/>
```

## Database Schema

The `app_settings` collection now includes (JSON fields):
* `default_factsheet_filters`: `{ search?, statusFilter?, typeFilter? }`
* `default_dependencies_filters`: `{ search?, typeFilter?, statusFilter?, displayProperties?, showComments?, unrelatedDisplayMode? }`
* `default_matrix_filters`: `{ search?, xAxis?, yAxis?, typeFilter?, statusFilter?, displayProperties? }`
* `default_spider_filters`: `{ search?, statusFilter?, typeFilter?, selectedMetrics?, axisMode? }`
* `default_scatter_filters`: `{ search?, statusFilter?, typeFilter?, xAxis?, yAxis?, axisMode? }`

All fields are optional - only include filters you want to set as defaults.

## Example Usage Flow

1. User opens `/dependencies`
2. They set filters: `search=AI`, `typeFilter=UseCase`, `unrelatedDisplayMode=hide`
3. They click "Save as Dependencies Default"
4. Next user (or same user in new session) opens `/dependencies` without query params
5. The page automatically applies: `search=AI`, `typeFilter=UseCase`, `unrelatedDisplayMode=hide`
6. User can still override by changing filters manually

## Clearing Defaults

Users can clear defaults in two ways:
1. **Via Settings Page**: Click "Clear Defaults" button for each page
2. **Code**: Set the corresponding field to `null` or `{}`
