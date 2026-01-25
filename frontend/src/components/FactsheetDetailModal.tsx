import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit, ExternalLink, History, ChevronDown, ChevronRight } from 'lucide-react';
import { Modal, Button, Badge } from './ui';
import { DependencyGraph } from './visualizations';
import { useRecord, useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { Factsheet, FactsheetType, FactsheetPropertyExpanded, DependencyExpanded, ChangeLogExpanded, FactsheetExpanded, Dependency } from '../types';

interface FactsheetDetailModalProps {
  factsheetId: string | null;
  onClose: () => void;
}

export default function FactsheetDetailModal({ factsheetId, onClose }: FactsheetDetailModalProps) {
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const { record: factsheet, loading } = useRecord<Factsheet>('factsheets', factsheetId || undefined);
  const { record: factsheetType } = useRecord<FactsheetType>(
    'factsheet_types',
    factsheet?.type
  );

  // Dependencies where this factsheet depends on others
  const { records: outgoingDeps } = useRealtime<DependencyExpanded>({
    collection: 'dependencies',
    filter: factsheetId ? `factsheet = "${factsheetId}"` : '',
    expand: 'depends_on',
  });

  // Dependencies where others depend on this factsheet
  const { records: incomingDeps } = useRealtime<DependencyExpanded>({
    collection: 'dependencies',
    filter: factsheetId ? `depends_on = "${factsheetId}"` : '',
    expand: 'factsheet',
  });

  // Get all related factsheet IDs for the mini graph
  const relatedFactsheetIds = useMemo(() => {
    const ids = new Set<string>();
    if (factsheetId) ids.add(factsheetId);
    outgoingDeps.forEach((dep) => {
      if (dep.depends_on) ids.add(dep.depends_on);
    });
    incomingDeps.forEach((dep) => {
      if (dep.factsheet) ids.add(dep.factsheet);
    });
    return Array.from(ids).sort().join(','); // Stable string for comparison
  }, [factsheetId, outgoingDeps, incomingDeps]);

  // Fetch related factsheets (not using useRealtime to avoid cascading updates)
  const [relatedFactsheets, setRelatedFactsheets] = useState<FactsheetExpanded[]>([]);
  useEffect(() => {
    if (!relatedFactsheetIds) {
      setRelatedFactsheets([]);
      return;
    }
    const ids = relatedFactsheetIds.split(',').filter(Boolean);
    if (ids.length === 0) {
      setRelatedFactsheets([]);
      return;
    }
    const filter = ids.map((id) => `id = "${id}"`).join(' || ');
    pb.collection('factsheets')
      .getFullList<FactsheetExpanded>({ filter, expand: 'type' })
      .then(setRelatedFactsheets)
      .catch(() => setRelatedFactsheets([]));
  }, [relatedFactsheetIds]);

  // Combine all dependencies for the graph
  const allDependencies: Dependency[] = useMemo(() => {
    const deps: Dependency[] = [];
    outgoingDeps.forEach((dep) => {
      deps.push({
        id: dep.id,
        factsheet: dep.factsheet,
        depends_on: dep.depends_on,
        description: dep.description,
        collectionId: dep.collectionId,
        collectionName: dep.collectionName,
        created: dep.created,
        updated: dep.updated,
      });
    });
    incomingDeps.forEach((dep) => {
      // Avoid duplicates
      if (!deps.some((d) => d.id === dep.id)) {
        deps.push({
          id: dep.id,
          factsheet: dep.factsheet,
          depends_on: dep.depends_on,
          description: dep.description,
          collectionId: dep.collectionId,
          collectionName: dep.collectionName,
          created: dep.created,
          updated: dep.updated,
        });
      }
    });
    return deps;
  }, [outgoingDeps, incomingDeps]);

  const { records: properties } = useRealtime<FactsheetPropertyExpanded>({
    collection: 'factsheet_properties',
    filter: factsheetId ? `factsheet = "${factsheetId}"` : '',
    expand: 'property,option',
  });

  const { records: changeLogs } = useRealtime<ChangeLogExpanded>({
    collection: 'change_log',
    filter: factsheetId ? `factsheet = "${factsheetId}"` : '',
    sort: '-created',
    expand: 'related_factsheet',
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'draft':
        return 'default';
      case 'archived':
        return 'warning';
      default:
        return 'default';
    }
  };

  const typeColor = factsheetType?.color || '#6b7280';

  return (
    <Modal
      isOpen={factsheetId !== null}
      onClose={onClose}
      title={loading ? 'Loading...' : factsheet?.name || 'Factsheet'}
      size="lg"
    >
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 w-1/3"></div>
          <div className="h-4 bg-gray-200 w-2/3"></div>
          <div className="h-4 bg-gray-200 w-1/2"></div>
        </div>
      ) : factsheet ? (
        <div className="space-y-6">
          {/* Header info */}
          <div className="flex items-center gap-3 flex-wrap">
            {factsheetType && (
              <span
                className="px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: typeColor }}
              >
                {factsheetType.name}
              </span>
            )}
            <Badge variant={getStatusVariant(factsheet.status)}>{factsheet.status}</Badge>
          </div>

          {/* Description */}
          {factsheet.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">Description</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{factsheet.description}</p>
            </div>
          )}

          {/* Properties */}
          {properties.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Properties</h4>
              <div className="grid grid-cols-2 gap-3">
                {properties.map((prop) => (
                  <div key={prop.id} className="bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">{prop.expand?.property?.name}</p>
                    <p className="text-sm font-medium text-primary-900">
                      {prop.expand?.option?.value || 'Not set'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {factsheet.responsibility && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Responsibility</h4>
                <p className="text-gray-700">{factsheet.responsibility}</p>
              </div>
            )}

            {factsheet.what_it_does && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">What it does</h4>
                <div
                  className="text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: factsheet.what_it_does }}
                />
              </div>
            )}

            {factsheet.benefits && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Benefits</h4>
                <div
                  className="text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: factsheet.benefits }}
                />
              </div>
            )}

            {factsheet.problems_addressed && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Problems Addressed</h4>
                <div
                  className="text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: factsheet.problems_addressed }}
                />
              </div>
            )}
          </div>

          {factsheet.potential_ui && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">Potential User Interface</h4>
              <div
                className="text-gray-700 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: factsheet.potential_ui }}
              />
            </div>
          )}

          {/* Dependencies Graph */}
          {relatedFactsheets.length > 1 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Dependencies</h4>
              <div className="h-[250px] border border-gray-200 rounded-lg overflow-hidden">
                <DependencyGraph
                  factsheets={relatedFactsheets}
                  dependencies={allDependencies}
                  showComments={false}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {outgoingDeps.length > 0 && `Depends on ${outgoingDeps.length} factsheet${outgoingDeps.length > 1 ? 's' : ''}`}
                {outgoingDeps.length > 0 && incomingDeps.length > 0 && ' · '}
                {incomingDeps.length > 0 && `${incomingDeps.length} factsheet${incomingDeps.length > 1 ? 's' : ''} depend${incomingDeps.length === 1 ? 's' : ''} on this`}
              </p>
            </div>
          )}

          {/* Change History */}
          {changeLogs.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setHistoryExpanded(!historyExpanded)}
                className="w-full text-left text-sm font-medium text-gray-500 flex items-center gap-2 hover:text-gray-700"
              >
                {historyExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <History className="w-4 h-4" />
                Change History ({changeLogs.length})
              </button>
              {historyExpanded && (
                <div className="space-y-2 max-h-48 overflow-y-auto mt-2">
                  {changeLogs.map((log) => (
                    <div key={log.id} className="bg-gray-50 p-2 text-sm">
                      <div className="flex justify-between items-start">
                        <p className="text-gray-700">{log.description}</p>
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                          {new Date(log.created).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">by {log.username}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Link to={`/factsheets/${factsheetId}/edit`} onClick={onClose}>
              <Button variant="secondary" size="sm" icon={<Edit className="w-4 h-4" />}>
                Edit
              </Button>
            </Link>
            <Link to={`/factsheets/${factsheetId}`} onClick={onClose}>
              <Button variant="ghost" size="sm" icon={<ExternalLink className="w-4 h-4" />}>
                Open Full Page
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Factsheet not found
        </div>
      )}
    </Modal>
  );
}
