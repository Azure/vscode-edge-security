/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as D from 'io-ts/Decoder';
import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';

import { ArraySchema, EnumSchema, RangeSchema, Schema, StringLiteralSchema } from '../common/schema';

interface Scd {
  scenarioConfigDefinition: ScdDefinition;
}

interface ScdDefinition {
  name: string;
  documents: Array<Document>;
}

interface Document {
  configurations: Array<Configuration>;
}

interface Configuration {
  name: string;
  version: string;
  schemaversion: string;
  context: string;
  settings: Array<Setting>;
}

interface Setting {
  name: string;
  defaultvalue: string;
  datatype: string;
  lowrange?: string;
  highrange?: string;
  allowedvalues?: string;
}

const Setting: D.Decoder<unknown, Setting> = pipe(
  D.struct({
    name: D.string,
    defaultvalue: D.string,
    datatype: D.string,
  }),
  D.intersect(
    D.partial({
      lowrange: D.string,
      highrange: D.string,
      allowedvalues: D.string,
    })
  )
);

const Configuration: D.Decoder<unknown, Configuration> = D.struct({
  name: D.string,
  version: D.string,
  schemaversion: D.string,
  context: D.string,
  settings: D.array(Setting),
});

const Document: D.Decoder<unknown, Document> = D.struct({
  configurations: D.array(Configuration),
});

const ScdDefinition: D.Decoder<unknown, ScdDefinition> = D.struct({
  name: D.string,
  documents: D.array(Document),
});

const Scd: D.Decoder<unknown, Scd> = D.struct({
  scenarioConfigDefinition: ScdDefinition,
});

function stringLiteralToSchema(value: string): StringLiteralSchema {
  return {
    type: 'stringLiteral',
    valueSchema: 'string',
    value: value,
  };
}

function stringLiteralToEnumSchema(values: Array<string>): EnumSchema {
  return {
    type: 'enum',
    valueSchema: 'string',
    enumValues: values.map((value) => {
      return {
        name: '', 
        enumValue: value,
      };
    })
  };
}

function settingtoRangeSchema(lowvalue: string, highvalue: string): RangeSchema {
  return {
    type: 'range',
    valueSchema: 'string',
    rangeValues: {
      lowvalue: Number(lowvalue), 
      highvalue: Number(highvalue) 
    }
  };
}

function settingsToSchema(settings: Setting[]): Schema {
  return {
    type: 'object',
    fields: settings.map((component) => {
      if (component.lowrange && component.highrange) {
        return {
          name: component.name,
          schema: settingtoRangeSchema(component.lowrange, component.highrange),
        };
      } else if (component.allowedvalues) {
        const allowedValues = component.allowedvalues.split(','); 
        return {
          name: component.name, 
          schema: stringLiteralToEnumSchema(allowedValues), 
        };
      }
      else {
        return {
          name: component.name,
          schema: stringLiteralToSchema(component.defaultvalue),
        };
      }
    }),
  };
}

function scenarioConfigurationToSchema(
  scenarioConfiguration: Configuration
): ArraySchema {
  return {
    type: 'array',
    elementSchema: {
      type: 'object',
      fields: [
        {
          name: 'name',
          schema: stringLiteralToSchema(scenarioConfiguration.name),
        },
        {
          name: 'schemaversion',
          schema: stringLiteralToSchema(scenarioConfiguration.schemaversion),
        },
        {
          name: 'action',
          schema: 'string',
        },
        {
          name: scenarioConfiguration.name,
          schema: settingsToSchema(scenarioConfiguration.settings),
        },
      ],
    },
  };
}

function docConfigurationToSchema(configuration: Configuration): Schema {
  return {
    type: 'object',
    fields: [
      {
        name: 'schemaversion',
        schema: stringLiteralToSchema(configuration.schemaversion),
      },
      {
        name: 'id',
        schema: 'string',
      },
      {
        name: 'version',
        schema: stringLiteralToSchema(configuration.version),
      },
      {
        name: 'context',
        schema: stringLiteralToSchema(configuration.context),
      },
      {
        name: 'scenario',
        schema: stringLiteralToSchema(configuration.name),
      },
    ],
  };
}

function osConfigToSchema(osConfig: Configuration): Schema {
  return {
    type: 'object',
    fields: [
      {
        name: 'Document',
        schema: docConfigurationToSchema(osConfig),
      },
      {
        name: 'Scenario',
        schema: scenarioConfigurationToSchema(osConfig),
      },
    ],
  };
}

function scdToSchema(scd: Scd): Schema {
  return {
    type: 'object',
    fields: [
      {
        name: 'OsConfiguration',
        schema: osConfigToSchema(
          scd.scenarioConfigDefinition.documents[0].configurations[0]
        ),
      },
    ],
  };
}

export function parseModel(content: string): Schema | undefined {
  return pipe(
    Scd.decode(JSON.parse(content)),
    fold(
      (errors) => {
        throw new Error(D.draw(errors));
      },
      (model) => scdToSchema(model)
    )
  );
}