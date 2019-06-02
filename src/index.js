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
export function serialize(o, options) {
    const { prefix, substitor } = Object.assign({ prefix: "~$£€" }, options);
    const rR = prefix + ">";
    const rI = prefix + "°";
    const rT = prefix + "þ";
    const marker = Symbol();
    let cleanup = [];
    try {
        let c = 0;
        function markObj(o) { o[marker] = 1; return o; }
        function markNum(n) { return markObj(new Number(n)); }
        function markTyp(s) {
            if (typeof s !== "string") throw new Error("Type must be a String.");
            return markObj(new String(s));
        }
        return JSON.stringify(o, function (k, v) {
            if (k === rR || k === rI || k === rT) {
                if (v !== null && v[marker]) return v;
                throw new Error("Conflicting serialization prefix: property '" + k + "' exists.");
            }
            if (v === null || typeof v !== "object" || v[marker]) return v;
            let ref = v[rI];
            if (ref) {
                if (ref[marker]) return { [rR]: ref };
                throw new Error("Conflicting serialization prefix: property '" + rI + "' exists.");
            }
            v[rI] = ref = markNum(c++);
            cleanup.push(v);
            if (v instanceof Array) {
                v = markObj([markObj({ [rT]: markObj([ref, "A"]) }), ...v]);
            }
            else if (v instanceof Map) {
                v = markObj([markObj({ [rT]: markObj([ref, "M"]) }), ...[...v].map(e => markObj(e))]);
            }
            else if (v instanceof Set) {
                v = markObj([markObj({ [rT]: markObj([ref, "S"]) }), ...v]);
            }
            else if (substitor) {
                let sv = substitor(v, rT);
                if (sv && sv !== v) {
                    v = sv;
                    v[rI] = ref;
                    v[rT] = markTyp(v[rT] || "");
                }
            }
            return v;
        });
    }
    finally {
        cleanup.forEach(o => delete o[rI]);
    }
};

/**
 * Deserializes a previously-serialized object graph.
 * Parameter prefix is optional and defaults to "~$£€": it must, of course,
 * be the same as the prefix used to serialize the graph.
 * @param {(string|object)} o - The serialized string, or parsed object.
 * @param {object} options - Serialization options: prefix (default '~$£€'), activator
 * @return {object} The deserialized value.
 */
export function deserialize(s /*:string|object*/, options) {
    const { prefix, activator } = Object.assign({ prefix: "~$£€" }, options);
    const rR = prefix + ">";
    const rI = prefix + "°";
    const rT = prefix + "þ";
    // Collects externally activated instances so that they won't be
    // processed.
    let extRef = null;
    // Collects untracked objects  so that they will be processed.
    let plainObjs = null;
    const map = [];

    function rev(k, v) {
        let type = null;
        if (v instanceof Array) {
            if (v.length > 0
                && v[0] != null
                && (type = v[0][rT]) !== undefined) {
                v.splice(0, 1);
                switch (type[1]) {
                    case "A": break;
                    case "M": v = Object.assign(new Map(), { "v": v }); break;
                    case "S": v = Object.assign(new Set(), { "v": v }); break;
                    default: throw new Error("Expecting typed array to be 'A', 'M' or 'S'.");
                }
                map[type[0]] = v;
            }
            else {
                if( plainObjs === null ) plainObjs = new Set();
                plainObjs.add( v );
            }
        }
        else if (v !== null) {
            const idx = v[rI];
            if (idx !== undefined) {
                delete v[rI];
                if ((type = v[rT]) !== undefined) {
                    delete v[rT];
                    if (activator) {
                        v = activator(v, type);
                        if (v) {
                            if (extRef === null) extRef = new Set();
                            extRef.add(v);
                        }
                    }
                }
                map[idx] = v;
            }
            else {
                if( plainObjs === null ) plainObjs = new Set();
                plainObjs.add( v );
            }
        }
        return v;
    }

    // This simple depth-first traversal applies the reviver to an already 
    // JSON parsed tree.
    function d(o) {
        if (o) {
            if (o instanceof Array) {
                for (let i = 0; i < o.length; ++i) {
                    const v = o[i];
                    d(v);
                    o[i] = rev(i, v);
                }
            }
            else if (typeof (o) === "object") {
                for (const p in o) {
                    const v = o[p];
                    d(v);
                    o[p] = rev(p, v);
                }
            }
        }
        return o;
    }
    // If its a string, JSON.parse and the reviver handle the first step: registering the 
    // objects in map array and any external references into extRef set.   
    const o = typeof (s) === "string"
        ? JSON.parse(s, rev)
        : rev(undefined, d(s));

    // Second step is to handle the collections (array, map and set).
    function processA(map, a) {
        const len = a.length;
        for (let i = 0; i < len; ++i) {
            const c = a[i];
            if (c) {
                const ref = c[rR];
                if (ref !== undefined) a[i] = map[ref];
            }
        }
    }
    for (let i of map) {
        if (extRef === null || !extRef.has(i)) {
            if (i instanceof Array) {
                processA(map, i);
            }
            else if (i instanceof Map) {
                i.v.forEach(e => processA(map, e));
                i.v.forEach(e => i.set(e[0], e[1]));
                delete i.v;
            }
            else if (i instanceof Set) {
                processA(map, i.v);
                i.v.forEach(e => i.add(e));
                delete i.v;
            }
            else {
                for (const p in i) {
                    const o = i[p];
                    if (o !== null) {
                        const ref = o[rR];
                        if (ref !== undefined) i[p] = map[ref];
                    }
                }
            }
        }
    }
    if( plainObjs !== null )
    {
        for( let i of plainObjs )
        {
            if (i instanceof Array) {
                processA(map, i);
            }
            else {
                for (const p in i) {
                    const o = i[p];
                    if (o !== null) {
                        const ref = o[rR];
                        if (ref !== undefined) i[p] = map[ref];
                    }
                }
            }
        }
    }
    return o;
}