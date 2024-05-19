import { ApiSpecification, ServeOptions } from './api'
import { functions } from '@mondrian-framework/module'

/**
 * Generates the html content for the openapi ui
 * This page uses the respective CDNs to download the UIs, an internet connection is required.
 */
export function ui<Fs extends functions.FunctionInterfaces>({
  api,
  options,
}: {
  api: ApiSpecification<Fs>
  options: ServeOptions
}): string {
  const introspectionUI = !options.introspection ? 'none' : options.introspection.ui
  const introspectionPath = !options.introspection
    ? ''
    : options.introspection.path.endsWith('/')
      ? options.introspection.path
      : `${options.introspection.path}/`
  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content="${api.module.name} API Reference" />
      <link rel="icon" type="image/x-icon" href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/openapi/openapi-original.svg">
      <title>${api.module.name} API Reference</title>
      ${introspectionUI === 'swagger' ? `<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@latest/swagger-ui.css" />` : ``}
    </head>
    <body>
    ${
      introspectionUI === 'swagger'
        ? `
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@latest/swagger-ui-bundle.js" crossorigin></script>
        <script>
          window.onload = () => {
            window.ui = SwaggerUIBundle({
              url: '${introspectionPath}v${api.version}/schema.json',
              dom_id: '#swagger-ui',
            });
          };
        </script>`
        : ``
    }
    ${
      introspectionUI === 'scalar'
        ? `
        <script id="api-reference" data-url="${introspectionPath}v${api.version}/schema.json"></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>`
        : ``
    }
    ${
      introspectionUI === 'redoc'
        ? `
        <redoc spec-url="${introspectionPath}v${api.version}/schema.json"></redoc>
        <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>`
        : ``
    }
    </body>
    </html>
  `
}
