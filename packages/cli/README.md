# Mondrian CLI

Mondrian CLI is a command line tool to help you detect breaking changes on your GraphQL and OpenAPI schemas.

## Installation

Just install it globally using npm:

```
npm install -g @mondrian-framework/cli
```

## Usage

```
mondrian -h
```

### GraphQL Diff

Compare two GraphQL schemas and detect any breaking changes between them.

```
mondrian gql-diff -h

Usage: mondrian gql-diff [options]

Detect any breaking changes between two GraphQL schemas

Options:
  --previous-schema <value>           previous GraphQL schema (endpoint, filename or schema)
  --current-schema <value>            current GraphQL schema (endpoint, filename or schema)
  --previous-schema-headers <value>   headers to use on previous schema download. Example: '{ "auth": "Bearer ..." }'
  --current-schema-headers <value>    headers to use on current schema download. Example: '{ "auth": "Bearer ..." }'
  --fail-on-breaking-changes <value>  'true' or 'false'. if 'true' breaking changes will return 1 as exit code. default is 'true'
  -h, --help                          display help for command
```

Examples:

```
mondrian gql-diff \
  --previous-schema http://localhost:4000/graphql \
  --current-schema http://localhost:4001/graphql

{
  "breakingChanges": 1,
  "info": [
    {
      "type": "INPUT_FIELD_ADDED",
      "criticality": {
        "level": "BREAKING",
        "reason": "Adding a required input field to an existing input object type is a breaking change because it will cause existing uses of this input object type to error."
      },
      "message": "Input field 'addedField' of type 'String!' was added to input object type 'LoginInput'",
      "meta": {
        "inputName": "LoginInput",
        "addedInputFieldName": "addedField",
        "isAddedInputFieldTypeNullable": false,
        "addedInputFieldType": "String!"
      },
      "path": "LoginInput.addedField"
    }
  ]
}

or 

{
  "breakingChanges": 0,
  "info": []
}
```

### OAS Diff

```
mondrian oas-diff -h

Usage: mondrian oas-diff [options]

Detect any breaking changes between two OpenApi specifications

Options:
  --previous-schema <value>           previous OpenAPI schema (endpoint, filename or schema)
  --current-schema <value>            current OpenAPI schema (endpoint, filename or schema)
  --previous-schema-headers <value>   headers to use on previous schema download. Example: '{ "auth": "Bearer ..." }'
  --current-schema-headers <value>    headers to use on current schema download. Example: '{ "auth": "Bearer ..." }'
  --fail-on-breaking-changes <value>  'true' or 'false'. if 'true' breaking changes will return 1 as exit code. default is 'true'
  -h, --help                          display help for command
```

Examples:

```
mondrian oas-diff \
  --previous-schema http://localhost:4000/openapi/v1/schema.json \
  --current-schema http://localhost:4001/openapi/v1/schema.json

{
  "breakingChanges": 1,
  "info": {
    "reportSummary": {
      "components": {
        "totalChanges": 2,
        "breakingChanges": 1
      }
    },
    "CreatedAt": "0001-01-01T00:00:00Z",
    "UpdatedAt": "0001-01-01T00:00:00Z",
    "commitDetails": {
      "CreatedAt": "0001-01-01T00:00:00Z",
      "UpdatedAt": "0001-01-01T00:00:00Z",
      "commitHash": "16e079",
      "message": "New: /tmp/09fee2a3-99a0-40f1-943e-21374634fab7.json, Original: /tmp/a7de4c68-d58b-44cf-adab-5a9fe0f23fdd.json",
      "author": "",
      "authorEmail": "",
      "committed": "2024-01-16T10:14:37.642229+01:00",
      "changeReport": {
        "components": {
          "schemas": {
            "LoginInput": {
              "changes": [
                {
                  "context": {
                    "newLine": 1,
                    "newColumn": 18067
                  },
                  "change": 2,
                  "property": "required",
                  "new": "addedField",
                  "breaking": true
                },
                {
                  "context": {
                    "newLine": 1,
                    "newColumn": 18167
                  },
                  "change": 3,
                  "property": "properties",
                  "new": "addedField",
                  "breaking": false
                }
              ]
            }
          }
        }
      }
    }
  }
}

or 

{
  "breakingChanges": 0,
  "info": {
    "message": "No changes found between specifications"
  }
}
```