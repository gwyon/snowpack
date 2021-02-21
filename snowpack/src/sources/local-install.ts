import {install, InstallOptions as EsinstallOptions, InstallTarget} from 'esinstall';
import * as colors from 'kleur/colors';
import {performance} from 'perf_hooks';
import util from 'util';
import url from 'url';
import {buildFile} from '../build/build-pipeline';
import {logger} from '../logger';
import {ImportMap, SnowpackBuiltFile, SnowpackConfig} from '../types';

interface InstallOptions {
  config: SnowpackConfig;
  isDev: boolean;
  isSSR: boolean;
  installOptions: EsinstallOptions;
  installTargets: (InstallTarget | string)[];
}

interface InstallResult {
  importMap: ImportMap;
  needsSsrBuild: boolean;
}

export async function installPackages({
  config,
  isDev,
  isSSR,
  installOptions,
  installTargets,
}: InstallOptions): Promise<InstallResult> {
  if (installTargets.length === 0) {
    return {
      importMap: {imports: {}} as ImportMap,
      needsSsrBuild: false,
    };
  }
  let needsSsrBuild = false;

  const finalResult = await install(installTargets, {
    cwd: config.root,
    alias: config.alias,
    logger: {
      debug: (...args: [any, ...any[]]) => logger.debug(util.format(...args)),
      log: (...args: [any, ...any[]]) => logger.info(util.format(...args)),
      warn: (...args: [any, ...any[]]) => logger.warn(util.format(...args)),
      error: (...args: [any, ...any[]]) => logger.error(util.format(...args)),
    },
    ...installOptions,
    rollup: {
      plugins: [
        {
          name: 'esinstall:snowpack',
          async load(id: string) {
            // console.log('load()', id);
            needsSsrBuild = needsSsrBuild || id.endsWith('.svelte');
            // TODO: Since this is new, only introduce for non-JS files.
            // Consider running on all files in future versions.
            if (id.endsWith('.js')) {
              return;
            }
            const output = await buildFile(url.pathToFileURL(id), {
              config,
              isDev,
              isSSR,
              isPackage: true,
              isHmrEnabled: false,
            });
            let jsResponse;
            for (const [outputType, outputContents] of Object.entries(output)) {
              if (jsResponse) {
                console.log(`load() Err: ${Object.keys(output)}`);
              }
              if (!jsResponse || outputType === '.js') {
                jsResponse = outputContents;
              }
            }
            return jsResponse;
          },
        },
      ],
    },
  });
  logger.debug('Successfully ran esinstall.');
  return {importMap: finalResult.importMap, needsSsrBuild};
}
