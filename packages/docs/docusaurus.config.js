// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Mondrian Framework',
  tagline: 'The Typescript framework for building modular and highly decoupled Node.js applications ready to evolve.',
  favicon: 'img/favicon.ico',
  url: 'https://mondrianframework.io',
  baseUrl: '/mondrian-framework/',
  organizationName: 'twinlogix',
  projectName: 'mondrian-framework',
  deploymentBranch: 'docs',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
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
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'docSidebar',
            sidebarId: 'communitySidebar',
            position: 'left',
            label: 'Community',
          },
          {
            href: 'https://github.com/twinlogix/mondrian-framework',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: '...',
                to: '/',
              },
              {
                label: '...',
                to: '/',
              },
              {
                label: '...',
                to: '/',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: '...',
                to: '/',
              },
              {
                label: '...',
                to: '/',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/twinlogix/mondrian-framework',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} TwinLogix srl.`,
      },
    }),
}

module.exports = config
