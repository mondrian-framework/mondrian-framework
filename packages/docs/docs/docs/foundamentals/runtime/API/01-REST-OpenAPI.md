# REST (OpenAPI 3.1)

This runtime allows a Mondrian module to be served as a REST API conforming to the **OpenAPI 3.1** specification. Each function can be mapped as a REST service, whose inputs and outputs can be configured as query parameters, path variables or raw content in the body of the request.

The runtime, in addition to exposing a Web server for the API, provides a complete OpenAPI 3.1 specification automatically produced from the definition of the module model and functions.

## Package
To use this runtime you need to start adding the `@mondrian-framework/rest` dependency and import the `rest` namespace from it:
```ts showLineNumbers
import { rest } from '@mondrian-framework/rest';
```

## Definition


## Implementation


