# ts-auto-fuzzer

This NPM library lets you automatically generate randomized object instances from just your Typescript types in 1 line of boilerplate!

## Example Usage:

Let's say we have a complex TS type or interface such as:

```
interface MyJSONType {
  name: string;
  age: number;
  birth: Date;
  isCool: boolean;
  flatArray: string[],
  array2d: number[][],
  nestedObj: {
    key1: number[];
    nestedObj2: {
      key2: number;
    };
  };
  objArray: {
    num: number,
    bools: boolean[]
  }[],
};
```

Now instantly generate random valid object instances by reflection with:

```
import { newRandomFactory, fill } from 'ts-auto-fuzzer';

// Create a factory that infuses mystical power into the fill<> lib call.
const fuzzFactory = newRandomFactory((empty) => fill<MyJSONType>(empty));

// And ready to insta-mint some healthy workouts for your tests
console.log(fuzzFactory());
```

Output:

```
{
  name: "?k.='",
  age: 96943,
  birth: 2022-05-12T08:25:14.478Z,
  isCool: false,
  flatArray: [ 'F0P' ],
  array2d: [ [ 66824 ] ],
  nestedObj: { key1: [ 25048 ], nestedObj2: { key2: 95687 } },
  objArray: [ { num: 10497, bools: [true, false] } ]
}
```

## API

```
function newRandomFactory<T>(
  fillCallback: (obj: any) => T,
  options?: Partial<Options>
): (overrideOptions?: Partial<Options>) => T
```

`fillCallback: (obj: Partial<T>) => T`: A callback that takes a fuzzed (potentially empty) object, potentially overwrites values on it, and always ends in a call to fill<T>(obj) for magical reasons that ensure the randomized object is compliant with T.  T must be a JSON-compatible type; no functions, classes (eww) etc. You _must_ specify fill's type parameter (ex. `fill<MyJSONType>`) with a concrete (non-generic) type!  That's how the magic knows what fields to randomize.
`options?: FactoryOptions`: Optional.  Specify general behavior of randomly generated ranges and values.
`Returns (overwriteOptions?: FactoryOptions) => T`: A factory function that returns random-valued instances of T when called.  The factory function also be invoked with options that take precedence over the Factory-scoped options.
``:

```
function fill<T>(obj: any): T
```

Fills a fuzzed `obj` with random valid values.  fill _must_ be the return value of your fillCallback. `obj` MUST be the same (or copied/modified version of) the obj passed to your fillCallback.  You generally should not be calling fill() outside of returning in your fillCallback.

`obj: any`: This MUST be the same (or modified copy of) the object handed to your fillCallback when creating a newRandomFactory


The magical trick is to specify a _concrete, JSON-compatible type / interface_ in the fill call of your fillCallback callback.  This library is largely a hack on top of (and alias of!) `typescript-is`'s `assertType` that automatically generates a TS type
predicate function using JS code generation in a pre-compile phase, see Under the Hood for more.

## NPM Installation

```
npm install ts-auto-fuzzer
```

