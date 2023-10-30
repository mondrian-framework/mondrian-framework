const asd = {
  kind: 'object',
  fields: {
    select: {
      kind: 'optional',
      wrappedType: {
        kind: 'object',
        fields: {
          name: {
            kind: 'optional',
            wrappedType: {
              kind: 'boolean',
              options: undefined,
            },
            options: undefined,
          },
          bestFriend: {
            kind: 'optional',
            wrappedType: {
              kind: 'union',
              variants: {
                retrieve: {
                  kind: 'object',
                  fields: {
                    select: {
                      kind: 'optional',
                      wrappedType: {
                        $ref: 'UserSelect',
                      },
                      options: undefined,
                    },
                  },
                  options: undefined,
                },
                all: {
                  kind: 'boolean',
                  options: undefined,
                },
              },
              options: undefined,
            },
            options: undefined,
          },
          posts: {
            kind: 'optional',
            wrappedType: {
              kind: 'union',
              variants: {
                retrieve: {
                  kind: 'object',
                  fields: {
                    select: {
                      kind: 'optional',
                      wrappedType: {
                        kind: 'object',
                        fields: {
                          title: {
                            kind: 'optional',
                            wrappedType: {
                              kind: 'boolean',
                              options: undefined,
                            },
                            options: undefined,
                          },
                          content: {
                            kind: 'optional',
                            wrappedType: {
                              kind: 'boolean',
                              options: undefined,
                            },
                            options: undefined,
                          },
                          author: {
                            kind: 'optional',
                            wrappedType: {
                              kind: 'union',
                              variants: {
                                retrieve: {
                                  kind: 'object',
                                  fields: {
                                    select: {
                                      kind: 'optional',
                                      wrappedType: {
                                        $ref: 'UserSelect',
                                      },
                                      options: undefined,
                                    },
                                  },
                                  options: undefined,
                                },
                                all: {
                                  kind: 'boolean',
                                  options: undefined,
                                },
                              },
                              options: undefined,
                            },
                            options: undefined,
                          },
                        },
                        options: {
                          name: 'PostSelect',
                        },
                      },
                      options: undefined,
                    },
                    where: {
                      kind: 'optional',
                      wrappedType: {
                        kind: 'object',
                        fields: {
                          title: {
                            kind: 'optional',
                            wrappedType: {
                              kind: 'object',
                              fields: {
                                equals: {
                                  kind: 'optional',
                                  wrappedType: {
                                    kind: 'string',
                                    options: undefined,
                                  },
                                  options: undefined,
                                },
                              },
                              options: undefined,
                            },
                            options: undefined,
                          },
                          content: {
                            kind: 'optional',
                            wrappedType: {
                              kind: 'object',
                              fields: {
                                equals: {
                                  kind: 'optional',
                                  wrappedType: {
                                    kind: 'string',
                                    options: undefined,
                                  },
                                  options: undefined,
                                },
                              },
                              options: undefined,
                            },
                            options: undefined,
                          },
                          author: {
                            kind: 'optional',
                            wrappedType: {
                              kind: 'object',
                              fields: {
                                name: {
                                  kind: 'optional',
                                  wrappedType: {
                                    kind: 'object',
                                    fields: {
                                      equals: {
                                        kind: 'optional',
                                        wrappedType: {
                                          kind: 'string',
                                          options: undefined,
                                        },
                                        options: undefined,
                                      },
                                    },
                                    options: undefined,
                                  },
                                  options: undefined,
                                },
                                bestFriend: {
                                  kind: 'optional',
                                  wrappedType: {
                                    $ref: 'UserWhere',
                                  },
                                  options: undefined,
                                },
                                posts: {
                                  kind: 'optional',
                                  wrappedType: {
                                    kind: 'object',
                                    fields: {
                                      some: {
                                        kind: 'optional',
                                        wrappedType: {
                                          $ref: 'PostWhere',
                                        },
                                        options: undefined,
                                      },
                                      every: {
                                        kind: 'optional',
                                        wrappedType: {
                                          $ref: 'PostWhere',
                                        },
                                        options: undefined,
                                      },
                                      none: {
                                        kind: 'optional',
                                        wrappedType: {
                                          $ref: 'PostWhere',
                                        },
                                        options: undefined,
                                      },
                                    },
                                    options: undefined,
                                  },
                                  options: undefined,
                                },
                                metadata: {
                                  kind: 'optional',
                                  wrappedType: {
                                    kind: 'object',
                                    fields: {},
                                    options: undefined,
                                  },
                                  options: undefined,
                                },
                              },
                              options: {
                                name: 'UserWhere',
                              },
                            },
                            options: undefined,
                          },
                        },
                        options: {
                          name: 'PostWhere',
                        },
                      },
                      options: undefined,
                    },
                    skip: {
                      kind: 'optional',
                      wrappedType: {
                        kind: 'number',
                        options: {
                          minimum: 0,
                          isInteger: true,
                        },
                      },
                      options: undefined,
                    },
                    take: {
                      kind: 'optional',
                      wrappedType: {
                        kind: 'number',
                        options: {
                          minimum: 0,
                          maximum: 20,
                          isInteger: true,
                        },
                      },
                      options: undefined,
                    },
                  },
                  options: undefined,
                },
                all: {
                  kind: 'boolean',
                  options: undefined,
                },
              },
              options: undefined,
            },
            options: undefined,
          },
          metadata: {
            kind: 'optional',
            wrappedType: {
              kind: 'union',
              variants: {
                fields: {
                  kind: 'object',
                  fields: {
                    select: {
                      kind: 'optional',
                      wrappedType: {
                        kind: 'object',
                        fields: {
                          registeredAt: {
                            kind: 'optional',
                            wrappedType: {
                              kind: 'boolean',
                              options: undefined,
                            },
                            options: undefined,
                          },
                          loggedInAt: {
                            kind: 'optional',
                            wrappedType: {
                              kind: 'boolean',
                              options: undefined,
                            },
                            options: undefined,
                          },
                        },
                        options: undefined,
                      },
                      options: undefined,
                    },
                  },
                  options: undefined,
                },
                all: {
                  kind: 'boolean',
                  options: undefined,
                },
              },
              options: undefined,
            },
            options: undefined,
          },
        },
        options: {
          name: 'UserSelect',
        },
      },
      options: undefined,
    },
    where: {
      kind: 'optional',
      wrappedType: {
        $ref: 'UserWhere',
      },
      options: undefined,
    },
    skip: {
      kind: 'optional',
      wrappedType: {
        kind: 'number',
        options: {
          minimum: 0,
          isInteger: true,
        },
      },
      options: undefined,
    },
    take: {
      kind: 'optional',
      wrappedType: {
        kind: 'number',
        options: {
          minimum: 0,
          maximum: 20,
          isInteger: true,
        },
      },
      options: undefined,
    },
  },
  options: undefined,
}
