import dedent from 'dedent'
import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'
import { ItemNode } from './item'

export const WallNode = BaseNode.extend({
  id: objectId('wall'),
  type: nodeType('wall'),
  children: z.array(ItemNode.shape.id).default([]),
  thickness: z.number().optional(),
  height: z.number().optional(),
  start: z.tuple([z.number(), z.number()]),
  end: z.tuple([z.number(), z.number()]),
  frontSide: z.enum(['interior', 'exterior', 'unknown']).default('unknown'),
  backSide: z.enum(['interior', 'exterior', 'unknown']).default('unknown'),
}).describe(
  dedent`
  Wall node - used to represent a wall in the building
  - thickness: thickness in meters
  - height: height in meters
  - start: start point of the wall in level coordinate system
  - end: end point of the wall in level coordinate system
  - size: size of the wall in grid units
  - frontSide: whether the front side faces interior, exterior, or unknown
  - backSide: whether the back side faces interior, exterior, or unknown
  `,
)

export type WallNode = z.infer<typeof WallNode>
