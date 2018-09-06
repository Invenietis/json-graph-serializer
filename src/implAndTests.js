
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
function deserialize(s /*:string|object*/, options) {
    const {prefix,activator} = Object.assign({prefix:"~$£€"},options);
    const rR = prefix + ">";
    const rI = prefix + "°";
    const rT = prefix + "þ";
    let extRef = null;
    let map = [];

    function rev( k, v ) {
        let type = null;
        if( v instanceof Array )
        {
            if( v.length > 0
                && v[0] != null 
                && (type = v[0][rT]) !== undefined ) 
            {
                v.splice(0,1);
                switch( type[1] ) {
                    case "A": break;
                    case "M": v = Object.assign(new Map(),{"v":v}); break;
                    case "S": v = Object.assign(new Set(),{"v":v}); break;
                    default: throw new Error( "Expecting typed array to be 'A', 'M' or 'S'." );
                }   
                map[type[0]] = v;
            }
        }
        else if( v !== null )
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
    }

    // This simple depth-first traversal applies the reviver to an already 
    // JSON parsed tree.
    function d( o )
    {
        if( o ) {
            if( o instanceof Array ) {
                for( let i = 0; i < o.length; ++i ) {
                    const v = o[i];
                    d( v );
                    rev( i, v );
                }
            }
            else if( typeof(o) === "object" ) {
                for( const p in o ) {
                    const v = o[p];
                    d( v );
                    rev( p, v );
                }
            }
        }
        return o;
    }
    // If its a string, JSON.parse and the reviver handle the first step: registering the 
    // objects in map array and any external references into extRef set.   
    let o = typeof(s) === "string" 
            ? JSON.parse(s, rev )
            : rev( undefined, d( s ) );

    // Second step is to handles the collections (array, map and set).
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
                    const o = i[p];
                    if( o !== null ) {
                        const ref = o[rR];
                        if (ref !== undefined) i[p] = map[ref];
                    }
                }
            }
        }
    }
    return o;
}

