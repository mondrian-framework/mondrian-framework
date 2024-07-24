import { idType, authenticationFailed, postNotFound } from '../common/model'
import { Post, OwnPost } from './model'
import { model } from '@mondrian-framework/model'
import { error, functions, retrieve } from '@mondrian-framework/module'

export const writePost = functions.define({
  input: model.pick(Post, { title: true, content: true, visibility: true }, { name: 'WritePostInput' }),
  output: OwnPost,
  errors: {
    authenticationFailed,
    unauthorizedAccess: error.standard.UnauthorizedAccess,
    badInput: error.standard.BadInput,
  },
  retrieve: { select: true },
  options: {
    namespace: 'post',
    description: 'Inser a new post by provind the title, content and visibility. Available only for logged user.',
  },
})

export const readPosts = functions.define({
  output: model.array(Post, { totalCount: true }),
  retrieve: retrieve.allCapabilities,
  errors: {
    unauthorizedAccess: error.standard.UnauthorizedAccess,
  },
  options: {
    namespace: 'post',
    description: 'Gets posts of a specific user. The visibility of posts can vary based on viewer.',
  },
})

export const likePost = functions.define({
  input: model.object({ postId: idType }, { name: 'LikePostInput' }),
  output: OwnPost,
  errors: {
    authenticationFailed,
    postNotFound,
    unauthorizedAccess: error.standard.UnauthorizedAccess,
    badInput: error.standard.BadInput,
  },
  retrieve: { select: true },
  options: {
    namespace: 'post',
    description: 'Add a like to a post you can view. Available only for logged user.',
  },
})
