import { moduleInterface } from '../interface'
import { buildGraphQLReport } from './build-graphql-report'
import { buildOASReport } from './build-oas-report'
import { getReport } from './get-report'

export const module = moduleInterface.implement({
  functions: { getReport, buildOASReport, buildGraphQLReport },
  options: { checkOutputType: 'throw' },
})
