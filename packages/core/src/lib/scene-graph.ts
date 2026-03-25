import { z } from 'zod'
import { BuildingNode } from '../schema/nodes/building'
import { ItemNode } from '../schema/nodes/item'
import { SiteNode } from '../schema/nodes/site'
import { AnyNode } from '../schema/types'

const ImportedSiteNode = SiteNode.extend({
  children: z
    .array(z.union([BuildingNode.shape.id, ItemNode.shape.id, BuildingNode, ItemNode]))
    .default([]),
})

const ImportedAnyNode = z.discriminatedUnion('type', [
  ImportedSiteNode,
  ...AnyNode.options.filter((option) => option !== SiteNode),
])

const SceneGraphSchema = z
  .object({
    nodes: z.record(z.string(), ImportedAnyNode),
    rootNodeIds: z.array(z.string()),
  })
  .superRefine((sceneGraph, ctx) => {
    for (const [nodeKey, node] of Object.entries(sceneGraph.nodes)) {
      if (nodeKey !== node.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Scene node key "${nodeKey}" does not match node id "${node.id}"`,
          path: ['nodes', nodeKey],
        })
      }
    }

    for (const rootNodeId of sceneGraph.rootNodeIds) {
      if (!(rootNodeId in sceneGraph.nodes)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Root node "${rootNodeId}" is missing from the scene graph`,
          path: ['rootNodeIds'],
        })
      }
    }
  })

export type ParsedSceneGraph = z.infer<typeof SceneGraphSchema>

export function parseSceneGraph(input: unknown): ParsedSceneGraph | null {
  const result = SceneGraphSchema.safeParse(input)
  return result.success ? result.data : null
}
