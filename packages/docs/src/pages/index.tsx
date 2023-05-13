import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import GitHubSVG from '../../static/img/github.svg';

import styles from './index.module.css';
import Head from '@docusaurus/Head';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <div className={styles.bannerContainer}>
          <div className={styles.bannerLeft}>
            <div className={styles.title}>
              The Node.js framework for building <em>modular</em> server-side applications ready to <em>evolve</em>.
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
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
