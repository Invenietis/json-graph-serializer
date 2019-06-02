export interface ISerializeOptions {
    prefix?: string;
    substitor?: (v: any, rT: string) => string;
}

export interface IDeserializeOptions {
    prefix?: string;
    activator?: (v: any, rT: string) => any;
}

/**
 * Serializes an object in JSON that can contain internal relationships.
 * Serialized objects contain a "<prefix>i" field that is the index
 * in the breadth-first traversal of the graph done by JSON.stringify().
 * References to already serialized objects are exposed as single-property
 * objects like { "<prefix>r": idx }.
 * The deserialize function uses the index to restore the complete graph.
 * Parameter prefix is optional. It defaults to "~$£€".
 * @param {object} o - The object to serialize
 * @param {object} options - Serialization options: prefix (default '~$£€'), substitor
 * @return {string} The serialized value.
 */
export function serialize(o: object, options?: ISerializeOptions): string;

/**
 * Deserializes a previously-serialized object graph.
 * Parameter prefix is optional and defaults to "~$£€": it must, of course,
 * be the same as the prefix used to serialize the graph.
 * @param {(string|object)} o - The serialized string, or parsed object.
 * @param {object} options - Serialization options: prefix (default '~$£€'), activator
 * @return {object} The deserialized value.
 */
export function deserialize(s: string | object, options?: IDeserializeOptions): any;
