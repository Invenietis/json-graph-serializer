
import { serialize, deserialize } from '../src';

export function testWithIdempotence(o, options, test) {
    const s = serialize(o, options);
    // console.log("  Serialized:", s);
    // s is the serialized string.
    // We test here the deserialze( s: object ):
    const onlyJSON = JSON.parse(s);
    const dFromJSON = deserialize(onlyJSON, options);
    if (test) test(dFromJSON);
    const sBackFromJSON = serialize(dFromJSON, options);
    if (s !== sBackFromJSON) {
        throw new Error("Idempotence failed for JSON object:" + sBackFromJSON);
    }
    const d = deserialize(s, options);
    // console.log("  Deserialized:", d);
    if (test) test(d);
    const s2 = serialize(d, options);
    if (s !== s2) {
        throw new Error("Idempotence failed:" + s2);
    }
    return true;
};
