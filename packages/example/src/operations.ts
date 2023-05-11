import m from '@mondrian/module'
import types from './types'

const register = m.operation({
  types,
  input: 'UserInput',
  output: 'User',
})
const getUser = m.operation({
  types,
  input: 'UserFilter',
  output: 'UserOutput',
  options: {
    graphql: { inputName: 'id' },
  },
})
const getUsers = m.operation({
  types,
  input: 'Void',
  output: 'UserOutputs',
})
export default m.operations({ mutations: { register }, queries: { user: getUser, users: getUsers } })
