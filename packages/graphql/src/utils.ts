import { projection, types } from '@mondrian-framework/model'
import { assertNever } from '@mondrian-framework/utils'
import { GraphQLResolveInfo, Kind, SelectionSetNode } from 'graphql'

function infoToProjectionInternal(
  node: SelectionSetNode,
  info: GraphQLResolveInfo,
  spreding?: string,
): projection.Projection {
  let result: Record<string, projection.Projection> = {}
  for (const selection of node.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value === '__typename') {
        continue
      }
      const name = selection.name.value
      const projection = selection.selectionSet ? infoToProjectionInternal(selection.selectionSet, info) : true
      result[name] = projection
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      if (!selection.typeCondition) {
        throw new Error(`graphqlInfoToProjectionInternal: unexpected INLINE_FRAGMENT without typeConfition`)
      }
      const name = selection.typeCondition.name.value
      const projection = infoToProjectionInternal(selection.selectionSet, info, name)
      result[name] = projection
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value
      const fragment = info.fragments[fragmentName]
      const r = infoToProjectionInternal(fragment.selectionSet, info)
      const name = fragment.typeCondition.name.value
      //TODO: projection.merge
      throw new Error('projection.merge not implemented')
      //result = projection.merge(result, spreding ? r : { [name]: r }) as Record<string, projection.Projection>
    } else {
      assertNever(selection)
    }
  }
  return result
}

export function infoToProjection(info: GraphQLResolveInfo, type: types.Type): projection.Projection {
  if (info.fieldNodes.length <= 0) {
    throw new Error('graphqlInfoToProjectionInternal: info.fieldNodes.length is 0')
  }
  const node = info.fieldNodes[0]
  if (!node.selectionSet) {
    return true
  }
  return infoToProjectionInternal(node.selectionSet, info)
}
