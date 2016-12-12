# json-graph-serializer

This is a very simple serializer/deserializer of javascript objects graphs that uses the JSON.stringify/parse
with `replacer` and `reviver` functions to handle references across the graph.

If you are looking for a **data objects** serializer that produces compact and readable JSON, this is for you.

If you are looking for a true **javascript objects** serializer that handles types (constructors) and is 
able to restore actual javascript objects, you'd better use https://www.npmjs.com/package/serializr.


