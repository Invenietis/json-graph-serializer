
// Serializes an object in JSON that can contain internal relationships.
// Serialized objects contain a "<prefix>i" field that is the index in 
// in the breadth-first traversal of the graph done by JSON.stringify.
// References to already serialized objects are exposed as mono property
// objects { "<prefix>r": idx }.
// The deserialize function uses the index to restore the complete graph.
// Parameter prefix is optional. It defaults to "~$£€".
// 
function serialize(o, options) {
    const {prefix,substitor} = Object.assign({prefix:"~$£€"},options);
    const rP = prefix + "r";
    const rI = prefix + "i";
    const marker = Symbol();
    let cleanup = [];
    try
    {
        let c = 0;
        function markNum(n) { let o = new Number(n);o[marker]=o; return o; }
        return JSON.stringify(o, function (k, v) {
            if( k === rP || k === rI ) 
            {
                if( v[marker] === v ) return v;
                throw new Error("Conflicting serialization prefix: property '"+k+"' exists.");
            }
            if (v === null || typeof v !== "object" || v[marker] === v ) return v;
            let ref = v[rI];
            if (ref) {
                if( ref[marker] === ref ) return {[rP]:ref};
                throw new Error("Conflicting serialization prefix: property '"+rI+"' exists.");
            }
            v[rI] = ref = markNum(c++);
            cleanup.push( v );
            if( v instanceof Array ) {
                v = [ref, ...v];
            }
            else if( substitor ) { 
                let sv = substitor( v );
                if( sv && sv !== v ) { 
                    sv[rI] = ref;
                    sv[rP] = markNum(-1);
                }
                v = sv;
            }
            return v;
        });
    }
    finally
    {
        cleanup.forEach( o => delete o[rI] );
    }
}

// Deserializes a previously serialized object graph.
// Parameter prefix is optional and defaults to "~$£€": it must, of course,
// be the same as the prefix used to serialize the graph.
function deserialize(s, options) {
    const {prefix,activator} = Object.assign({prefix:"~$£€"},options);
    const rP = prefix + "r";
    const rI = prefix + "i";
    let extRef = null;
    let map = [];
    let o = JSON.parse(s, function (k, v) {
        if( v instanceof Array ) {
            map[v.splice(0,1)] = v;
        }
        else 
        {
            const idx = v[rI];
            if (idx !== undefined) {
                delete v[rI];
                if( v[rP] === -1 ) {
                    delete v[rP];
                    if( activator ) { 
                        v = activator( v );
                        if( v ){
                            if( extRef === null ) extRef = new Set();
                            extRef.add( v );
                        }
                    }
                }
                map[idx] = v;
            }
        }
        return v;
    });
    for(let i of map) {
        if( extRef === null || !extRef.has(i) ) 
        {
            if( i instanceof Array ) {
                for( let idx = 0; idx < i.length; ++idx ) {
                    let c = i[idx];
                    if(c) {
                        const ref = c[rP];
                        if (ref !== undefined) i[idx] = map[ref];
                    }
            }   
            }
            else {
                for (const p in i) {
                    const ref = i[p][rP];
                    if (ref !== undefined) i[p] = map[ref];
                }
            }
        }
    }
    return o;
}

function testWithIdempotence( o, options, test ) {
    const s = serialize( o, options );
    console.log("  Serialized:", s );
    const d = deserialize( s, options );
    console.log( "  Deserialized:", d );
    if( test ) test( d );
    const s2 = serialize( d, options );
    if( s !== s2 ) { 
        console.error( "Idempotence failed:", s2 );
        return false;
    }
    return true;
}

// Test self reference.
(function() {
    console.log( ">> Self reference test" );
    let a = { v: 1 };
    a.rA = a;

    testWithIdempotence( a, null, d => {
        if( d.rA !== d ) console.error( "d.rA !== d" );
        if( d.v !== 1 ) console.error( "d.v !== 1" );
    });

    console.log( " << Self reference test" );
})();

