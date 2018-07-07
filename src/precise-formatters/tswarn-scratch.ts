// TODO: make it more like how tsc.js gets built into a single-file executable with no require()

//import * as ts from 'typescript';
import * as ts from 'typescript/lib/tsserverlibrary';

console.log('running typescript', ts.version);
//Error.stackTraceLimit = Infinity;

const commandLine = ts.parseCommandLine(ts.sys.args);
let configFileName: string | undefined;
if (commandLine.options.project) {

    const fileOrDirectory = commandLine.options.project;
    if (!fileOrDirectory /* current directory "." */ || ts.sys.directoryExists(fileOrDirectory)) {
        configFileName = `${fileOrDirectory}/tsconfig.json`;
    }
    else {
        configFileName = fileOrDirectory;
    }
}

const commandLineOptions = commandLine.options;
if (configFileName) {
    const configContent = ts.readConfigFile(configFileName, ts.sys.readFile);
    const configParseResult = ts.parseJsonConfigFileContent(configContent, ts.sys, '.');
    ts.createLanguageService({}).getCodeFixesAtPosition()
    const program = ts.createProgram(configParseResult.fileNames, configParseResult.options);
    for (const sf of program.getSourceFiles()) {
        //const suggestion = ts.getPreEmitDiagnostics(program);
        const suggestion = program.getSuggestionDiagnostics(sf);
        console.log(ts.formatDiagnostics(suggestion, {
            getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
            getNewLine: () => ts.sys.newLine,
            getCanonicalFileName: (f: string) => f,
        }));
    }
}
