import { Vector } from "../src/Vector";
import * as assert from 'assert'

describe("Vector creation", () => {
    it("creates from a JS array", () => assert.deepEqual(
        ["a","b", "c"],
        Vector.ofArray<string>(["a","b","c"]).toArray()));
    it("creates from a spread", () => assert.deepEqual(
        ["a","b", "c"],
        Vector.of("a","b","c").toArray()));
});

describe("Vector manipulation", () => {
    it("appends correctly", () => assert.ok(
        Vector.ofArray<number>([1,2,3,4]).equals(Vector.of(1,2,3).append(4))));
});

describe("Vector Value tests", () => {
    it("serializes to string correctly", () => assert.equal(
        "[1, 2, 3]", Vector.of(1,2,3).toString()));
    it("has non-obviously-broken equals", () => assert.ok(
        Vector.of("a","b","c").equals(Vector.of("a", "b", "c"))));
})