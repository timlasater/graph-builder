import type { Dataset } from './types'

const prototypes = ['Group A', 'Group B', 'Group C']
const pressures = [20, 30, 40, 50, 60]
const offsets = [-2.1, 0.8, 1.3]
const baselines = [43, 49, 55]

export const sampleDataset: Dataset = {
  name: 'Example measurements (synthetic data)',
  columns: [
    { id: 'prototype', name: 'Sample Group', dataType: 'text', modelingType: 'nominal' },
    { id: 'pressure', name: 'Input Setting', dataType: 'number', modelingType: 'continuous' },
    { id: 'dose', name: 'Measured Result', dataType: 'number', modelingType: 'continuous' },
    { id: 'run', name: 'Trial', dataType: 'number', modelingType: 'ordinal' },
    { id: 'passed', name: 'Within Example Range', dataType: 'boolean', modelingType: 'nominal' },
  ],
  warnings: [],
  rows: prototypes.flatMap((prototype, prototypeIndex) =>
    pressures.flatMap((pressure, pressureIndex) =>
      offsets.map((offset, runIndex) => {
        const dose = baselines[prototypeIndex] + pressure * 0.42 + offset + pressureIndex * 0.35
        return {
          id: `${prototypeIndex}-${pressureIndex}-${runIndex}`,
          excluded: false,
          values: {
            prototype,
            pressure,
            dose: Number(dose.toFixed(1)),
            run: runIndex + 1,
            passed: dose >= 55 && dose <= 82,
          },
        }
      }),
    ),
  ),
}
