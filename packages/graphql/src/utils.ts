import { GraphQLResolveInfo, Kind, SelectionSetNode } from 'graphql'
import { assertNever } from '@mondrian/utils'
import { LazyType, lazyToType } from '@mondrian/model'
import { GenericProjection, mergeProjections } from '@mondrian/module'

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
      const fields = selection.selectionSet ? graphqlInfoToProjection(selection.selectionSet, info) : true
      result[name] = fields
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      if (!selection.typeCondition) {
        throw new Error(`extractFieldsFromGraphqlInfo: unexpected INLINE_FRAGMENT without typeConfition`)
      }
      const name = selection.typeCondition.name.value
      const fields = graphqlInfoToProjection(selection.selectionSet, info, name)
      result[name] = fields
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

function extractRequiredFields(type: LazyType, fields: GenericProjection): GenericProjection | null {
  if (fields === true) {
    return null
  }
  const t = lazyToType(type)
  if (
    t.kind === 'boolean' ||
    t.kind === 'string' ||
    t.kind === 'number' ||
    t.kind === 'enumerator' ||
    t.kind === 'custom' ||
    t.kind === 'literal'
  ) {
    return null
  }
  if (
    t.kind === 'array-decorator' ||
    t.kind === 'optional-decorator' ||
    t.kind === 'nullable-decorator' ||
    t.kind === 'default-decorator' ||
    t.kind === 'relation-decorator'
  ) {
    return extractRequiredFields(t.type, fields)
  }
  if (t.kind === 'object') {
    const p = Object.fromEntries(
      Object.entries(t.type).flatMap(([k, type]) => {
        const subF = fields[k]
        if (!subF) {
          return []
        }
        const subP = extractRequiredFields(type, subF)
        return subP != null ? [[k, subP]] : []
      }),
    )
    if (Object.keys(p).length > 0) {
      return p
    }
    return null
  }
  if (t.kind === 'union-operator') {
    const p = Object.fromEntries(
      Object.entries(t.types).flatMap(([k, type]) => {
        const subF = fields[k]
        if (!subF && !t.opts?.discriminant) {
          return []
        }
        const subP = subF ? extractRequiredFields(type, subF) : null
        const reqP = t.opts?.discriminant ? ({ [t.opts!.discriminant!]: true } as GenericProjection) : null
        const res = subP && reqP ? mergeProjections(reqP, subP) : reqP
        return res != null ? [[k, res]] : []
      }),
    )
    if (Object.keys(p).length > 0) {
      return p
    }
    return null
  }
  assertNever(t)
}

export function extractFieldsFromGraphqlInfo(info: GraphQLResolveInfo, type: LazyType): GenericProjection {
  if (info.fieldNodes.length <= 0) {
    throw new Error('extractFieldsFromGraphqlInfo: info.fieldNodes.length is 0')
  }
  const node = info.fieldNodes[0]
  if (!node.selectionSet) {
    return true
  }
  const fields = graphqlInfoToProjection(node.selectionSet, info)
  const required = extractRequiredFields(type, fields)
  const result = required != null ? mergeProjections(fields, required) : fields
  return result
}
