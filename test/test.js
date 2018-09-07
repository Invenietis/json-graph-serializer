import 'chai/register-should';
import { assert } from 'chai';
import { serialize, deserialize } from '../src';
import { testWithIdempotence } from './util';

describe('serialize() and deserialize()', function () {
    it('should work with embedded graphs', function () {

        const a = { v: 1, an: [] };
        a.an.push(a);
        const s = '{"N":2,"G":' + serialize(a) + '}';
        const d = deserialize(s);

        d.N.should.equal(2, 'd.N should be null');
        d.G.v.should.equal(1, 'd.G.v should be null');
        d.G.an[0].should.equal(d.G, 'd.G.an[0] should be d.G');

    });

    it('should work with null references', function () {

        const a = { v: 1, n: null, an: [null, 2, null] };

        testWithIdempotence(a, null, d => {
            should.equal(d.n, null, 'd.n should be null');
            should.equal(d.an[0], null, 'd.an[0] should be null');
            should.equal(d.an[1], 2, 'd.an[1] should be 2');
            should.equal(d.an[2], null, 'd.an[2] should be null');
            should.equal(d.v, 1, 'd.v should be 1');
        });

    });

    it('should work with root array', function () {

        const a = [{ "v": 1 }, "A"];
        a.push(a[0]);

        testWithIdempotence(a, d => {
        });

    });

    it('should work with self reference', function () {

        const a = { v: 1 };
        a.rA = a;

        testWithIdempotence(a, null, d => {
            should.equal(d.rA, d, 'd.rA should be d');
            should.equal(d.v, 1, 'd.v should be 1');
        });

    });

    it('should work with array reference', function () {

        const a = { arr: ["Test"] };
        a.arr.push(a);

        testWithIdempotence(a, d => {
            should.equal(d.arr.length, 2, 'd.arr.length should be 2');
            should.equal(d.arr[0], 'Test', 'd.arr[0] should be Test');
            should.equal(d.arr[1], d, 'd.arr[1] should be d');
        });

    });

    it('should work with array reference and \'-\' prefix', function () {

        const a = { arr: ["Test"] };
        a.arr.push(a);

        testWithIdempotence(a, { prefix: "-" }, d => {
            should.equal(d.arr.length, 2, 'd.arr.length should be 2');
            should.equal(d.arr[0], 'Test', 'd.arr[0] should be Test');
            should.equal(d.arr[1], d, 'd.arr[1] should be d');
        });

    });

    it('should work with multiple array references', function () {
        const a = [[], []];
        a[0].push(a, a[0], a[1]);
        a[1].push(a, a[0], a[1]);

        testWithIdempotence(a, null, d => {
            should.equal(d.length, 2);
            should.equal(d[0][0], d);
            should.equal(d[1][0], d);
            should.equal(d[1][1], d[0]);
            should.equal(d[1][2], d[1]);
        });
    });

    it('should work with empty prefix', function () {
        // a is graph with awful cycles in it.
        const a = { v: 1 }
        const b = { v: 2, rA: a };
        const c = { v: 3, rB: b, arr: [a, b] };
        a.rB = b;
        a.rC = c;

        testWithIdempotence(a, { prefix: "" });
    });

    it('should work with external objects (1)', function () {
        const ext = this;
        const a = [ext];

        const options = {
            substitor: r => {
                if (r === ext) return { EXT: 1 };
                return r;
            },
            activator: v => {
                if (v.EXT === 1) return ext;
                assert.fail("Activator is called only on substituted values.");
            }
        };

        testWithIdempotence(a, options, d => {
            should.equal(d[0], ext);
        });
    });

    it('should work with external objects (2)', function () {
        // a is graph with awful cycles in it.
        // and with references to srv1 and srv2.
        const srv1 = { host: this, addr: "an ip address" };
        const srv2 = { host: this, addr: "another ip address", master: srv1 };
        const a = { v: 1, server: srv1 }
        const b = { v: 2, rA: a, srv: [srv1, srv2] };
        const c = { v: 3, rB: b };
        const d = { v: 4, rC: c, all: [a, b, c], host: srv2 };
        a.rB = b;
        a.rC = c;
        a.rD = d;

        const options = {
            prefix: "",
            substitor: r => {
                if (r === srv1) return { SERVER: 1 };
                if (r === srv2) return { SERVER: 2 };
                return r;
            },
            activator: v => {
                if (v.SERVER === 1) return srv1;
                if (v.SERVER === 2) return srv2;
                assert.fail("Activator is called only on substituted values.");
            }
        };
        testWithIdempotence(a, options, d => {

        })
    });

    it('should handle conflicting prefixes', function () {
        // Conflicting prefix tests. 
        const conflictDemo0i = { "~$£€>": "idx" };
        const conflictDemo0r = { "~$£€>": null };
        const conflictDemo0t = { "~$£€þ": {} };
        const conflictDemo0Ai = [{ "~$£€>": "idx" }];
        const conflictDemo0Ar = [{ "~$£€>": null }];
        const conflictDemo0At = [{ "~$£€þ": {} }];
        const conflictDemo1 = { i: 1, Y: [{ "~$£€°": 9 }] };
        const conflictDemo2 = { i: 2, Y: [{ ">": 9 }] };
        const conflictDemo3 = { i: 3, Y: [{ "~þ": 9 }] };

        const checkConflict = function (o, options) {
            try {
                serialize(o, options);
                assert.fail('', '', "Conflict not detected:" + o);
            } catch (error) {
                // console.log("Conflict detected:", error);
            }
        }

        checkConflict(conflictDemo0i);
        checkConflict(conflictDemo0r);
        checkConflict(conflictDemo0t);
        checkConflict(conflictDemo0Ai);
        checkConflict(conflictDemo0Ar);
        checkConflict(conflictDemo0At);
        checkConflict(conflictDemo1);
        checkConflict(conflictDemo2, { prefix: "" });
        checkConflict(conflictDemo3, { prefix: "~" });
    });

    it('should work with Map objects', function () {

        const a = new Map();
        a.set('key', 'value')
            .set('otherKey', 987)
            .set(a, 'the map itself.')
            .set('theMap', a)
            .set('nullValue', null)
            .set(null, 'nullKey');

        testWithIdempotence(a, null, d => {
            d.get('key').should.equal('value');
            d.get(null).should.equal('nullKey');
            should.equal(d.get('nullValue'), null);
        })
    });

    it('should work with Set objects', function () {
        const a = new Set();
        a.add(1)
            .add(a)
            .add(2);

        testWithIdempotence(a, { prefix: "" }, d => {
            d.has(1).should.equal(true);
            d.has(d).should.equal(true);
            d.has(2).should.equal(true);
        });
    });
});