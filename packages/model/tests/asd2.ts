const a = {
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
                          tags: {
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
                                          type: {
                                            kind: 'optional',
                                            wrappedType: {
                                              kind: 'boolean',
                                              options: undefined,
                                            },
                                            options: undefined,
                                          },
                                          value: {
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
                                    fields: {
                                      equals: {
                                        kind: 'optional',
                                        wrappedType: {
                                          kind: 'object',
                                          fields: {
                                            registeredAt: {
                                              kind: 'custom',
                                              typeName: 'datetime',
                                              options: undefined,
                                            },
                                            loggedInAt: {
                                              kind: 'custom',
                                              typeName: 'datetime',
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
                                  options: undefined,
                                },
                              },
                              options: {
                                name: 'UserWhere',
                              },
                            },
                            options: undefined,
                          },
                          tags: {
                            kind: 'optional',
                            wrappedType: {
                              kind: 'object',
                              fields: {
                                equals: {
                                  kind: 'optional',
                                  wrappedType: {
                                    kind: 'array',
                                    wrappedType: {
                                      kind: 'object',
                                      fields: {
                                        type: {
                                          kind: 'string',
                                          options: undefined,
                                        },
                                        value: {
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
                                  options: undefined,
                                },
                                isEmpty: {
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
                        options: {
                          name: 'PostWhere',
                        },
                      },
                      options: undefined,
                    },
                    orderBy: {
                      kind: 'optional',
                      wrappedType: {
                        kind: 'array',
                        wrappedType: {
                          kind: 'object',
                          fields: {
                            title: {
                              kind: 'optional',
                              wrappedType: {
                                kind: 'union',
                                variants: {
                                  asc: {
                                    kind: 'literal',
                                    literalValue: 'asc',
                                    options: undefined,
                                  },
                                  desc: {
                                    kind: 'literal',
                                    literalValue: 'desc',
                                    options: undefined,
                                  },
                                },
                                options: {
                                  name: 'SortDirection',
                                },
                              },
                              options: undefined,
                            },
                            content: {
                              kind: 'optional',
                              wrappedType: {
                                $ref: 'SortDirection',
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
                                      $ref: 'SortDirection',
                                    },
                                    options: undefined,
                                  },
                                  bestFriend: {
                                    kind: 'optional',
                                    wrappedType: {
                                      $ref: 'UserOrderBy',
                                    },
                                    options: undefined,
                                  },
                                  posts: {
                                    kind: 'optional',
                                    wrappedType: {
                                      kind: 'object',
                                      fields: {
                                        _count: {
                                          kind: 'optional',
                                          wrappedType: {
                                            $ref: 'SortDirection',
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
                                      fields: {
                                        registeredAt: {
                                          kind: 'optional',
                                          wrappedType: {
                                            $ref: 'SortDirection',
                                          },
                                          options: undefined,
                                        },
                                        loggedInAt: {
                                          kind: 'optional',
                                          wrappedType: {
                                            $ref: 'SortDirection',
                                          },
                                          options: undefined,
                                        },
                                      },
                                      options: undefined,
                                    },
                                    options: undefined,
                                  },
                                },
                                options: {
                                  name: 'UserOrderBy',
                                },
                              },
                              options: undefined,
                            },
                            tags: {
                              kind: 'optional',
                              wrappedType: {
                                kind: 'object',
                                fields: {
                                  _count: {
                                    kind: 'optional',
                                    wrappedType: {
                                      $ref: 'SortDirection',
                                    },
                                    options: undefined,
                                  },
                                },
                                options: undefined,
                              },
                              options: undefined,
                            },
                          },
                          options: {
                            name: 'PostOrderBy',
                          },
                        },
                        options: undefined,
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
    orderBy: {
      kind: 'optional',
      wrappedType: {
        kind: 'array',
        wrappedType: {
          $ref: 'UserOrderBy',
        },
        options: undefined,
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
