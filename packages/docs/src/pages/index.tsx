import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import GitHubSVG from '../../static/img/github.svg';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
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
                Mondrian enables developers to focus on their applications providing a <b>clean architecture</b> made by small, cohesive and decoupled modules. It provides tools and abstractions to build efficient, scalable and reliable software that is designed to last.
              </p>
              <p>
                Start making <b>better software faster</b> with Mondrian!
              </p>
              <div className={styles.buttons}>
                <Link
                  className={`button ${styles.button} ${styles.buttonDoc} button--lg`}
                  to="/docs/docs/intro">
                  Documentation 
                </Link>
                <Link
                  className={`button ${styles.button} button--secondary button--lg`}
                  to="https://github.com/twinlogix/mondrian-framework">
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
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <section>
          <div className="container">
            <div className={styles.feature}>
              <div className={styles.featureColumn}>
                <div className={styles.featureSubtitle}>@mondrian-framework/model</div>
                <div className={styles.featureTitle}>Expressive <em>data model</em> and schema validation</div>
                <div className={styles.featureDescription}>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged.</div>
              </div>
              <div className={styles.featureColumn}>
                <CodeBlock
                  language="ts"
                  title="model.ts"
                  showLineNumbers>
                  {
                    `import t from '@mondrian-framework/model'

export const Post = t.object({
  id: t.string(),
  createdAt: t.timestamp(),
  title: t.string(),
})
export type Post = t.Infer<typeof Post>

export const User = t.object({
  id: t.string(),
  createdAt: t.timestamp(),
  email: t.string({ format: 'email' }),
  password: t.string({ format: 'password', minLength: 5 }),
  posts: t.array(Post),
})
export type User = t.Infer<typeof User>
`
                  }
                </CodeBlock>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
