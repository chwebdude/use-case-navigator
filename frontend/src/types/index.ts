import type { RecordModel } from 'pocketbase';

export interface FactsheetType extends RecordModel {
  name: string;
  color: string;
  icon?: string;
  order?: number;
}

export interface Factsheet extends RecordModel {
  name: string;
  description: string;
  type: string;
  status: 'draft' | 'active' | 'archived';
}

export interface Dependency extends RecordModel {
  factsheet: string;
  depends_on: string;
  description?: string;
}

export interface PropertyDefinition extends RecordModel {
  name: string;
  options: string[];
  order?: number;
}

export interface FactsheetProperty extends RecordModel {
  factsheet: string;
  property: string;
  value: string;
}

// Expanded types with relations
export interface FactsheetExpanded extends Factsheet {
  expand?: {
    type?: FactsheetType;
  };
}

export interface DependencyExpanded extends Dependency {
  expand?: {
    factsheet?: Factsheet;
    depends_on?: Factsheet;
  };
}

export interface FactsheetPropertyExpanded extends FactsheetProperty {
  expand?: {
    factsheet?: Factsheet;
    property?: PropertyDefinition;
  };
}

