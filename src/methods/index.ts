import fh from './fh.m?raw'
import berrut from './berrut.m?raw'
import uniformInteger from './uniform-integer.m?raw'
import lagrange from './lagrange.m?raw'
import equal from './equal.m?raw'
import random from './random.m?raw'

export interface Method {
  id: string
  name: string
  /** one line, shown in the picker */
  blurb: string
  source: string
}

export const METHODS: Method[] = [
  {
    id: 'fh',
    name: 'Floater-Hormann',
    blurb: 'The paper: blend n-d+1 local polynomials of degree d. No poles, order h^(d+1).',
    source: fh,
  },
  {
    id: 'berrut',
    name: 'Berrut (d = 0)',
    blurb: 'Weights (-1)^k. The d = 0 member, and the one that needs a bounded mesh ratio.',
    source: berrut,
  },
  {
    id: 'uniform-integer',
    name: 'Integer weights',
    blurb: "Section 4's closed form on a uniform mesh: 1, 4, 7, 8, ..., 8, 7, 4, 1 for d = 3.",
    source: uniformInteger,
  },
  {
    id: 'lagrange',
    name: 'Polynomial (d = n)',
    blurb: 'The Lagrange weights of equation (2). No poles, but Runge divergence.',
    source: lagrange,
  },
  {
    id: 'equal',
    name: 'Equal weights',
    blurb: 'w_k = 1. Drop the alternating signs and a pole appears in every interval.',
    source: equal,
  },
  {
    id: 'random',
    name: 'Random weights',
    blurb: 'The generic barycentric rational interpolant. Interpolates; has poles.',
    source: random,
  },
]

export const DEFAULT_METHOD = METHODS[0]

export function findMethod(id: string | null | undefined): Method | undefined {
  return METHODS.find((m) => m.id === id)
}
