import { ArrowRight } from 'lucide-react';
import { Modal, Button } from './ui';
import type { FactsheetMoveData } from './visualizations/PropertyMatrix';

interface PropertyChange {
  propertyName: string;
  fromValue: string;
  toValue: string;
}

interface FactsheetMoveModalProps {
  isOpen: boolean;
  moveData: FactsheetMoveData | null;
  xAxisPropertyName: string;
  yAxisPropertyName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function FactsheetMoveModal({
  isOpen,
  moveData,
  xAxisPropertyName,
  yAxisPropertyName,
  onConfirm,
  onCancel,
  loading = false,
}: FactsheetMoveModalProps) {
  if (!moveData) return null;

  const changes: PropertyChange[] = [];

  // Check X axis changes
  if (moveData.fromX !== moveData.toX) {
    changes.push({
      propertyName: xAxisPropertyName,
      fromValue: moveData.fromX,
      toValue: moveData.toX,
    });
  }

  // Check Y axis changes
  if (moveData.fromY !== moveData.toY) {
    changes.push({
      propertyName: yAxisPropertyName,
      fromValue: moveData.fromY,
      toValue: moveData.toY,
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Move Factsheet" size="sm">
      <div className="space-y-4">
        {/* Factsheet name */}
        <div>
          <p className="text-sm text-gray-500">Moving factsheet:</p>
          <p className="font-semibold text-primary-900">{moveData.factsheet.name}</p>
        </div>

        {/* Property changes */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Property</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">From</th>
                <th className="px-4 py-2 text-center w-8"></th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {changes.map((change) => (
                <tr key={change.propertyName}>
                  <td className="px-4 py-3 font-medium text-primary-900">
                    {change.propertyName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      change.fromValue === 'Unknown'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {change.fromValue}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <ArrowRight className="w-4 h-4 text-gray-400 inline" />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      change.toValue === 'Unknown'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {change.toValue}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={loading}>
            Confirm Move
          </Button>
        </div>
      </div>
    </Modal>
  );
}