Then follow the steps to tweak your TS compilation by following the instructions for the [typescript-is](https://www.npmjs.com/package/typescript-is) module which this library cowardly wraps and blames for now if you have issues.
This lib includes both typescript-is and ttypscript so neither are required for individual install, this lib exposes all the components you need to be warm and fuzzy.

After `ttypscript` / `typescript-is` setup is complete, A good test to make sure typescript-is works properly for you would be:

```
import { fill } from 'ts-auto-fuzzer';

// This shouldn't throw an Error if compilation is hooked up proper
fill<string>('test');
```

(`ts-node` tip: `ts-node` can run using ttypescript by adding the `-C ttypscript` option, otherwise you should only be running your compiled JS directly after building)

Now the Examples below should work...

### Examples

#### 1. Configure random ranges to produce tiny objects

```
import { newRandomFactory, fill, FactoryOptions } from 'ts-auto-fuzzer';

const tinyObjOptions: FactoryOptions = {
  numberBounds: [0, 100000],
  stringLengthBounds: [0, 5],
  integerNumbersOnly: true,
  arrayLengthBounds: [1, 1],
  booleanTrueOdds: 0.5,
  dateBounds: [new Date(Date.parse('2022-05-12T08:20:13.901Z')), new Date()],
}

const tinyObjFactory = newRandomFactory((fuzzed) => fill<MyJSONType>(fuzzed), tinyObjOptions);
console.log(tinyObjFactory());

// Can also override options on a per call basis:
tinyObjFactory({ booleanTrueOdds: 1 }).isCool === true;
```

Output:

```
{
  name: '?X2',
  age: 86800,
  birth: 2022-05-12T08:54:14.643Z,
  isCool: true,
  flatArray: [ 'w' ],
  array2d: [ [ 37312 ] ],
  nestedObj: { key1: [ 37236 ], nestedObj2: { key2: 98895 } },
  objArray: [ { num: 88497, bools: [Array] } ]
}
```

### 2. Works on primitives too

Pretty boring but if you insist, let's at least generate with a 1 liner to make it fun:

```
console.log(newRandomFactory((f) => fill<string>(f))());
console.log(newRandomFactory((f) => fill<boolean>(f))());
console.log(newRandomFactory((f) => fill<Date>(f))());
```

Output:

```
E?v`p3r7O".^YmGdP7cZk;_lLev3HW/1GP;mletjJ)7F}~TL^PO'9bxf"2S[R<\0:3,doLNqhu]WJ&B\ov;,k,>fJH.XS2,uc3S5$\w&0krHiA-FPb]M-yCrP9f|CFIhJVtX?8:rC%LnQ5JM38k$0gu(W"2>?;n0PSI~+g'Mo&n,swFd?UONW:KiUJ{-E4W3dfJ6f?bJB9!rXwjmXyQ<fj64'dAV;(o8N?4ARkSd%Ph`Ug1EJd^Ccv9bsje+cq.~s,PqG|T[yZ(o6xRG<KQKMd>,AZ-PLD/xm1K(Mh7\K{u
false
2014-11-30T15:56:57.950Z
```

#### 3. Enforce your own additional constraints

Hardcode a field for example:

```
const customObjFactory = newRandomFactory((fuzzed) => 
  fill<MyJSONType>({...fuzzed, name: 'Hardcoded'}));
console.log(customObjFactory());
```

Output:

```
{
  age: 34736,
  birth: 2022-05-12T08:41:28.938Z,
  isCool: false,
  flatArray: [ 'e{(v4' ],
  array2d: [ [ 84454 ] ],
  nestedObj: { key1: [ 90319 ], nestedObj2: { key2: 72158 } },
  objArray: [ { num: 46539, bools: [false] } ],
  name: 'Hardcoded'
}
```

Of course you can always mangle your object after generation, but this way maintains the assertion
that your object is still 100% validly typed after you customize it in your fill callback.

#### 4. Fix string templates and literal types

The v0 approach of this lib makes randomly generating string templates and literals a real PITA, 
so here's some simple workarounds until v1:

```
type ReallyGoodType = {
  id: `${string}-${string}`,
  num: 1 | 2,
  someStr: string,
}

const reallyTypedFactory = newRandomFactory((fuzzed) =>
  fill<ReallyGoodType>({
    ...fuzzed, 
    // Overwrite dumb, inconsistent fuzz values with your validly typed values
    id: '1-2', 
    num: 1
  }));
console.log(reallyTypedFactory());
```

Output:

```
{
  someStr: 'P`{a!/%bvUg10cUl-np)wx/n|B]vN0Ek0|.Y;;J\\L>_p+R?Jx\\x#>E@gQhQ{(\\S7Q&")X[2}>^al3W\'.?',
  id: '1-2',
  num: 1
}
```

No errors!

## Options

You can configure options at both the newRandomFactory(fillCallback, options) scope and at the last second when invoking the factory(takesPrecedenceOptions).

```
type FactoryOptions = {
  randomSeed?: string; // Defaults to a constant for deterministic runs
  integerNumbersOnly?: boolean;
  numberBounds?: [number, number];
  stringLengthBounds?: [number, number];
  arrayLengthBounds?: [number, number];
  dateBounds?: [Date, Date];
  booleanTrueOdds?: number;
};
```

Default Options are:

```
const defaultOptions = {
  randomSeed: '1435243er524352345',
  integerNumbersOnly: false,
  numberBounds: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  stringLengthBounds: [0, 1024],
  arrayLengthBounds: [0, 101],
  dateBounds: [new Date(0), new Date(now() + YEAR)],
  booleanTrueOdds: 0.5,
};
```

## Under the Hood

This lib (ab)uses the typescript-is library, which uses brilliant (but sligthly hacky) pre-compile tricks using "ttypescript"
to basically build the Typescript twice; the 2nd being the tsc you know and love but the 1st being a compilation strictly
to power typscript-is's TS tranformer hook, allowing codegen based on tsc's loaded type information.  Because of this, you
must run the ttsc / ttypscript that wraps your normal tsc / typescript tooling.

Since fill is written well and gives exact errors for type mismatches, you can basically keep throwing stuff at the wall until
you stumble into a DerivedSchema, then you're golden for quickly generating random mock objects that are guranteed to obey the factory type or die trying.

This lib also uses random-seed for most operations, allowing you to set the seed yourself as well for consistent, deterministic test runs.
