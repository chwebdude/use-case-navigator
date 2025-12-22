import type { RecordModel } from 'pocketbase';

export interface UseCase extends RecordModel {
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  owner: string;
}

export interface Dependency extends RecordModel {
  use_case: string;
  type: 'data' | 'knowledge' | 'system';
  name: string;
  description: string;
  depends_on?: string;
}

export interface PropertyDefinition extends RecordModel {
  name: string;
  type: 'enum' | 'number' | 'text';
  options?: string[];
  order: number;
}

export interface UseCaseProperty extends RecordModel {
  use_case: string;
  property: string;
  value: string;
}

export interface User extends RecordModel {
  email: string;
  name: string;
  avatar?: string;
}

// Expanded types with relations
export interface UseCaseExpanded extends UseCase {
  expand?: {
    owner?: User;
  };
}

export interface DependencyExpanded extends Dependency {
  expand?: {
    use_case?: UseCase;
    depends_on?: UseCase;
  };
}

export interface UseCasePropertyExpanded extends UseCaseProperty {
  expand?: {
    use_case?: UseCase;
    property?: PropertyDefinition;
  };
}