// Test array reference.
(function() {
    console.log( ">> Array reference test" );
    let a = { arr:["Test"] };
    a.arr.push( a );

   testWithIdempotence( a, { prefix: "-" } , d => {
        if( d.arr.length !== 2 ) console.error( "d.arr.length !== 1" );
        if( d.arr[0] !== "Test" ) console.error( "d.arr[0] !== d" );
        if( d.arr[1] !== d ) console.error( "d.arr[0] !== d" );
    });

    console.log( "<< Array reference test" );
})();

// Test array multiple reference.
(function() {
    console.log( ">> Array multiple reference test" );
    let a = [ [], [] ];
    a[0].push( a, a[0], a[1] );
    a[1].push( a, a[0], a[1] );

   testWithIdempotence( a, null, d => {
        if( d.length !== 2 ) console.error( "d.length !== 2" );
        if( d[0][0] !== d ) console.error( "d[0][0] !== d" );
        if( d[1][0] !== d ) console.error( "d[1][0] !== d" );
        if( d[1][1] !== d[0] ) console.error( "d[1][1] !== d[0]" );
        if( d[1][2] !== d[1] ) console.error( "d[1][2] !== d[1]" );
    });

    console.log( "<< Array multiple reference test" );
})();

// Test serialization idempotence.
// Graph is serialized and deserialized.
(function() {
    console.log( ">> Simple idempotence test with empty prefix" );
    // a is graph with awful cycles in it.
    let a = { v: 1 }
    let b = { v: 2, rA: a };
    let c = { v: 3, rB: b, arr:[a,b] };
    a.rB = b; a.rC = c;

    testWithIdempotence( a, { prefix: "" } );
 
    console.log( " << Simple idempotence test" );
})();

// External object handling.
(function() {
    console.log( ">> External object handling" );
    const ext = this;
    let a = [ ext ];

    const options = {
        substitor: r =>  {
            if( r === ext ) return { EXT:1 };
            return r;
        },
        activator: v => {
            if( v.EXT === 1 ) return ext;
            console.error( "Activator is called only on substituted values." );
        } 
    };
    testWithIdempotence( a, options, d => {
        if( d[0] !== ext ) console.error("d[0] !== ext");
    });

    console.log( "<< External object handling" );
})();

// Adding an external object to the graph.
// It is substituted once and only once.
(function() {
    console.log( ">> External objects test" );
    // a is graph with awful cycles in it.
    // and with references to srv1 and srv2.
    let srv1 = { host:this, addr:"an ip address" };
    let srv2 = { host:this, addr:"another ip address", master: srv1 };
    let a = { v: 1, server: srv1 }
    let b = { v: 2, rA: a, srv: [srv1, srv2] };
    let c = { v: 3, rB: b };
    let d = { v: 4, rC: c, all:[a,b,c], host:srv2 };
    a.rB = b; 
    a.rC = c;
    a.rD = d;

    const options = {
        prefix: "",
        substitor: r =>  {
            if( r === srv1 ) return { SERVER:1 };
            if( r === srv2 ) return { SERVER:2 };
            return r;
        },
        activator: v => {
            if( v.SERVER === 1 ) return srv1;
            if( v.SERVER === 2 ) return srv2;
            console.error( "Activator is called only on substituted values." );
        } 
    };
    testWithIdempotence( a, options, d => {

    })

    console.log( "<< External objects test" );
})();
 

// Conflicting prefix tests. 
var conflictDemo0 = { C0: 1, "~$£€i": "idx" };
var conflictDemo1 = { C1: 1, Y:[ { "~$£€i": 9 } ] };
var conflictDemo2 = { C2: 2, Y:[ { "~$£€r": 9 } ] };
var conflictDemo3 = { i: 2, Y:[ { "~$£€r": 9 } ] };

function checkConflict( o, options )
{
    try {
        serialize( o, options );
        console.error( "Conflict not detected:", o );
    } catch (error) {
        console.log( "Conflict detected:", error );
    }
}
checkConflict( conflictDemo0 );
checkConflict( conflictDemo1 );
checkConflict( conflictDemo2 );
checkConflict( conflictDemo3, {prefix:""} );
