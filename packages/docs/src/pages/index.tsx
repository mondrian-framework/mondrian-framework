import GitHubSVG from '../../static/img/github.svg'
import styles from './index.module.css'
import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import CodeBlock from '@theme/CodeBlock'
import Layout from '@theme/Layout'
import clsx from 'clsx'
import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faBinoculars, faVialCircleCheck, faCube } from '@fortawesome/free-solid-svg-icons'
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext()
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <script async defer src="https://buttons.github.io/buttons.js"></script>
      <div className="container">
        <div className={styles.bannerContainer}>
          <div className={styles.bannerLeft}>
            <div className={styles.title}>
              The Node.js framework for building <em>modular</em> server-side applications ready to <em>evolve</em>
            </div>
            <div className={styles.subtitle}>
              <p>
                Mondrian enables developers to focus on their applications with a <b>clean architecture</b> made by
                small, cohesive and decoupled modules. It provides tools and abstractions to build efficient, scalable
                and reliable software that is designed to last.
              </p>
              <p>
                Start making <b>better software faster</b> with Mondrian!
              </p>
              <div className={styles.buttons}>
                <Link className={`button ${styles.button} ${styles.buttonDoc} button--lg`} to="/docs/docs/introduction">
                  Documentation
                </Link>
                <Link
                  className={`button ${styles.button} button--secondary button--lg`}
                  to="https://github.com/mondrian-framework/mondrian-framework"
                >
                  <GitHubSVG />
                  Source Code
                </Link>
              </div>
            </div>
          </div>
          <div className={styles.bannerRight}>
            <img className={styles.bannerGraphic} src="img/home-graphic.png" />
          </div>
        </div>
      </div>
    </header>
  )
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <section>
          <div className="container">
            <div className={styles.feature}>
              <div>
                <div className={styles.qualitiesDescription}>
                  Build <b>enterprise-grade</b> applications that will stand the test of time. 
                  <br/>
                  Develop your software on a ready-to-use and highly productive <b>clean architecture</b>.
                </div>
                <div className={styles.qualities}>
                  <div className={styles.quality}>
                    <div className={styles.qualityIcon1}>
                      <FontAwesomeIcon icon={faCube} />
                    </div>
                    <div className={styles.qualityTitle}>
                      Modularity
                    </div>
                    <div className={styles.qualityDescription}>
                      Organize applications into self-contained, reusable and composable modules.
                    </div>
                  </div>
                  <div className={styles.quality}>
                    <div className={styles.qualityIcon2}>
                      <FontAwesomeIcon icon={faVialCircleCheck} />
                    </div>
                    <div className={styles.qualityTitle}>
                      Testability
                    </div>
                    <div className={styles.qualityDescription}>
                      Build easily testable components by breaking up dependencies.
                    </div>
                  </div>
                  <div className={styles.quality}>
                    <div className={styles.qualityIcon3}>
                      <FontAwesomeIcon icon={faBinoculars} />
                    </div>
                    <div className={styles.qualityTitle}>
                      Observability
                    </div>
                    <div className={styles.qualityDescription}>
                      Observable by default with strong OpenTelemetry integration.
                    </div>
                  </div>
                  <div className={styles.quality}>
                    <div className={styles.qualityIcon4}>
                      <FontAwesomeIcon icon={faLock} />
                    </div>
                    <div className={styles.qualityTitle}>
                      Type Safety
                    </div>
                    <div className={styles.qualityDescription}>
                      A robust and type safe development environment using TypeScript.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div className="container">
            <div className={styles.feature}>
              <div className={styles.featureColumn}>
                <div className={styles.featureSubtitle}>@mondrian-framework/model</div>
                <div className={styles.featureTitle}>
                  Expressive <em>data model</em> and schema validation
                </div>
                <div className={styles.featureDescription}>
                  Mondrian allows you to define a data model in an intuitive human-readable way. In addition to model
                  fields, types, possibly new scalars and relationships, you can utilize a wide range of validity rules
                  or create new and reusable ones. Once the model is defined, the framework provides a set of fully
                  automatic translation features to major standards: JSONSchema (OpenAPI), GraphQL and Protobuf.
                </div>
                <div className={styles.featureButton}>
                  <Link className={`button button--primary button--lg`} to="/docs/docs/foundamentals/model">
                    Learn more about data model
                  </Link>
                </div>
              </div>
              <div className={styles.featureColumn}>
                <CodeBlock className={styles.codeBlock} language="ts" title="app.ts" showLineNumbers>
                  {`import { model } from '@mondrian-framework/model'

export const Post = model.object({
  id: model.string(),
  createdAt: model.timestamp(),
  title: model.string(),
})
export type Post = model.Infer<typeof Post>

export const User = m.object({
  id: model.string(),
  createdAt: model.timestamp(),
  email: model.email(),
  password: model.string({ minLength: 8 }),
  posts: model.array(Post),
})
export type User = model.Infer<typeof User>

`}
                </CodeBlock>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div className="container">
            <div className={styles.feature}>
              <div className={styles.featureColumn}>
                <div className={styles.featureSubtitle}>@mondrian-framework/module</div>
                <div className={styles.featureTitle}>
                  <em>Modularity</em> and well defined boundaries
                </div>
                <div className={styles.featureDescription}>
                  Define your system as a set of functions grouped into modules. Each function has a single responsibility, with well-defined boundaries based on a formal interface, with no direct dependencies on the execution environment.
                  <br/><br/>
                  The design-first approach allows you to have a specification always aligned with the code and automatically generate tools and artifacts for the clients of your software.
                </div>
                <div className={styles.featureButton}>
                  <Link className={`button button--primary button--lg`} to="/docs/docs/foundamentals/function">
                    Learn more about modules
                  </Link>
                </div>
              </div>
              <div className={styles.featureColumn}>
                <CodeBlock className={styles.codeBlock} language="ts" title="module.ts" showLineNumbers>
                  {`import { functions } from '@mondrian-framework/module'
import { model } from '@mondrian-framework/model'

const register = functions
  .define({
    input: model.object({ 
      email: model.email(), 
      password: model.string({ minLength: 8 }) 
    }),
    output: model.object({ jwt: model.string() }),
    errors: { weakPassword: model.string() },
  })
  .implement({
    async body({ input: { email, password } }) {
      // BUSINESS LOGIC
    },
  })

const userModule = module.build({
  name: 'User',
  version: '0.0.1',
  functions: { register }
})
`}
                </CodeBlock>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div className="container">
            <div className={styles.feature}>
              <div className={styles.featureColumn}>
                <div className={styles.featureSubtitle}>@mondrian-framework/runtime</div>
                <div className={styles.featureTitle}>
                  Multiple <em>runtimes</em> with zero effort
                </div>
                <div className={styles.featureDescription}>
                  Provide your own functions in any way you like, as an API (REST, GraphQL or gRPC), as a queue consumer (SQS, Kafka, etc.) or a scheduled job. Every runtime provided by the framework also support all best practices, from observability via Open Telemetry to automated documentation.
                  <br/><br/>
                  You can also develop your own runtime based on your needs to execute a module using a server of your choice and a dedicated infrastructure. This will allow you to embrace technological evolution without rewriting your code.
                </div>
                <div className={styles.featureButton}>
                  <Link className={`button button--primary button--lg`} to="/docs/docs/foundamentals/runtime">
                    Learn more about runtimes
                  </Link>
                </div>
              </div>
              <div className={styles.featureColumn}>
                <CodeBlock className={styles.codeBlock} language="ts" title="model.ts" showLineNumbers>
                  {`import { graphql } from '@mondrian-framework/graphql'
import { serve } from '@mondrian-framework/graphql-fastify'
import { fastify } from 'fastify'

const server = fastify()

const api = graphql.build({ 
  module: userModule,
  functions: {
    register: { type: 'mutation' },
  },
})

serve({ 
  server,
  api,
  options: { introspection: true },
})

server.listen({ port: 4000 }).then((address) => {
  console.log(\`Server started at address \${address}/graphql\`)
})
`}
                </CodeBlock>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div className="container">
            <div className={styles.preview}>
              <div className={styles.featureTitle}>
                Live Preview
              </div>
              <div className={styles.featureDescription}>
                See how your application may potentially look like without leaving your personal browser. Feel free to change the codebase
                and reload the preview of the OpenAPI specification.
              </div>
              <iframe
                className={styles.previewCode} 
                width="100%"
                height="800px"
                src="https://stackblitz.com/edit/stackblitz-starters-kwhrtw?embed=1&file=src%2Fapp.ts" 
              />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  )
}
