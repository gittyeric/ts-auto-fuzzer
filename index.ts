import { assertType } from 'typescript-is';
import { default as randomSeed, RandomSeed } from 'random-seed';
import { set } from 'lodash';

// Public exported types
type Options = {
  randomSeed: string; // Defaults to a constant for deterministic runs
  integerNumbersOnly: boolean;
  numberBounds: [number, number];
  stringLengthBounds: [number, number];
  arrayLengthBounds: [number, number];
  dateBounds: [Date, Date];
  booleanTrueOdds: number;
};
export type FactoryOptions = Partial<Options>;

export function newRandomFactory<T>(
  fillCallback: (obj: any) => T,
  options?: FactoryOptions
): (overrideOptions?: Partial<Options>) => T {
  const rand = randomSeed.create();
  const schema = deriveSchema(fillCallback, rand);
  const opts = {...defaultOptions, ...(options || {})}
  return (overrides) => {
    const generated = generateInstance<T>(schema, rand, { ...opts, ...(overrides || {}) });
    return fillCallback(generated);
  }
}

// Whoops you weren't supposed to see this, the fill(obj) callback
// is just a facade to typescript-is's brilliant assertType "macro" transformer.
// Basically if you have have problems with this lib, you likely have problems
// with your typescript-is integration!
export const fill = assertType;

// Inner types, don't look behind the curtain or you'll see the ts-is crutch and hasty code

// Keep abusing the ts-is lib workhorse till we throw enough
// S at the wall for a fully derived Schema we can re-use
// on subsequent calls
type DerivedObjSchema = {
  [fieldName: string]: string;
}
type DerivedSchema = string | DerivedObjSchema;

type SupportedPrimitives = 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array' | 'undefined';

// Only the bits of ts-lib's Error that matter for auto-gen
type TypeGuardError = {
  path: string[];
  reason: {
    type: 'missing-property' | SupportedPrimitives;
    property?: string;
  };
};

const YEAR = 1000 * 60 * 60 * 24 * 365;
const now = () => new Date().getTime();
const defaultOptions: Options = {
  randomSeed: '1435243er524352345',
  integerNumbersOnly: false,
  numberBounds: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  stringLengthBounds: [0, 1024],
  arrayLengthBounds: [0, 101],
  dateBounds: [new Date(0), new Date(now() + YEAR)],
  booleanTrueOdds: 0.5,
};

function randomNumber(fieldName: string, rand: RandomSeed, opts: Options): number {
  const maxDiff = opts.numberBounds[1] - opts.numberBounds[0];
  const raw = rand.floatBetween(0, maxDiff) + opts.numberBounds[0];
  if (opts.integerNumbersOnly) {
    return Math.round(raw);
  }
  return raw;
}

function randomDate(fieldName: string, rand: RandomSeed, opts: Options): Date {
  return new Date(rand.intBetween(opts.dateBounds[0].getTime(), opts.dateBounds[1].getTime()));
}

function randomString(fieldName: string, rand: RandomSeed, opts: Options): string {
  const len = rand.intBetween(opts.stringLengthBounds[0], opts.stringLengthBounds[1]);
  return rand.string(len);
}

function randomBoolean(fieldName: string, rand: RandomSeed, opts: Options): boolean {
  return opts.booleanTrueOdds < rand.random();
}

function findValueGeneratorBy(fieldType: string): ((fn: string, r: RandomSeed, o: Options) => any) {
  // Special case, typed array
  if (fieldType.endsWith(']')) {
    const innerGen = findValueGeneratorBy(fieldType.substring(1, fieldType.length - 1));
    return (f, r, o) => {
      const len = r.intBetween(o.arrayLengthBounds[0], o.arrayLengthBounds[1]);
      const arr = [] as any[];
      for (let i = 0; i < len; i++) {
        arr.push(innerGen(f, r, o));
      }
      return arr;
    };
  }
  // Special case, typed object
  if (fieldType.endsWith('}')) {
    const parsed = JSON.parse(fieldType);
    const keys = Object.keys(parsed);
    return (f, r, o) => {
      const obj = {} as any;
      keys.forEach((k) => {
        const reserialized = typeof(parsed[k]) === 'string' ? parsed[k] : JSON.stringify(parsed[k]);
        obj[k] = findValueGeneratorBy(reserialized)(`${f}.${k}`, r, o);
      });
      return obj;
    };
  }

  switch (fieldType) {
    case 'string': {
      return randomString;
    }
    case 'boolean': {
      return randomBoolean;
    }
    case 'date': {
      return randomDate;
    }
    case 'number': {
      return randomNumber;
    }
    case 'undefined': {
      return () => undefined;
    }
    // Types only for when deriving schema

    // Return empty object to start traversing inward
    case 'object': {
      return () => { return {} };
    }
    // Assume number array at first till corrected
    case 'array': {
      return (f, r, o) => [randomNumber(f, r, o)];
    }
  }
  return (f, r, o) => { throw new Error(`Field ${f}'s type of ${fieldType} is not directly supported, please overwrite this value yourself in newRandomFactory's fill callback`) };
}

