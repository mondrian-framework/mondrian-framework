import GitHubSVG from '../../static/img/github.svg'
import styles from './index.module.css'
import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import CodeBlock from '@theme/CodeBlock'
import Layout from '@theme/Layout'
import clsx from 'clsx'
import React from 'react'

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext()
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
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
                  to="https://github.com/twinlogix/mondrian-framework"
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
                  <Link className={`button button--primary button--lg`} to="/docs/docs/introduction">
                    Learn more about data model
                  </Link>
                </div>
              </div>
              <div className={styles.featureColumn}>
                <CodeBlock language="ts" title="model.ts" showLineNumbers>
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
  email: model.string({ format: 'email' }),
  password: model.string({ format: 'password', minLength: 5 }),
  posts: model.array(Post),
})
export type User = model.Infer<typeof User>
`}
                </CodeBlock>
              </div>
            </div>
          </div>
        </section>

        {/*  
        <section>
          <div className="container">
            <div className={styles.feature}>
            </div>
        </div>
        </section>
        */}
      </main>
    </Layout>
  )
}
