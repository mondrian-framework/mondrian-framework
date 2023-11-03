import { retrieve, types } from '@mondrian-framework/model'
import { GraphQLResolveInfo } from 'graphql'

export function infoToRetrieve(info: GraphQLResolveInfo, type: types.Type): retrieve.GenericRetrieve {
  return {} //TODO
}
