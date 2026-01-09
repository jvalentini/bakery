/**
 * Plugin management commands for Bakery
 *
 * Provides CLI commands to list, add, remove, and create plugins.
 *
 * @module
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { discoverNpmPlugins, getUserPluginsDir, loadPluginManifest } from '../plugins/loader.js';
import type { PluginManifest } from '../plugins/types.js';
import { bold, cyan, dim, green, red, yellow } from '../utils/colors.js';

// =============================================================================
// Types
// =============================================================================

interface DiscoveredPlugin {
  manifest: PluginManifest;
  path: string;
  source: 'local' | 'user' | 'npm';
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Discover all plugins with their source information
 */
function discoverAllPlugins(): DiscoveredPlugin[] {
  const plugins: DiscoveredPlugin[] = [];
  const seen = new Set<string>();

  // Local plugins (./bakery-plugins/)
  const localDir = path.resolve(process.cwd(), 'bakery-plugins');
  if (fs.existsSync(localDir)) {
    for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const pluginDir = path.join(localDir, entry.name);
        const manifest = loadPluginManifest(pluginDir);
        if (manifest && !seen.has(manifest.name)) {
          seen.add(manifest.name);
          plugins.push({ manifest, path: pluginDir, source: 'local' });
        }
      }
    }
  }

  // User plugins (~/.bakery/plugins/)
  const userDir = getUserPluginsDir();
  if (fs.existsSync(userDir)) {
    for (const entry of fs.readdirSync(userDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const pluginDir = path.join(userDir, entry.name);
        const manifest = loadPluginManifest(pluginDir);
        if (manifest && !seen.has(manifest.name)) {
          seen.add(manifest.name);
          plugins.push({ manifest, path: pluginDir, source: 'user' });
        }
      }
    }
  }

  // npm plugins
  for (const pluginDir of discoverNpmPlugins()) {
    const manifest = loadPluginManifest(pluginDir);
    if (manifest && !seen.has(manifest.name)) {
      seen.add(manifest.name);
      plugins.push({ manifest, path: pluginDir, source: 'npm' });
    }
  }

  return plugins;
}

/**
 * Run a shell command and return the exit code
 */
async function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; silent?: boolean }
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options?.cwd ?? process.cwd(),
      stdio: options?.silent ? 'pipe' : 'inherit',
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    if (options?.silent) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

// =============================================================================
// Commands
// =============================================================================

/**
 * List all installed plugins
 */
export async function listPlugins(): Promise<void> {
  const plugins = discoverAllPlugins();

  if (plugins.length === 0) {
    console.log(dim('No plugins installed'));
    console.log('');
    console.log(`Run ${cyan('bakery plugins add <name>')} to install a plugin from npm`);
    console.log(`Or ${cyan('bakery plugins create')} to scaffold a new plugin`);
    return;
  }

  console.log(bold('Installed Plugins'));
  console.log('');

  for (const plugin of plugins) {
    const sourceLabel =
      plugin.source === 'local'
        ? dim('[local]')
        : plugin.source === 'user'
          ? dim('[user]')
          : dim('[npm]');

    console.log(
      `  ${green('•')} ${bold(plugin.manifest.displayName)} ${dim(`v${plugin.manifest.version}`)} ${sourceLabel}`
    );
    console.log(`    ${dim(plugin.manifest.description)}`);

    // Show what the plugin provides
    const provides: string[] = [];
    if (plugin.manifest.templates?.length) {
      provides.push(`${plugin.manifest.templates.length} template(s)`);
    }
    if (plugin.manifest.archetypes?.length) {
      provides.push(`${plugin.manifest.archetypes.length} archetype(s)`);
    }
    if (plugin.manifest.addons?.length) {
      provides.push(`${plugin.manifest.addons.length} addon(s)`);
    }
    if (provides.length > 0) {
      console.log(`    ${dim(`Provides: ${provides.join(', ')}`)}`);
    }

    console.log(`    ${dim(`Path: ${plugin.path}`)}`);
    console.log('');
  }
}

/**
 * Add a plugin from npm
 */
export async function addPlugin(packageName: string): Promise<void> {
  // Normalize package name - add bakery-plugin- prefix if not present
  let npmPackage = packageName;
  if (!(packageName.startsWith('bakery-plugin-') || packageName.startsWith('@'))) {
    npmPackage = `bakery-plugin-${packageName}`;
  }

  console.log(`Installing ${cyan(npmPackage)}...`);
  console.log('');

  // Check if bun is available, fall back to npm
  const { code: bunCheck } = await runCommand('bun', ['--version'], { silent: true });
  const packageManager = bunCheck === 0 ? 'bun' : 'npm';

  const { code } = await runCommand(packageManager, ['add', npmPackage]);

  if (code !== 0) {
    console.error(red(`Failed to install ${npmPackage}`));
    process.exit(1);
  }

  console.log('');
  console.log(green(`Successfully installed ${npmPackage}`));

  // Try to load the plugin to verify it works
  const plugins = discoverNpmPlugins();
  const installed = plugins.find((p) => p.includes(packageName) || p.includes(npmPackage));

  if (installed) {
    const manifest = loadPluginManifest(installed);
    if (manifest) {
      console.log('');
      console.log(`Plugin: ${bold(manifest.displayName)} v${manifest.version}`);
      console.log(`${dim(manifest.description)}`);
    }
  }
}

