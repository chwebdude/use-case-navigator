# URL State Preservation Implementation

## Overview

This implementation adds URL query parameter synchronization across all major pages in the Use Case Navigator application. Filter states and configurations are now automatically preserved in the URL, allowing users to:
* Share filtered views with others via URL
* Maintain filter state when navigating between pages
* Restore previous configurations when revisiting pages

## Changes Made

### 1. New Custom Hook: `useQueryState`

**File:** `src/hooks/useQueryState.ts`

Created two new hooks for managing state synchronized with URL query parameters:

#### `useQueryState<T>(key, initialValue, options?)`

* Manages a single query parameter
* Automatically reads initial state from URL on mount
* Debounced updates to URL (default 300ms) to prevent excessive navigation events
* Similar API to `useState` but with URL synchronization

#### `useQueryStates<T>(initialValues, options?)`

* Manages multiple query parameters at once
* More efficient than calling `useQueryState` multiple times
* Returns object with all state values and a setter function

**Features:**
* Automatic serialization/deserialization of complex types (arrays, objects)
* Cleans up empty parameters from URL
* Debounced URL updates to prevent performance issues
* Supports callback-based updates for complex state mutations

### 2. Updated Pages with URL State Preservation

#### FactsheetList ( `src/pages/FactsheetList.tsx` )

* **URL Parameters:**
  + `search`: Search query text
  + `statusFilter`: Factsheet status filter
  + `typeFilter`: Factsheet type filter
  + `propertyFilters`: Property-based filtering (JSON object)

#### DependenciesPage ( `src/pages/DependenciesPage.tsx` )

* **URL Parameters:**
  + `typeFilter`: Factsheet type filter
  + `statusFilter`: Factsheet status filter
  + `propertyFilters`: Property-based filtering
  + `displayProperties`: Properties to display on nodes (array)
  + `showComments`: Show/hide comments on dependencies
  + `focusedFactsheetId`: Currently focused factsheet for focus mode
  + `unrelatedDisplayMode`: Display mode for unrelated items ('dim' or 'hide')

#### MatrixPage ( `src/pages/MatrixPage.tsx` )

* **URL Parameters:**
  + `xAxis`: Property selected for X-axis
  + `yAxis`: Property selected for Y-axis
  + `typeFilter`: Factsheet type filter
  + `statusFilter`: Factsheet status filter
  + `propertyFilters`: Property-based filtering
  + `displayProperties`: Additional properties to display (array)

#### ScatterPage ( `src/pages/ScatterPage.tsx` )

* **URL Parameters:**
  + `search`: Search query text
  + `statusFilter`: Factsheet status filter
  + `typeFilter`: Factsheet type filter
  + `propertyFilters`: Property-based filtering
  + `xAxis`: Property selected for X-axis
  + `yAxis`: Property selected for Y-axis

#### SpiderPage ( `src/pages/SpiderPage.tsx` )

* **URL Parameters:**
  + `search`: Search query text
  + `statusFilter`: Factsheet status filter
  + `typeFilter`: Factsheet type filter
  + `propertyFilters`: Property-based filtering
  + `selectedMetrics`: Selected metrics to display (array, stored as JSON)

## Technical Details

### URL Parameter Encoding

* Simple string and number values are stored directly
* Arrays and objects are serialized as JSON
* Empty values are removed from the URL for cleanliness

### Performance Optimization

* URL updates are debounced (300ms default) to prevent excessive re-renders
* Uses `replace: true` in navigation to avoid polluting browser history
* Only updates URL when the value actually changes

### State Initialization

* On component mount, the hook reads from URL query parameters
* Falls back to provided `initialValue` if parameter not present
* Supports complex types through JSON serialization

## User Experience Improvements

1. **Shareable Filters:** Users can copy the URL and share their current view with others
2. **Session Persistence:** Navigating between pages and returning to a page restores filters
3. **Bookmarkable States:** Important configurations can be bookmarked for quick access
4. **Browser Back/Forward:** Navigation history now reflects filter state changes

## Example Usage

```typescript
import { useQueryStates } from '../hooks/useQueryState';

export function MyPage() {
  const [state, setState] = useQueryStates({
    search: '',
    statusFilter: '',
    typeFilter: '',
  });

  return (
    <input
      value={state.search}
      onChange={(e) => setState('search', e.target.value)}
    />
  );
}
```

The URL will automatically update to: `?search=myquery&statusFilter=active&typeFilter=abc123`

## Browser Compatibility

Works with all modern browsers that support URLSearchParams API (all modern versions)