function fixMissingField(
  halfassObj: object,
  schema: DerivedObjSchema,
  fieldName: string,
  rand: RandomSeed,
  opts: Options
): void {
  // Just always guess the missing field type is a number at first since it's cheap to
  // generate and probably the 2nd most common after strings.
  set(schema, fieldName, 'number');
  set(halfassObj, fieldName, randomNumber(fieldName, rand, opts));
}

function createErrorMsg(fieldName: string, fieldType: string): string {
  return `Sorry! There's no mock auto-generate support for ${fieldType} types at field ${fieldName}! Try overwriting this field yourself in newRandomFactory's fill callback to a value that obeys this type`
}

function fixFieldType(
  halfassObj: object,
  schema: DerivedObjSchema,
  fieldName: string,
  fieldType: string,
  rand: RandomSeed,
  opts: Options
): void {
  const randGen = findValueGeneratorBy(fieldType);
  if (!randGen) {
    throw new Error(createErrorMsg(fieldName, fieldType));
  }

  // Special case: Arrays
  if (fieldName.endsWith(']')) {
    const arrType = `[${fieldType}]`;
    const arrayGen = findValueGeneratorBy(arrType);
    const baseFieldName = fieldName.substring(0, fieldName.lastIndexOf('['));
    set(schema, baseFieldName, arrType);
    set(halfassObj, baseFieldName, arrayGen(fieldName, rand, opts));
  }
  // Simple primitive
  else {
    set(schema, fieldName, fieldType);
    set(halfassObj, fieldName, randGen(fieldName, rand, opts));
  }
}

export const schemaOptions: Options = {
  randomSeed: '1',
  integerNumbersOnly: false,
  numberBounds: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  stringLengthBounds: [1, 1],
  arrayLengthBounds: [1, 1],
  dateBounds: [new Date(0), new Date(now() + YEAR)],
  booleanTrueOdds: 0.5,
};

function deriveSchema<T>(
  fillCallback: (obj: Partial<T>) => T,
  rand: RandomSeed
): DerivedSchema {
  let seenErrorHashes = new Set<string>();
  const sheetAtWall = {} as any;
  let lastField = ['', 'unknown'];
  const objSchema: DerivedObjSchema = {};

  // Basically a while true loop but just in case...
  for (let i = 0; i < 10000; i++) {
    try {
      fillCallback(sheetAtWall);
      // Serialize schema
      Object.keys(objSchema).forEach((k) => {
        objSchema[k] = typeof objSchema[k] === 'string' ? objSchema[k] : JSON.stringify(objSchema[k]);
      });
      return objSchema;
    } catch (e) {
      if (!e.hasOwnProperty('path')) {
        throw new Error(
          createErrorMsg(lastField[0], lastField[1])
        );
      }
      const tge = e as TypeGuardError;
      const path = tge.path
        .slice(1)
        .join('.')
        .replace(/\.\[/g, '[');
      const thisErrorHash = `${tge.path.join(',')}~${tge.reason.type}`;
      if (seenErrorHashes.has(thisErrorHash)) {
        throw new Error(
          createErrorMsg(path, tge.reason.type)
        );
      }

      const errorType = tge.reason.type as TypeGuardError['reason']['type'];
      if (errorType === 'missing-property') {
        const localFieldName = tge.reason.property as string;
        const newFieldName = `${path ? path + '.' : ''}${localFieldName}`;
        lastField = [newFieldName, 'unknown'];
        fixMissingField(sheetAtWall, objSchema, newFieldName, rand, schemaOptions);
      }
      // Special case: Root object is actually a flat primitive
      else if (Object.keys(sheetAtWall).length === 0 && ['string', 'number', 'boolean', 'date'].includes(errorType)) {
        return errorType;
      }
      else {
        lastField = [path, errorType];
        const validType = errorType === 'object' ? '{}' : errorType;

        fixFieldType(sheetAtWall, objSchema, path, validType, rand, schemaOptions);
      }
    }
  }
  throw new Error(
    createErrorMsg(lastField[0], lastField[1])
  );
}

function generateInstance<T>(schema: DerivedSchema, rand: RandomSeed, opts: Options): T {
  if (typeof(schema) === 'string') {
    return findValueGeneratorBy(schema)('', rand, opts);
  }
  const rando = {};
  Object.entries(schema).forEach(([field, valType]) => {
    const gen = findValueGeneratorBy(valType);
    set(rando, field, gen(field, rand, opts));
  });
  return rando as T;
}