/**
 * Remove a plugin
 */
export async function removePlugin(pluginName: string): Promise<void> {
  const plugins = discoverAllPlugins();

  // Find the plugin by name (match by manifest name or npm package name)
  const plugin = plugins.find(
    (p) =>
      p.manifest.name === pluginName ||
      p.manifest.name === `bakery-plugin-${pluginName}` ||
      path.basename(p.path) === pluginName ||
      path.basename(p.path) === `bakery-plugin-${pluginName}`
  );

  if (!plugin) {
    console.error(red(`Plugin not found: ${pluginName}`));
    console.log('');
    console.log('Installed plugins:');
    for (const p of plugins) {
      console.log(`  ${dim('•')} ${p.manifest.name}`);
    }
    process.exit(1);
  }

  if (plugin.source === 'npm') {
    // Remove via package manager
    const npmPackage = plugin.manifest.name;
    console.log(`Removing ${cyan(npmPackage)}...`);

    const { code: bunCheck } = await runCommand('bun', ['--version'], { silent: true });
    const packageManager = bunCheck === 0 ? 'bun' : 'npm';

    const { code } = await runCommand(packageManager, ['remove', npmPackage]);

    if (code !== 0) {
      console.error(red(`Failed to remove ${npmPackage}`));
      process.exit(1);
    }

    console.log(green(`Successfully removed ${npmPackage}`));
  } else if (plugin.source === 'user') {
    // Remove from user plugins directory
    console.log(`Removing plugin from ${dim(plugin.path)}...`);

    try {
      fs.rmSync(plugin.path, { recursive: true, force: true });
      console.log(green(`Successfully removed ${plugin.manifest.displayName}`));
    } catch (err) {
      console.error(
        red(`Failed to remove plugin: ${err instanceof Error ? err.message : String(err)}`)
      );
      process.exit(1);
    }
  } else {
    // Local plugin - just warn, don't delete project files
    console.log(yellow(`Plugin ${plugin.manifest.displayName} is a local plugin`));
    console.log(`Remove it manually from: ${plugin.path}`);
  }
}

/**
 * Scaffold a new plugin
 */
