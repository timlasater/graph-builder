import type { DataColumn, DataRow, DataWarning } from './types'

const functions: Record<string, (...args: number[]) => number> = {
  abs: Math.abs, sqrt: Math.sqrt, log: Math.log, exp: Math.exp, min: Math.min, max: Math.max,
  if: (condition, yes, no) => condition ? yes : no,
}
type Token = { kind: 'number' | 'ref' | 'name' | 'op' | 'paren' | 'comma'; value: string }

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = []
  let rest = source.trim()
  while (rest) {
    const match = rest.match(/^\s*(?:([0-9]+(?:\.[0-9]+)?)|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*)|(>=|<=|==|!=|[+\-*/><])|([()])|(,))/)
    if (!match) throw new Error(`Unexpected formula text near “${rest.slice(0, 12)}”.`)
    const [, number, ref, name, op, paren, comma] = match
    tokens.push(number ? { kind: 'number', value: number } : ref ? { kind: 'ref', value: ref } : name ? { kind: 'name', value: name } : op ? { kind: 'op', value: op } : paren ? { kind: 'paren', value: paren } : { kind: 'comma', value: comma })
    rest = rest.slice(match[0].length)
  }
  return tokens
}

export const evaluateFormula = (source: string, row: DataRow, columns: DataColumn[]): number | null => {
  const tokens = tokenize(source.startsWith('=') ? source.slice(1) : source)
  let position = 0
  let primary: () => number
  const expression = (minimum = 0): number => {
    let left = primary()
    const precedence: Record<string, number> = { '==': 1, '!=': 1, '>': 1, '<': 1, '>=': 1, '<=': 1, '+': 2, '-': 2, '*': 3, '/': 3 }
    while (tokens[position]?.kind === 'op' && (precedence[tokens[position].value] ?? -1) >= minimum) {
      const operator = tokens[position++].value
      const right = expression(precedence[operator] + 1)
      left = operator === '+' ? left + right : operator === '-' ? left - right : operator === '*' ? left * right : operator === '/' ? left / right : operator === '>' ? Number(left > right) : operator === '<' ? Number(left < right) : operator === '>=' ? Number(left >= right) : operator === '<=' ? Number(left <= right) : operator === '==' ? Number(left === right) : Number(left !== right)
    }
    return left
  }
  primary = (): number => {
    const token = tokens[position++]
    if (!token) throw new Error('Formula ended unexpectedly.')
    if (token.kind === 'number') return Number(token.value)
    if (token.kind === 'op' && token.value === '-') return -primary()
    if (token.kind === 'ref') {
      const column = columns.find((item) => item.id === token.value || item.name.toLocaleLowerCase() === token.value.toLocaleLowerCase())
      if (!column) throw new Error(`Unknown column “${token.value}”.`)
      const value = row.values[column.id]
      return value === null ? Number.NaN : Number(value)
    }
    if (token.value === '(') { const value = expression(); if (tokens[position++]?.value !== ')') throw new Error('Missing closing parenthesis.'); return value }
    if (token.kind === 'name' && functions[token.value.toLocaleLowerCase()]) {
      if (tokens[position++]?.value !== '(') throw new Error(`Expected “(” after ${token.value}.`)
      const args: number[] = []
      if (tokens[position]?.value !== ')') { args.push(expression()); while (tokens[position]?.kind === 'comma') { position++; args.push(expression()) } }
      if (tokens[position++]?.value !== ')') throw new Error('Missing closing parenthesis.')
      return functions[token.value.toLocaleLowerCase()](...args)
    }
    throw new Error(`Unexpected token “${token.value}”.`)
  }
  const result = expression()
  if (position !== tokens.length) throw new Error(`Unexpected token “${tokens[position].value}”.`)
  return Number.isFinite(result) ? result : null
}

export const calculateColumn = (name: string, formula: string, columns: DataColumn[], rows: DataRow[]) => {
  if (!name.trim()) throw new Error('Enter a calculated-column name.')
  const idBase = name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'calculated'
  let id = idBase; let suffix = 2
  while (columns.some((column) => column.id === id)) id = `${idBase}_${suffix++}`
  const stableFormula = formula.replace(/\[([^\]]+)\]/g, (match, reference: string) => {
    const column = columns.find((item) => item.id === reference || item.name.toLocaleLowerCase() === reference.toLocaleLowerCase())
    return column ? `[${column.id}]` : match
  })
  const values = rows.map((row) => evaluateFormula(stableFormula, row, columns))
  const warnings: DataWarning[] = values.flatMap((value, index) => value === null ? [{ code: 'formula' as const, columnId: id, rowId: rows[index].id, message: `${name}: row ${index + 1} produced a missing value (invalid domain or division by zero).` }] : [])
  return { column: { id, name: name.trim(), dataType: 'number' as const, modelingType: 'continuous' as const, formula: stableFormula }, values, warnings }
}
