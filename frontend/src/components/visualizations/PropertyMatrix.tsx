import { useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { FactsheetExpanded, PropertyDefinition, FactsheetPropertyExpanded } from '../../types';

interface PropertyMatrixProps {
  factsheets: FactsheetExpanded[];
  properties: FactsheetPropertyExpanded[];
  propertyDefinitions: PropertyDefinition[];
  xAxisProperty: string;
  yAxisProperty: string;
  onFactsheetClick?: (factsheetId: string) => void;
}

export default function PropertyMatrix({
  factsheets,
  properties,
  propertyDefinitions,
  xAxisProperty,
  yAxisProperty,
  onFactsheetClick,
}: PropertyMatrixProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const xDef = propertyDefinitions.find((p) => p.id === xAxisProperty);
  const yDef = propertyDefinitions.find((p) => p.id === yAxisProperty);

  // Get unique values for each axis
  const { xValues, yValues, matrix } = useMemo(() => {
    const xVals = new Set<string>();
    const yVals = new Set<string>();
    const matrixData: Map<string, Map<string, FactsheetExpanded[]>> = new Map();

    // Build property lookup
    const propLookup = new Map<string, Map<string, string>>();
    properties.forEach((prop) => {
      if (!propLookup.has(prop.factsheet)) {
        propLookup.set(prop.factsheet, new Map());
      }
      propLookup.get(prop.factsheet)!.set(prop.property, prop.value);
    });

    // Build matrix
    factsheets.forEach((fs) => {
      const fsProps = propLookup.get(fs.id);
      const xVal = fsProps?.get(xAxisProperty) || 'Unknown';
      const yVal = fsProps?.get(yAxisProperty) || 'Unknown';

      xVals.add(xVal);
      yVals.add(yVal);

      if (!matrixData.has(xVal)) {
        matrixData.set(xVal, new Map());
      }
      if (!matrixData.get(xVal)!.has(yVal)) {
        matrixData.get(xVal)!.set(yVal, []);
      }
      matrixData.get(xVal)!.get(yVal)!.push(fs);
    });

    return {
      xValues: Array.from(xVals).sort(),
      yValues: Array.from(yVals).sort(),
      matrix: matrixData,
    };
  }, [factsheets, properties, xAxisProperty, yAxisProperty]);

  useEffect(() => {
    if (!svgRef.current || xValues.length === 0 || yValues.length === 0) return;

    const margin = { top: 60, right: 40, bottom: 40, left: 120 };
    const cellWidth = 150;
    const cellHeight = 100;
    const width = margin.left + margin.right + cellWidth * xValues.length;
    const height = margin.top + margin.bottom + cellHeight * yValues.length;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create scales
    const xScale = d3
      .scaleBand()
      .domain(xValues)
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const yScale = d3
      .scaleBand()
      .domain(yValues)
      .range([margin.top, height - margin.bottom])
      .padding(0.1);

    // Draw cells
    xValues.forEach((xVal) => {
      yValues.forEach((yVal) => {
        const factsheetsInCell = matrix.get(xVal)?.get(yVal) || [];

        const g = svg
          .append('g')
          .attr('transform', `translate(${xScale(xVal)}, ${yScale(yVal)})`);

        // Cell background
        g.append('rect')
          .attr('width', xScale.bandwidth())
          .attr('height', yScale.bandwidth())
          .attr('fill', factsheetsInCell.length > 0 ? '#f0fdfa' : '#f9fafb')
          .attr('stroke', '#e5e7eb');

        // Factsheets in cell
        factsheetsInCell.slice(0, 3).forEach((fs, index) => {
          const typeColor = fs.expand?.type?.color || '#6b7280';

          const chip = g
            .append('g')
            .attr('transform', `translate(8, ${8 + index * 28})`)
            .style('cursor', 'pointer')
            .on('click', () => onFactsheetClick?.(fs.id));

          chip
            .append('rect')
            .attr('width', xScale.bandwidth() - 16)
            .attr('height', 24)
            .attr('fill', typeColor);

          chip
            .append('text')
            .attr('x', 8)
            .attr('y', 16)
            .attr('fill', 'white')
            .attr('font-size', '12px')
            .attr('font-weight', '500')
            .text(fs.name.length > 15 ? fs.name.slice(0, 15) + '...' : fs.name);
        });

        // Count badge if more than 3
        if (factsheetsInCell.length > 3) {
          g.append('text')
            .attr('x', xScale.bandwidth() - 8)
            .attr('y', yScale.bandwidth() - 8)
            .attr('text-anchor', 'end')
            .attr('fill', '#6b7280')
            .attr('font-size', '11px')
            .text(`+${factsheetsInCell.length - 3} more`);
        }
      });
    });

    // X axis labels
    svg
      .append('g')
      .attr('transform', `translate(0, ${margin.top - 10})`)
      .selectAll('text')
      .data(xValues)
      .join('text')
      .attr('x', (d) => (xScale(d) || 0) + xScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#374151')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .text((d) => d);

    // X axis title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1a1f2e')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text(xDef?.name || 'X Axis');

    // Y axis labels
    svg
      .append('g')
      .attr('transform', `translate(${margin.left - 10}, 0)`)
      .selectAll('text')
      .data(yValues)
      .join('text')
      .attr('y', (d) => (yScale(d) || 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#374151')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .text((d) => d);

    // Y axis title
    svg
      .append('text')
      .attr('transform', `translate(20, ${height / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1a1f2e')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text(yDef?.name || 'Y Axis');
  }, [xValues, yValues, matrix, xDef, yDef, onFactsheetClick]);

  if (!xAxisProperty || !yAxisProperty) {
    return (
      <div className="w-full h-[400px] bg-gray-50 border border-gray-200 flex items-center justify-center">
        <p className="text-gray-500">Select both X and Y axis properties to view the matrix</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto bg-white border border-gray-200 p-4">
      <svg ref={svgRef} />
    </div>
  );
}
