# json-graph-serializer

This is a very simple serializer/deserializer of javascript objects graphs that uses the JSON.stringify/parse
with `replacer` and `reviver` functions to handle references across the graph.

If you are looking for a **data objects** serializer that produces compact and readable JSON, this is for you.

If you are looking for a true **javascript objects** serializer that handles types (constructors) and is
able to restore actual javascript objects, you'd better use https://www.npmjs.com/package/serializr.

## Using

```sh
npm i @signature/json-graph-serializer
```

```js
import { serialize, deserialize } from "@signature/json-graph-serializer";

const obj = {hello: "world", array: []};
obj.array.push(obj);

const serializedGraph = serialize(obj, {prefix: ""});
console.log(serializedGraph);
/*
{
  "hello": "world",
  "array": [{
    "þ": [1, "A"]
  }, {
    ">": 0
  }],
  "°": 0
}
*/

const deserializedGraph = deserialize(serializedGraph, {prefix: ""});
console.dir(deserializedGraph); // { hello: 'world', array: [ [Circular] ] }

```

## Features

- Produces readable and compact objects graphs.
- Supports Set, Map and, of course, mere javascript Arrays.
- Uses 3 meta property names with a configurable prefix, that, for `{prefix: ""}`, are as simple and short as:
  - `"°"`: for object index.
  - `">"`: for object reference.
  - `"þ"`: for object type marker.
- Detects whenever existing names clashes with one of the three meta names (prefix should then be changed accordingly).
- Options support `substitutor`/`activator` functions during serializion/deserialization mainly to "cut" references to external objects and rebind them during deserialization.

## Limitations

- Only works on mutable objects (freezed objects are not supported).
- WeakMap and WeakSet are not supported. (Who on earth would like to persist weeak maps?)
