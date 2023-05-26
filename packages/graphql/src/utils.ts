import { GraphQLResolveInfo, Kind, SelectionSetNode } from 'graphql'
import { assertNever } from '@mondrian-framework/utils'
import { GenericProjection, LazyType, getRequiredProjection, mergeProjections } from '@mondrian-framework/model'

function graphqlInfoToProjection(
  node: SelectionSetNode,
  info: GraphQLResolveInfo,
  spreding?: string,
): GenericProjection {
  let result: Record<string, GenericProjection> = {}
  for (const selection of node.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value === '__typename') {
        continue
      }
      const name = selection.name.value
      const projection = selection.selectionSet ? graphqlInfoToProjection(selection.selectionSet, info) : true
      result[name] = projection
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      if (!selection.typeCondition) {
        throw new Error(`extractProjectionFromGraphqlInfo: unexpected INLINE_FRAGMENT without typeConfition`)
      }
      const name = selection.typeCondition.name.value
      const projection = graphqlInfoToProjection(selection.selectionSet, info, name)
      result[name] = projection
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value
      const fragment = info.fragments[fragmentName]
      const r = graphqlInfoToProjection(fragment.selectionSet, info)
      const name = fragment.typeCondition.name.value
      result = mergeProjections(result, spreding ? r : { [name]: r }) as Record<string, GenericProjection>
    } else {
      assertNever(selection)
    }
  }
  return result
}

export function extractProjectionFromGraphqlInfo(info: GraphQLResolveInfo, type: LazyType): GenericProjection {
  if (info.fieldNodes.length <= 0) {
    throw new Error('extractProjectionFromGraphqlInfo: info.fieldNodes.length is 0')
  }
  const node = info.fieldNodes[0]
  if (!node.selectionSet) {
    return true
  }
  const projection = graphqlInfoToProjection(node.selectionSet, info)
  const required = getRequiredProjection(type, projection)
  const result = required != null ? mergeProjections(projection, required) : projection
  return result
}
