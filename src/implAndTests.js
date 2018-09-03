
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
    const rR = prefix + ">";
    const rI = prefix + "°";
    const rT = prefix + "þ";
    const marker = Symbol();
    let cleanup = [];
    try
    {
        let c = 0;
        function markObj(o) { o[marker]=1; return o; }
        function markNum(n) { return markObj( new Number(n) ); }
        function markTyp(s) { 
            if( typeof s !== "string" ) throw new Error("Type must be a String.");
            return markObj( new String(s) );
        }
        return JSON.stringify(o, function (k, v) {
            if( k === rR || k === rI || k === rT ) 
            {
                if( v !== null && v[marker] ) return v;
                throw new Error("Conflicting serialization prefix: property '"+k+"' exists.");
            }
            if( v === null || typeof v !== "object" || v[marker] ) return v;
            let ref = v[rI];
            if (ref) {
                if( ref[marker] ) return {[rR]:ref};
                throw new Error("Conflicting serialization prefix: property '"+rI+"' exists.");
            }
            v[rI] = ref = markNum(c++);
            cleanup.push( v );
            if( v instanceof Array ) {
                v = markObj([markObj({[rT]:markObj([ref,"A"])}), ...v]);
            }
            else if( v instanceof Map ) {
                v = markObj([markObj({[rT]:markObj([ref,"M"])}), ...[...v].map( e => markObj(e) )]);
            }
            else if( v instanceof Set ) {
                v = markObj([markObj({[rT]:markObj([ref,"S"])}), ...v]);
            }
            else if( substitor ) { 
                let sv = substitor( v, rT );
                if( sv && sv !== v ) { 
                    v = sv;
                    v[rI] = ref;
                    v[rT] = markTyp( v[rT] || "" );
                }
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
    const rR = prefix + ">";
    const rI = prefix + "°";
    const rT = prefix + "þ";
    let extRef = null;
    let map = [];
    let o = JSON.parse(s, function (k, v) {
        let type = null;
        if( v instanceof Array 
                && v.length > 0 
                && (type = v[0][rT]) !== undefined ) {
            v.splice(0,1);
            switch( type[1] ) {
                case "A": break;
                case "M": v = Object.assign(new Map(),{"v":v}); break;
                case "S": v = Object.assign(new Set(),{"v":v}); break;
                default: throw new Error( "Expecting typed array to be 'A', 'M' or 'S'." );
            }   
            map[type[0]] = v;
        }
        else 
        {
            const idx = v[rI];
            if ( idx !== undefined) {
                delete v[rI];
                if( (type = v[rT]) !== undefined )
                {
                    delete v[rT];
                    if( activator ) { 
                        v = activator( v, type );
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
    function processA( map, a ) {
        const len = a.length;
        for( let i = 0; i < len; ++i ) {
            const c = a[i];
            if(c) {
                const ref = c[rR];
                if (ref !== undefined) a[i] = map[ref];
            }
        }
    }
    for(let i of map) {
        if( extRef === null || !extRef.has(i) ) 
        {
            if( i instanceof Array ) {
                processA( map, i );
            }
            else if( i instanceof Map ) {
                i.v.forEach( e => processA( map, e ) );
                i.v.forEach( e => i.set(e[0],e[1]));
                delete i.v;
            }
            else if( i instanceof Set ) {
                processA( map, i.v );
                i.v.forEach( e => i.add(e));
                delete i.v;
            }
            else {
                for (const p in i) {
                    const ref = i[p][rR];
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

// Test array reference with '-' prefix.
(function() {
    console.log( ">> Array reference test with '-' prefix" );
    let a = { arr:["Test"] };
    a.arr.push( a );

   testWithIdempotence( a, { prefix: "-" } , d => {
        if( d.arr.length !== 2 ) console.error( "d.arr.length !== 1" );
        if( d.arr[0] !== "Test" ) console.error( "d.arr[0] !== d" );
        if( d.arr[1] !== d ) console.error( "d.arr[0] !== d" );
    });

    console.log( "<< Array reference test" );
})();


// Test array reference
(function() {
    console.log( ">> Array reference test" );
    let a = { arr:["Test"] };
    a.arr.push( a );

   testWithIdempotence( a , d => {
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
var conflictDemo0i = { "~$£€>": "idx" };
var conflictDemo0r = { "~$£€>": null };
var conflictDemo0t = { "~$£€þ": {} };
var conflictDemo0Ai = [{"~$£€>": "idx"}];
var conflictDemo0Ar = [{ "~$£€>": null }];
var conflictDemo0At = [{ "~$£€þ": {} }];
var conflictDemo1 = { i: 1, Y:[ { "~$£€°": 9 } ] };
var conflictDemo2 = { i: 2, Y:[ { ">": 9 } ] };
var conflictDemo3 = { i: 3, Y:[ { "~þ": 9 } ] };


function checkConflict( o, options )
{
    try {
        serialize( o, options );
        console.error( "Conflict not detected:", o );
    } catch (error) {
        console.log( "Conflict detected:", error );
    }
}
checkConflict( conflictDemo0i );
checkConflict( conflictDemo0r );
checkConflict( conflictDemo0t );
checkConflict( conflictDemo0Ai );
checkConflict( conflictDemo0Ar );
checkConflict( conflictDemo0At );
checkConflict( conflictDemo1 );
checkConflict( conflictDemo2, {prefix:""} );
checkConflict( conflictDemo3, {prefix:"~"} );

// Map object support.
(function() {
    console.log( ">> Map object support" );
    let a = new Map();
    a.set( 'key', 'value' )
     .set( 'otherKey', 987 )
     .set( a, 'the map itself.')
     .set( 'theMap', a );

    testWithIdempotence( a, null, d => {

    })

    console.log( "<< Map object support" );
})();


// Set object support.
(function() {
    console.log( ">> Set object support" );
    let a = new Set();
    a.add( 1 )
     .add( a )
     .add( 2 );

    testWithIdempotence( a, {prefix:""}, d => {
        if( !d.has( 1 ) ) console.error( "!d.has( 1 )" ); 
        if( !d.has( d ) ) console.error( "!d.has( d )" ); 
        if( !d.has( 2 ) ) console.error( "!d.has( 2 )" ); 
    })

    console.log( "<< Set object support" );
})();