export async function createPlugin(name?: string): Promise<void> {
  const pluginName = name ?? 'my-plugin';
  const pluginDir = path.join(process.cwd(), `bakery-plugin-${pluginName}`);

  if (fs.existsSync(pluginDir)) {
    console.error(red(`Directory already exists: ${pluginDir}`));
    process.exit(1);
  }

  console.log(`Creating plugin ${cyan(pluginName)}...`);
  console.log('');

  // Create plugin directory structure
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(path.join(pluginDir, 'templates'), { recursive: true });

  // Create plugin.json
  const manifest: PluginManifest = {
    name: `bakery-plugin-${pluginName}`,
    displayName: `${pluginName
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')} Plugin`,
    description: `A Bakery plugin for ${pluginName}`,
    version: '0.1.0',
    author: '',
    templates: [],
    archetypes: [],
    addons: ['./templates/addon'],
    keywords: ['bakery', 'plugin', pluginName],
    dependencies: [],
  };

  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  // Create a sample addon template
  const addonDir = path.join(pluginDir, 'templates', 'addon');
  fs.mkdirSync(addonDir, { recursive: true });

  const templateManifest = {
    name: `${pluginName}-addon`,
    displayName: `${manifest.displayName} Addon`,
    description: `Adds ${pluginName} support to your project`,
    version: '0.1.0',
    type: 'addon',
    files: ['files/'],
    transforms: [],
  };

  fs.writeFileSync(
    path.join(addonDir, 'template.json'),
    `${JSON.stringify(templateManifest, null, 2)}\n`
  );

  // Create files directory with sample file
  const filesDir = path.join(addonDir, 'files');
  fs.mkdirSync(filesDir, { recursive: true });

  fs.writeFileSync(
    path.join(filesDir, `${pluginName}.config.ts`),
    `// ${manifest.displayName} configuration
export default {
  // Add your configuration here
};
`
  );

  // Create index.ts for hooks
  const indexContent = `/**
 * ${manifest.displayName}
 *
 * ${manifest.description}
 */

import type { BakeryPlugin } from 'bakery/plugins';

const plugin: BakeryPlugin = {
  name: '${manifest.name}',
  version: '${manifest.version}',
  displayName: '${manifest.displayName}',
  description: '${manifest.description}',

  // Lifecycle hooks
  hooks: {
    beforeGenerate: async (ctx) => {
      ctx.logger.info('${manifest.displayName} is processing...');
      // Add your pre-generation logic here
    },

    afterGenerate: async (ctx) => {
      ctx.logger.info('${manifest.displayName} completed!');
      // Add your post-generation logic here
      // You can return commands to run after generation:
      // return {
      //   commands: [
      //     { command: 'bun', args: ['add', 'some-dep'], description: 'Installing dependencies' },
      //   ],
      // };
    },
  },
};

export default plugin;
`;

  fs.writeFileSync(path.join(pluginDir, 'index.ts'), indexContent);

  // Create package.json
  const packageJson = {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    type: 'module',
    main: './index.ts',
    keywords: manifest.keywords,
    bakery: {
      templates: manifest.templates,
      archetypes: manifest.archetypes,
      addons: manifest.addons,
    },
    peerDependencies: {
      bakery: '>=0.1.0',
    },
  };

  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`
  );

  // Create README
  const readme = `# ${manifest.displayName}

${manifest.description}

## Installation

\`\`\`bash
bun add ${manifest.name}
\`\`\`

Or for local development, place this directory in:
- \`./bakery-plugins/\` (project-local)
- \`~/.bakery/plugins/\` (user-global)

## Usage

This plugin provides an addon that can be selected during project generation.

## Development

1. Edit \`plugin.json\` to configure templates, archetypes, and addons
2. Edit \`index.ts\` to add lifecycle hooks
3. Add template files to \`templates/\`

## License

MIT
`;

  fs.writeFileSync(path.join(pluginDir, 'README.md'), readme);

  console.log(green('Plugin scaffolded successfully!'));
  console.log('');
  console.log(`  ${dim('Directory:')} ${pluginDir}`);
  console.log('');
  console.log(bold('Next steps:'));
  console.log(`  1. ${dim('cd')} bakery-plugin-${pluginName}`);
  console.log(`  2. Edit ${cyan('plugin.json')} to configure your plugin`);
  console.log(`  3. Add templates to ${cyan('templates/')}`);
  console.log(`  4. Add hooks in ${cyan('index.ts')}`);
  console.log('');
  console.log(dim('For local testing, move or symlink to ./bakery-plugins/'));
}

// =============================================================================
// Command Router
// =============================================================================

/**
 * Print help for the plugins command
 */
export function printPluginsHelp(): void {
  console.log(`
${bold('bakery plugins')} - Manage Bakery plugins

${bold('USAGE:')}
  bakery plugins <command> [options]

${bold('COMMANDS:')}
  list                  List installed plugins
  add <name>            Install a plugin from npm
  remove <name>         Remove an installed plugin
  create [name]         Scaffold a new plugin

${bold('EXAMPLES:')}
  ${dim('# List all installed plugins')}
  bakery plugins list

  ${dim('# Install a plugin from npm')}
  bakery plugins add tailwind
  bakery plugins add bakery-plugin-tailwind

  ${dim('# Remove a plugin')}
  bakery plugins remove tailwind

  ${dim('# Create a new plugin')}
  bakery plugins create my-awesome-plugin

${bold('PLUGIN LOCATIONS:')}
  Plugins are discovered from:
  ${green('•')} ./bakery-plugins/      ${dim('(project-local, highest priority)')}
  ${green('•')} ~/.bakery/plugins/     ${dim('(user-global)')}
  ${green('•')} node_modules/          ${dim('(npm packages starting with bakery-plugin-)')}
`);
}

/**
 * Handle the plugins subcommand
 */
export async function handlePluginsCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
    case 'ls':
    case undefined:
      await listPlugins();
      break;

    case 'add':
    case 'install':
    case 'i': {
      const packageName = args[1];
      if (!packageName) {
        console.error(red('Missing package name'));
        console.log(`Usage: bakery plugins add <name>`);
        process.exit(1);
      }
      await addPlugin(packageName);
      break;
    }

    case 'remove':
    case 'rm':
    case 'uninstall': {
      const pluginName = args[1];
      if (!pluginName) {
        console.error(red('Missing plugin name'));
        console.log(`Usage: bakery plugins remove <name>`);
        process.exit(1);
      }
      await removePlugin(pluginName);
      break;
    }

    case 'create':
    case 'new':
    case 'init':
      await createPlugin(args[1]);
      break;

    case 'help':
    case '-h':
    case '--help':
      printPluginsHelp();
      break;

    default:
      console.error(red(`Unknown subcommand: ${subcommand}`));
      printPluginsHelp();
      process.exit(1);
  }
}
