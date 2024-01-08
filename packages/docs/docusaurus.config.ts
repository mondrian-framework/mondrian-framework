import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
  title: 'Mondrian Framework',
  tagline: 'The Node.js framework for building modular server-side applications ready to evolve',
  favicon: 'img/favicon.ico',
  url: 'https://mondrianframework.io',
  baseUrl: '/mondrian-framework/',
  organizationName: 'mondrian-framework',
  projectName: 'mondrian-framework',
  deploymentBranch: 'docs',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: {
          showReadingTime: true,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      style: 'primary',
      logo: {
        alt: 'Mondrian Framework Logo',
        src: 'img/logo-white.png',
      },
      items: [
        {
          to: '/docs/docs/getting-started',
          position: 'left',
          label: 'Getting Started',
        },
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/mondrian-framework/mondrian-framework',
          className: 'header-github-link',
          position: 'right',
        },
      ],
    },
    algolia: {
      appId: 'FFSJ0O7JXL',
      apiKey: '9acefb3b8afa60f5e49296b9f5279f37',
      indexName: 'mondrian-framework',
      contextualSearch: true,
      searchPagePath: 'search',
    },
    footer: {
      logo: {
        alt: 'Mondrian Framework Logo',
        height: '25px',
        src: 'img/logo-white.png',
      },
      copyright: `Copyright © ${new Date().getFullYear()} Mondrian Framework.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
}

export default config