function testWithIdempotence( o, options, test ) {
    const s = serialize( o, options );
    console.log("  Serialized:", s );
    // s is the serialized string.
    // We test here the deserialze( s: object ):
    const onlyJSON = JSON.parse( s );
    const dFromJSON = deserialize( onlyJSON, options );
    if( test ) test( dFromJSON );
    const sBackFromJSON = serialize( dFromJSON, options );
    if( s !== sBackFromJSON ) { 
        console.error( "Idempotence failed for JSON object:", sBackFromJSON );
        return false;
    }
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

// Test embedded graph.
(function() {
    console.log( ">> Test embedded graph" );
    let a = { v: 1, an:[] };
    a.an.push( a );
    const s = '{"N":2,"G":' + serialize(a) + '}';
    const d = deserialize( s );

    if( d.N !== 2 ) console.error( "d.N !== 2" );
    if( d.G.v !== 1 ) console.error( "d.G.v !== 1" );
    if( d.G.an[0] !== d.G ) console.error( "d.G.an[0] !== d.G" );

    console.log( " << Test embedded graph" );
})();

// Test null reference.
(function() {
    console.log( ">> Null reference test" );
    let a = { v: 1, n: null, an:[null,2,null] };

    testWithIdempotence( a, null, d => {
        if( d.n !== null ) console.error( "d.n !== null" );
        if( d.an[0] !== null ) console.error( "d.an[0] !== null" );
        if( d.an[1] !== 2 ) console.error( "d.an[1] !== 2" );
        if( d.an[2] !== null ) console.error( "d.an[2] !== null" );
        if( d.v !== 1 ) console.error( "d.v !== 1" );
    });

    console.log( " << Self reference test" );
})();


// Root array serialization.
(function() {
    console.log( ">> Root array serialization" );
    let a = [{"v":1},"A"];
    a.push( a[0] );

   testWithIdempotence( a , d => {
    });

    console.log( "<< Array reference test" );
})();

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
     .set( 'theMap', a )
     .set( 'nullValue', null )
     .set( null, 'nullKey' );

    testWithIdempotence( a, null, d => {
        if( d.get('key') !== 'value' ) console.error( "d.get('key') !== 'value'" );
        if( d.get(null) !== 'nullKey' ) console.error( "d.get(null) !== 'nullKey'" );
        if( d.get('nullValue') !== null ) console.error( "d.get('nullValue') !== null" );
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

// Deserialized Graph from ObservableDomain.Export.
const gFromObservable = '[{"þ":[0,"A"]},{"°":1,"CompanyName":"Boite","Employees":{"$i":1,"$C":[{"þ":[2,"A"]},{"°":3,"CurrentCar":{"°":4,"Name":"Renault n°2","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":{">":3}},"Garage":{">":1},"Friend":null,"FirstName":"Scott","LastName":"Guthrie"}]},"Cars":{"$i":2,"$C":[{"þ":[5,"A"]},{"°":6,"Name":"Renault n°0","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":7,"Name":"Renault n°1","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{">":4},{"°":8,"Name":"Renault n°3","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":9,"Name":"Renault n°4","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":10,"Name":"Renault n°5","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":11,"Name":"Renault n°6","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":12,"Name":"Renault n°7","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":13,"Name":"Renault n°8","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":14,"Name":"Renault n°9","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null}]},"ReplacementCar":{"$i":3,"$C":[{"þ":[15,"M"]},[{">":6},{">":7}],[{">":4},{">":8}]]}},{">":2},{">":5},{">":15},{">":6},{">":7},{">":4},{">":8},{">":9},{">":10},{">":11},{">":12},{">":13},{">":14},{"°":16,"Friend":null,"FirstName":"Paul","LastName":"Minc"},{">":3},{"°":17,"CompanyName":null,"Employees":{"$i":17,"$C":[{"þ":[18,"A"]},{"°":19,"Garage":{">":17},"Friend":null,"FirstName":"Julien","LastName":"Mathon"},{"°":20,"CurrentCar":null,"Garage":{">":17},"Friend":null,"FirstName":"Idriss","LastName":"Hippocrate"},{"°":21,"CurrentCar":null,"Garage":{">":17},"Friend":null,"FirstName":"Cedric","LastName":"Legendre"},{"°":22,"CurrentCar":null,"Garage":{">":17},"Friend":null,"FirstName":"Benjamin","LastName":"Crosnier"},{"°":23,"CurrentCar":null,"Garage":{">":17},"Friend":null,"FirstName":"Alexandre","LastName":"Da Silva"},{"°":24,"CurrentCar":null,"Garage":{">":17},"Friend":null,"FirstName":"Olivier","LastName":"Spinelli"}]},"Cars":{"$i":18,"$C":[{"þ":[25,"A"]},{"°":26,"Name":"Volvo n°0","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":27,"Name":"Volvo n°1","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":28,"Name":"Volvo n°2","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":29,"Name":"Volvo n°3","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":30,"Name":"Volvo n°4","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":31,"Name":"Volvo n°5","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":32,"Name":"Volvo n°6","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":33,"Name":"Volvo n°7","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":34,"Name":"Volvo n°8","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":35,"Name":"Volvo n°9","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null}]},"ReplacementCar":{"$i":19,"$C":[{"þ":[36,"M"]}]}},{">":18},{">":25},{">":36},{">":19},{">":20},{">":21},{">":22},{">":23},{">":24},{">":26},{">":27},{">":28},{">":29},{">":30},{">":31},{">":32},{">":33},{">":34},{">":35}]';
const allObjects = deserialize(gFromObservable, { prefix: "" });
console.log( "Deserialized Graph from ObservableDomain.Export (before lifting): ", allObjects );
//liftGraphContainerContent( allObjects );
//console.log( "Deserialized Graph from ObservableDomain.Export (after lifting): ", allObjects );

function ObservableDomain( initialState /*: string|any*/ )
{
    var o = typeof(initialState) === "string"
            ? deserialize(initialState, { prefix: "" })
            : initialState;
    this.tranNum = o.N;
    var props = o.P;
    this.graph = liftGraphContainerContent( o.O );

    function liftGraphContainerContent( g )
    {
        const len = g.length;
        for( let i = 0; i < len; ++i ) {
            const o = g[i];
            if(o && typeof(o) === "object"  ) {           
                for( let p in o )
                {
                    const v = o[p];
                    if( v && typeof(v) === "object" )
                    {
                        const c = v["$C"];
                        if (c !== undefined) 
                        {
                            o[p] = g[v["$i"]];
                        }
                    }
                }
            }
        }
        return g;
    }

    this.applyEvent = function( event )
    {
        const getValue = o => {
            if( o != null )
            {
                var ref = o[">"];
                if( ref !== undefined ) return this.graph[ref];
            }
            return o;
        }

        if( this.tranNum+1 > event.N  ) throw new Error( `Invalid transaction number. Expected: greater than ${this.tranNum+1}, got ${event.N}.` );
        const events = event.E;
        for( let i = 0; i < events.length; ++i )
        {
            const e = events[i];
            const code = e[0];
            switch( code )
            {
                case "N":  // NewObject
                {
                    let newOne;
                    switch( e[2] )
                    {
                        case "": newOne = {}; break;
                        case "A": newOne = []; break;
                        case "M": newOne = new Map(); break; 
                        case "S": newOne = new Set(); break;
                        default: throw new Error( `Unexpected Object type; ${e[2]}. Must be A, M, S or empty string.` );
                    }
                    this.graph[e[1]] = newOne;
                    break;
                }
                case "D":  // DisposedObject
                {
                    this.graph[e[1]] = null;
                    break;
                }
                case "P":  // NewProperty
                {
                    if( e[2] != props.length ) throw new Error(`Invalid property creation event for '${e[1]}': index must be ${props.length}, got ${e[2]}.`);
                    props.push(e[1]);
                    break;
                }
                case "C":  // PropertyChanged
                {
                    this.graph[e[1]][props[e[2]]] = getValue(e[3]);
                    break;
                }
                case "I":  // ListInsert
                {
                    const a = this.graph[e[1]];
                    const idx = e[2];
                    const v = getValue(e[3]); 
                    if( idx === a.length ) a[idx] = v;  
                    else a.splice(idx,0,v);
                    break;
                }
                case "CL": // CollectionClear
                {
                    const c = this.graph[e[1]];
                    if( c instanceof Array ) c.length = 0;
                    else c.clear();
                    break;
                }
                case "R":  // ListRemoveAt
                {
                    this.graph[e[1]].splice(e[2],1);
                    break;
                }
                case "K":   // CollectionRemoveKey
                {
                    this.graph[e[1]].delete(getValue(e[2]));
                    break;
                }
                default: throw new Error( `Unexpected Event code: '${e[0]}'.` );
            } 
        }
        this.tranNum = event.N;
    }

}

(function testSimple()
{
    const initial = '{"N":0,"P":[],"O":[{"þ":[0,"A"]}]}';
    const t2 = '{"N":2,"E":[["N",0,""],["P","Name",0],["C",0,0,"Hello!"],["P","Speed",1],["C",0,1,0],["P","Position",2],["C",0,2,{"Lat":0,"Long":0}],["P","CurrentMechanic",3],["C",0,3,null]]}';
    const t3 = '{"N":3,"E":[["D",0]]}';
    const t4 = '{"N":4,"E":[["N",0,""],["P","String",4],["P","Int32",5],["P","UInt32",6],["P","Int64",7],["P","UInt64",8],["P","Int16",9],["P","UInt16",10],["P","Byte",11],["P","SByte",12],["P","DateTime",13],["P","TimeSpan",14],["P","DateTimeOffset",15],["P","Guid",16],["P","Double",17],["P","Single",18],["P","Char",19],["P","Boolean",20],["C",0,4,"MultiPropertyType"],["C",0,5,-42],["C",0,6,42],["C",0,7,-2752512],["C",0,8,2752512],["C",0,9,-3712],["C",0,10,3712],["C",0,11,255],["C",0,12,-128],["C",0,13,"05/09/2018 16:06:47"],["C",0,14,"3.02:01:59.9950000"],["C",0,15,"05/09/2018 16:06:47 +02:00"],["C",0,16,"4f5e996d-51e9-4b04-b572-5126b14a5eca"],["C",0,17,3.59783E-77],["C",0,18,3.89740016544238E-05],["C",0,19,"c"],["C",0,20,true],["C",0,2,{"Lat":11.11,"Long":22.22}],["C",0,4,"MultiPropertyType"],["C",0,5,-42],["C",0,6,42],["C",0,7,-2752512],["C",0,8,2752512],["C",0,9,-3712],["C",0,10,3712],["C",0,11,255],["C",0,12,-128],["C",0,13,"05/09/2018 16:06:47"],["C",0,14,"3.02:01:59.9950000"],["C",0,15,"05/09/2018 16:06:47 +02:00"],["C",0,16,"4f5e996d-51e9-4b04-b572-5126b14a5eca"],["C",0,17,3.59783E-77],["C",0,18,3.89740016544238E-05],["C",0,19,"c"],["C",0,20,true],["C",0,2,{"Lat":11.11,"Long":22.22}],["P","Enum",21],["C",0,21,0]]}';
    const t5 = '{"N":5,"E":[["C",0,4,"Pouf"],["C",0,5,-39],["C",0,6,45],["C",0,7,-2752509],["C",0,8,2752515],["C",0,9,-3709],["C",0,10,3715],["C",0,11,2],["C",0,12,3],["C",0,13,"08/09/2018 16:06:47"],["C",0,14,"3.05:01:59.9950000"],["C",0,15,"05/09/2018 16:09:47 +02:00"],["C",0,16,"b681ad83-a276-4a5c-a11a-4a22469b6a0d"],["C",0,17,3],["C",0,18,3.00003886222839],["C",0,19,"f"],["C",0,20,false],["C",0,21,3],["C",0,2,{"Lat":14.11,"Long":25.22}]]}';
    const t6 = '{"N":6,"E":[["C",0,4,"MultiPropertyType"],["C",0,5,-42],["C",0,6,42],["C",0,7,-2752512],["C",0,8,2752512],["C",0,9,-3712],["C",0,10,3712],["C",0,11,255],["C",0,12,-128],["C",0,13,"05/09/2018 16:06:47"],["C",0,14,"3.02:01:59.9950000"],["C",0,15,"05/09/2018 16:06:47 +02:00"],["C",0,16,"4f5e996d-51e9-4b04-b572-5126b14a5eca"],["C",0,17,3.59783E-77],["C",0,18,3.89740016544238E-05],["C",0,19,"c"],["C",0,20,true],["C",0,2,{"Lat":11.11,"Long":22.22}]]}';   
    var o = new ObservableDomain( initial );
    console.log( "intial Simple graph:", o.graph );
    o.applyEvent( JSON.parse( t2 ) );
    console.log( "Simple graph after t2:", o.graph );
    o.applyEvent( JSON.parse( t3 ) );
    console.log( "Simple graph after t3:", o.graph );
    o.applyEvent( JSON.parse( t4 ) );
    console.log( "Simple graph after t4:", o.graph );   
    o.applyEvent( JSON.parse( t5 ) );
    console.log( "Simple graph after t5:", o.graph );   
    o.applyEvent( JSON.parse( t6 ) );
    console.log( "Simple graph after t5:", o.graph );   
})();

(function testOnSample()
{
    const initial = '{"N":1,"P":["Employees","Cars","CompanyName","FirstName","LastName","Garage","CurrentMechanic","CurrentCar","ReplacementCar","Name","Speed","Position","Friend","Level"],"O":[{"þ":[0,"A"]},{"°":1,"CompanyName":"Boite","Employees":{"$i":1,"$C":[{"þ":[2,"A"]},{"°":3,"CurrentCar":{"°":4,"Name":"Renault n°2","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":{">":3}},"Level":0,"Garage":{">":1},"Friend":null,"FirstName":"Scott","LastName":"Guthrie"}]},"Cars":{"$i":2,"$C":[{"þ":[5,"A"]},{"°":6,"Name":"Renault n°0","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":7,"Name":"Renault n°1","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{">":4},{"°":8,"Name":"Renault n°3","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":9,"Name":"Renault n°4","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":10,"Name":"Renault n°5","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":11,"Name":"Renault n°6","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":12,"Name":"Renault n°7","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":13,"Name":"Renault n°8","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":14,"Name":"Renault n°9","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null}]},"ReplacementCar":{"$i":3,"$C":[{"þ":[15,"M"]},[{">":6},{">":7}],[{">":4},{">":8}]]}},{">":2},{">":5},{">":15},{">":6},{">":7},{">":4},{">":8},{">":9},{">":10},{">":11},{">":12},{">":13},{">":14},{"°":16,"Friend":null,"FirstName":"Paul","LastName":"Minc"},{">":3},{"°":17,"CompanyName":null,"Employees":{"$i":17,"$C":[{"þ":[18,"A"]},{"°":19,"Garage":{">":17},"Friend":null,"FirstName":"Julien","LastName":"Mathon"},{"°":20,"CurrentCar":null,"Level":0,"Garage":{">":17},"Friend":null,"FirstName":"Idriss","LastName":"Hippocrate"},{"°":21,"CurrentCar":null,"Level":0,"Garage":{">":17},"Friend":null,"FirstName":"Cedric","LastName":"Legendre"},{"°":22,"CurrentCar":null,"Level":0,"Garage":{">":17},"Friend":null,"FirstName":"Benjamin","LastName":"Crosnier"},{"°":23,"CurrentCar":null,"Level":0,"Garage":{">":17},"Friend":null,"FirstName":"Alexandre","LastName":"Da Silva"},{"°":24,"CurrentCar":null,"Level":0,"Garage":{">":17},"Friend":null,"FirstName":"Olivier","LastName":"Spinelli"}]},"Cars":{"$i":18,"$C":[{"þ":[25,"A"]},{"°":26,"Name":"Volvo n°0","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":27,"Name":"Volvo n°1","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":28,"Name":"Volvo n°2","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":29,"Name":"Volvo n°3","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":30,"Name":"Volvo n°4","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":31,"Name":"Volvo n°5","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":32,"Name":"Volvo n°6","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":33,"Name":"Volvo n°7","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":34,"Name":"Volvo n°8","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null},{"°":35,"Name":"Volvo n°9","Speed":0,"Position":{"Lat":0,"Long":0},"CurrentMechanic":null}]},"ReplacementCar":{"$i":19,"$C":[{"þ":[36,"M"]}]}},{">":18},{">":25},{">":36},{">":19},{">":20},{">":21},{">":22},{">":23},{">":24},{">":26},{">":27},{">":28},{">":29},{">":30},{">":31},{">":32},{">":33},{">":34},{">":35}]}';
    const t1 = '{"N":2,"E":[["C",16,2,"Signature Code"]]}';
    const t2 = '{"N":3,"E":[["CL",18],["N",36,""],["I",17,6,{">":36}],["C",36,5,{">":16}],["C",36,3,"X"],["C",36,4,"Y"],["C",36,7,null],["C",36,13,0],["C",36,12,null]]}';
    const t3 = '{"N":4,"E":[["R",17,5],["D",25]]}';
    const t4 = '{"N":5,"E":[["R",17,5],["D",25],["K",3,{">":4}]]}';
    var o = new ObservableDomain( initial );
    console.log( "intial Sample graph:", o.graph );
    o.applyEvent( JSON.parse( t1 ) );
    o.applyEvent( JSON.parse( t2 ) );
    console.log( "Sample graph after t1 and t2:", o.graph );
    o.applyEvent( JSON.parse( t3 ) );
    console.log( "Sample graph after t3:", o.graph );
    o.applyEvent( JSON.parse( t4 ) );
    console.log( "Sample graph after t4:", o.graph );

})();




