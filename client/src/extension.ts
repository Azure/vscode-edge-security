import * as path from 'path';
import * as vscode from 'vscode';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

import { 
  padUserInput, 
  systemMessage, 
  parameters
} from './openai';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server', 'src', 'server.js')
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'],
      },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{
      scheme: 'file',
      language: 'json',
      pattern: '**/osconfig_desired*.json'
    }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc'),
    },
  };

  client = new LanguageClient(
    'desiredConfigurationLanguageServer',
    'DC Language Server',
    serverOptions,
    clientOptions
  );

  client.start(); 

  const endpoint = process.env['AZURE_OPENAI_ENDPOINT2'];
  const azureApiKey = process.env['AZURE_OPENAI_KEY2'];
  const deploymentId = process.env['AZURE_DEPLOYMENT_ID'];

  vscode.commands.registerCommand('vscode-osconfig.DCGenerator', async () => {
    const userInput = await vscode.window.showInputBox({
      placeHolder: 'Enter setting here',
      prompt: 'Enter in desired configuration setting for DC document (Ex: Network Access)'
    });

    if (userInput === undefined) {
      vscode.window.showErrorMessage('Not a valid input');
    } else if (userInput === '') {
      vscode.window.showErrorMessage('Setting configuration is required to execute this action');
    } else {
      vscode.window.showInformationMessage('Generating DC Doc with: ' + userInput);
      const userMessage = padUserInput(userInput); 
      const messages = [
        { role: 'system', content: systemMessage},
        { role: 'user', content: userMessage}
      ];
      
      if ((azureApiKey && endpoint)) {
        const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
        //result variable will be used in future implementation
        const result = await client.getChatCompletions(deploymentId, messages, parameters);
      }
    }
  });
} 

export function deactivate(): Thenable<void> | undefined {
  return client ? client.stop() : undefined;
}
