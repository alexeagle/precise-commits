import * as fs from 'fs';
import { dirname, extname, join } from 'path';
import * as ts from 'typescript';

import { PreciseFormatter } from '../precise-formatter';
import { CharacterRange } from '../utils';

const ignore = require('ignore');
const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();

const tswarn: PreciseFormatter<ts.CompilerOptions> = {
  /**
   * Resolve the relevant config for the given modified file path.
   */
  resolveConfig(modifiedFilePath: string): ts.CompilerOptions | null {
    // Search up for 'tsconfig.json' like an editor does
    let configFileName: string | undefined;
    let searchPath = modifiedFilePath;
    while (!configFileName) {
      searchPath = dirname(searchPath);
      if (!searchPath) throw new Error(`no tsconfig.json file found above ${modifiedFilePath}`);
      const candidate = join(searchPath, 'tsconfig.json');
      if (fs.existsSync(candidate)) {
        configFileName = candidate;
      }
    }
    const configContent = ts.readConfigFile(configFileName, ts.sys.readFile);
    const configParseResult = ts.parseJsonConfigFileContent(configContent, ts.sys, '.');
    return configParseResult.options;
  },
  /**
   * Return true if the whole file has already been formatted appropriately based on
   * the resolved prettier config. We can use this as a check to skip unnecessary work.
   */
  isAlreadyFormatted(
    fileContents: string,
    config: PrettierOptions | null,
  ): boolean {
    return check(fileContents, { ...config });
  },
  /**
   * Run prettier's check mode on the given ranges and return true if they are all
   * already formatted appropriately based on the given prettier config.
   */
  checkFormattingOfRanges(
    fileContents: string,
    config: PrettierOptions | null,
    characterRanges: CharacterRange[],
  ): boolean {
    let formattedContents = fileContents;
    return characterRanges.every(characterRange => {
      return check(formattedContents, {
        ...config,
        ...{
          rangeStart: characterRange.rangeStart,
          rangeEnd: characterRange.rangeEnd,
        },
      });
    });
  },
  /**
   * Run prettier on each character range pair given, and apply the
   * difference as a patch to the original contents using an implementation
   * of the Myer's diff algorithm.
   */
  formatRanges(
    fileContents: string,
    config: PrettierOptions | null,
    characterRanges: CharacterRange[],
  ): string {
    let patches: any = [];
    characterRanges.forEach(characterRange => {
      const diffs = dmp.diff_main(
        fileContents,
        format(fileContents, {
          ...config,
          ...{
            rangeStart: characterRange.rangeStart,
            rangeEnd: characterRange.rangeEnd,
          },
        }),
      );
      patches = [...patches, ...dmp.patch_make(fileContents, diffs)];
    });
    const [formattedContents] = dmp.patch_apply(patches, fileContents);
    return formattedContents;
  },
  /**
   * Generate a predicate function which will return true if the filename
   * is not excluded via a .prettierignore file.
   */
  generateIgnoreFilePredicate(workingDirectory: string) {
    const prettierIgnoreFilePath = join(workingDirectory, '.prettierignore');
    /**
     * If there is no .prettierignore file present, simply always return true
     * from the predicate
     */
    if (!fs.existsSync(prettierIgnoreFilePath)) {
      return () => true;
    }
    /**
     * Use "ignore"'s createFilter() method to create a predicate
     */
    const prettierIgnoreFileContents = fs.readFileSync(
      prettierIgnoreFilePath,
      'utf8',
    );
    return ignore()
      .add(prettierIgnoreFileContents)
      .createFilter();
  },
  /**
   * Only support .ts / .tsx files.
   */
  hasSupportedFileExtension(filename: string) {
    return extname(filename).match(/^tsx?$/);
  },
};

export default tswarn;
