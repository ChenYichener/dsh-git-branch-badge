/**
 * tsdown build for dsh-git-branch-badge. Only the browser client half needs
 * bundling: it must ship as the module-loader closure-factory artifact
 * (`window.__ModuleLoader__.load({id, factory})`, CJS) that
 * @deepseek-ai/dsh-client-modules serves. The Node half (src/index.js) is
 * plain ESM and is consumed directly through package.json `main`.
 *
 * The artifact replicates the official DSH client-bundle preset
 * (deepseek-harness packages/client/tsdown.client.ts):
 * - externals resolve through the loader module table at runtime (the
 *   PLATFORM_MODULES seed list, plus the runtime/client exemption),
 * - everything else is inlined into the bundle,
 * - the bundle registers itself via `window.__ModuleLoader__.load({id,
 *   factory})` with the `(require) => exports` CJS closure shape,
 * - the registered id equals the package name (client-modules compose keys on
 *   the package name).
 */
import type { UserConfig } from 'tsdown'

/** Plugin id stamped into the module-loader handoff (must equal package.json `name`). */
const PLUGIN_ID = 'dsh-git-branch-badge'

/** Module specifiers the web shell shares into the frozen module table. */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
]

const client: UserConfig = {
  name: `${PLUGIN_ID}/client`,
  entry: { client: 'src/client/index.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [client]
