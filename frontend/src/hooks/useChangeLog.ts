import { useCallback } from 'react';
import pb from '../lib/pocketbase';
import { useUser } from './useUser';
import type { ChangeAction } from '../types';

interface FieldChange {
  field: string;
  oldValue?: string;
  newValue?: string;
}

interface LogChangeParams {
  factsheetId: string;
  action: ChangeAction;
  description: string;
  relatedFactsheetId?: string;
  details?: Record<string, unknown>;
}

export function useChangeLog() {
  const { username } = useUser();

  const logChange = useCallback(
    async ({
      factsheetId,
      action,
      description,
      relatedFactsheetId,
      details,
    }: LogChangeParams) => {
      if (!username) {
        console.warn('Cannot log change: no username set');
        return;
      }

      try {
        await pb.collection('change_log').create({
          factsheet: factsheetId,
          username,
          action,
          description,
          related_factsheet: relatedFactsheetId || null,
          details: details || null,
        });
      } catch (err) {
        console.error('Failed to log change:', err);
      }
    },
    [username]
  );

  const logFactsheetCreated = useCallback(
    async (factsheetId: string, factsheetName: string) => {
      await logChange({
        factsheetId,
        action: 'created',
        description: `Created factsheet "${factsheetName}"`,
      });
    },
    [logChange]
  );

  const logFactsheetUpdated = useCallback(
    async (
      factsheetId: string,
      _factsheetName: string,
      fieldChanges: FieldChange[]
    ) => {
      if (fieldChanges.length === 0) return;

      // Build a detailed description
      const changeDescriptions = fieldChanges.map((change) => {
        if (change.oldValue && change.newValue) {
          return `${change.field}: "${change.oldValue}" → "${change.newValue}"`;
        } else if (change.newValue) {
          return `${change.field}: set to "${change.newValue}"`;
        } else if (change.oldValue) {
          return `${change.field}: cleared (was "${change.oldValue}")`;
        }
        return `${change.field}: changed`;
      });

      await logChange({
        factsheetId,
        action: 'updated',
        description: `Updated ${changeDescriptions.join(', ')}`,
        details: { fieldChanges },
      });
    },
    [logChange]
  );

  const logPropertyChanged = useCallback(
    async (
      factsheetId: string,
      propertyName: string,
      oldValue: string | null,
      newValue: string | null
    ) => {
      let description: string;
      if (!oldValue && newValue) {
        description = `Set ${propertyName} to "${newValue}"`;
      } else if (oldValue && !newValue) {
        description = `Cleared ${propertyName} (was "${oldValue}")`;
      } else {
        description = `Changed ${propertyName}: "${oldValue}" → "${newValue}"`;
      }

      await logChange({
        factsheetId,
        action: 'updated',
        description,
        details: { propertyName, oldValue, newValue },
      });
    },
    [logChange]
  );

  const logDependencyAdded = useCallback(
    async (
      sourceFactsheetId: string,
      sourceFactsheetName: string,
      targetFactsheetId: string,
      targetFactsheetName: string,
      dependencyDescription?: string
    ) => {
      const descSuffix = dependencyDescription
        ? ` (${dependencyDescription})`
        : '';

      // Log for the source factsheet (the one that depends)
      await logChange({
        factsheetId: sourceFactsheetId,
        action: 'dependency_added',
        description: `Added dependency on "${targetFactsheetName}"${descSuffix}`,
        relatedFactsheetId: targetFactsheetId,
        details: { dependencyDescription },
      });

      // Log for the target factsheet (the one being depended on)
      await logChange({
        factsheetId: targetFactsheetId,
        action: 'dependency_added',
        description: `"${sourceFactsheetName}" now depends on this${descSuffix}`,
        relatedFactsheetId: sourceFactsheetId,
        details: { dependencyDescription },
      });
    },
    [logChange]
  );

  const logDependencyRemoved = useCallback(
    async (
      sourceFactsheetId: string,
      sourceFactsheetName: string,
      targetFactsheetId: string,
      targetFactsheetName: string
    ) => {
      // Log for the source factsheet
      await logChange({
        factsheetId: sourceFactsheetId,
        action: 'dependency_removed',
        description: `Removed dependency on "${targetFactsheetName}"`,
        relatedFactsheetId: targetFactsheetId,
      });

      // Log for the target factsheet
      await logChange({
        factsheetId: targetFactsheetId,
        action: 'dependency_removed',
        description: `"${sourceFactsheetName}" no longer depends on this`,
        relatedFactsheetId: sourceFactsheetId,
      });
    },
    [logChange]
  );

  const logDependencyUpdated = useCallback(
    async (
      sourceFactsheetId: string,
      sourceFactsheetName: string,
      targetFactsheetId: string,
      targetFactsheetName: string,
      oldDescription: string | null,
      newDescription: string | null
    ) => {
      let changeDesc: string;
      if (!oldDescription && newDescription) {
        changeDesc = ` - added description: "${newDescription}"`;
      } else if (oldDescription && !newDescription) {
        changeDesc = ` - removed description`;
      } else if (oldDescription !== newDescription) {
        changeDesc = ` - description: "${oldDescription}" → "${newDescription}"`;
      } else {
        changeDesc = '';
      }

      // Log for the source factsheet
      await logChange({
        factsheetId: sourceFactsheetId,
        action: 'dependency_updated',
        description: `Updated dependency on "${targetFactsheetName}"${changeDesc}`,
        relatedFactsheetId: targetFactsheetId,
        details: { oldDescription, newDescription },
      });

      // Log for the target factsheet
      await logChange({
        factsheetId: targetFactsheetId,
        action: 'dependency_updated',
        description: `Dependency from "${sourceFactsheetName}" was updated${changeDesc}`,
        relatedFactsheetId: sourceFactsheetId,
        details: { oldDescription, newDescription },
      });
    },
    [logChange]
  );

  return {
    logChange,
    logFactsheetCreated,
    logFactsheetUpdated,
    logPropertyChanged,
    logDependencyAdded,
    logDependencyRemoved,
    logDependencyUpdated,
    hasUsername: Boolean(username),
  };
}
