import { Seq } from "./Seq";
import { WithEquality, Ordering, 
         getHashCode, areEqual, toStringHelper } from "./Comparison";
import { HashMap} from "./HashMap";
import { IMap } from "./IMap";
import { Option } from "./Option";
import { HashSet } from "./HashSet";
import * as SeqHelpers from "./SeqHelpers";
const hamt: any = require("hamt_plus");
export class Vector<T> implements Seq<T>, Iterable<T> {
    protected constructor(private hamt: any, private indexShift: number) {}
    private static readonly emptyVector = new Vector(hamt.make(), 0);
    static empty<T>(): Vector<T> {
        return <Vector<T>>Vector.emptyVector;
    }
    static ofIterableStruct<T>(elts: Iterable<T>): Vector<T> {
        return (<Vector<T>>Vector.emptyVector).appendAllStruct(elts);
    }
    static ofIterable<T>(elts: Iterable<T & WithEquality>): Vector<T> {
        return Vector.ofIterableStruct(elts);
    }
    static ofStruct<T>(...arr: Array<T>): Vector<T> {
        return Vector.ofIterableStruct(arr);
    }
    static of<T>(...arr: Array<T & WithEquality>): Vector<T> {
        return Vector.ofIterable(arr);
    }
    static unfoldRight<T,U>(seed: T, fn: (x:T)=>Option<[U,T]>): Vector<U> {
        return new Vector<U>(hamt.empty.mutate(
            (h:any) => {
                let idx = 0;
                let nextVal = fn(seed);
                while (nextVal.isSome()) {
                    h.set(idx++, nextVal.getOrThrow()[0]);
                    nextVal = fn(nextVal.getOrThrow()[1]);
                }
            }), 0);
    }
    [Symbol.iterator](): Iterator<T> {
        let curIdx = 0;
        const hamt = this.hamt;
        return {
            next(): IteratorResult<T> {
                if (curIdx < hamt.size) {
                    return {
                        done: false,
                        value: hamt.get(curIdx++)
                    };
                }
                return { done: true, value: <any>undefined };
            }
        };
    }
    toArray(): Array<T> {
        let r = [];
        for (let i=0;i<this.hamt.size;i++) {
            r.push(this.hamt.get(i+this.indexShift));
        }
        return r;
    }
    length(): number {
        return this.hamt.size;
    }
    single(): Option<T> {
        return this.hamt.size === 1
            ? Option.of(this.hamt.get(this.indexShift))
            : Option.none();
    }
    isEmpty(): boolean {
        return this.hamt.size === 0;
    }
    head(): Option<T> {
        return Option.ofStruct(this.hamt.get(this.indexShift));
    }
    last(): Option<T> {
        return Option.ofStruct(this.hamt.get(this.hamt.size+this.indexShift-1));
    }
    tail(): Option<Vector<T>> {
        return this.isEmpty() ?
            Option.none<Vector<T>>() :
            Option.of(new Vector<T>(
                this.hamt.remove(this.indexShift), this.indexShift+1));
    }
    appendStruct(elt: T): Vector<T> {
        return new Vector<T>(this.hamt.set(this.hamt.size+this.indexShift, elt), this.indexShift);
    }
    append(elt: T & WithEquality): Vector<T> {
        return this.appendStruct(elt);
    }
    prependStruct(elt: T): Vector<T> {
        const newIndexShift = this.indexShift - 1;
        return new Vector<T>(this.hamt.set(newIndexShift, elt), newIndexShift);
    }
    prepend(elt: T & WithEquality): Vector<T> {
        return this.prependStruct(elt);
    }
    prependAll(elts: Iterable<T & WithEquality>): Vector<T> {
        return this.prependAllStruct(elts);
    }
    prependAllStruct(elts: Iterable<T>): Vector<T> {
        // could optimize if i'm 100% the other one is a Vector...
        // (no need for in-order get, i can take all the keys in any order)
        //
        // need to transform to an array, because
        // I need the size immediately for the indexShift.
        const eltsAr = Array.from(elts);
        const newIndexShift = this.indexShift - eltsAr.length;
        let hamt = this.hamt;
        for (let i=0;i<eltsAr.length;i++) {
            hamt = hamt.set(newIndexShift+i, eltsAr[i]);
        }
        return new Vector<T>(hamt, newIndexShift);
    }
    forEach(fn: (v:T)=>void): Vector<T> {
        for (let i=0;i<this.hamt.size;i++) {
            fn(this.hamt.get(i+this.indexShift));
        }
        return this;
    }
    appendAllStruct(elts: Iterable<T>): Vector<T> {
        return new Vector<T>(this.hamt.mutate(
            (h:any) => {
                const iterator = elts[Symbol.iterator]();
                let curItem = iterator.next();
                while (!curItem.done) {
                    h.set(h.size+this.indexShift, curItem.value);
                    curItem = iterator.next();
                }
            }), this.indexShift);
    }
    appendAll(elts: Iterable<T&WithEquality>): Vector<T> {
        return this.appendAllStruct(elts);
    }
    mapStruct<U>(mapper:(v:T)=>U): Vector<U> {
        return new Vector<U>(this.hamt.fold(
            (acc: any, v:T & WithEquality, k:number) => acc.set(k-this.indexShift, mapper(v)),
            hamt.empty), 0);
    }
    map<U>(mapper:(v:T)=>U&WithEquality): Vector<U> {
        return this.mapStruct(mapper);
    }
    filter(predicate:(v:T)=>boolean): Vector<T> {
        return new Vector<T>(hamt.empty.mutate(
            (h:any) => {
                let outputIdx = 0;
                for (let i=0;i<this.hamt.size;i++) {
                    const item = this.hamt.get(i+this.indexShift);
                    if (predicate(item)) {
                        h.set(outputIdx++, item);
                    }
                }
            }), 0);
    }
    find(predicate:(v:T)=>boolean): Option<T> {
        for (let i=0;i<this.hamt.size;i++) {
            const item: T = this.hamt.get(i+this.indexShift);
            if (predicate(item)) {
                return Option.ofStruct(item);
            }
        }
        return Option.none<T>();
    }
    contains(v:T&WithEquality): boolean {
        return this.anyMatch(curVal => areEqual(curVal, v));
    }
    
    flatMapStruct<U>(mapper:(v:T)=>Vector<U>): Vector<U> {
        var r:Array<U> = [];
        for (let i=0;i<this.hamt.size;i++) {
            r = r.concat(mapper(this.hamt.get(i+this.indexShift)).toArray());
        }
        return Vector.ofIterableStruct<U>(r);
    }
    flatMap<U>(mapper:(v:T)=>Vector<U&WithEquality>): Vector<U> {
        return this.flatMapStruct(mapper);
    }
    fold(zero:T, fn:(v1:T,v2:T)=>T): T {
        return this.foldLeft(zero, fn);
    }
    foldLeft<U>(zero: U, fn:(soFar:U,cur:T)=>U): U {
        let r = zero;
        for (let i=0;i<this.hamt.size;i++) {
            r = fn(r, this.hamt.get(i+this.indexShift));
        }
        return r;
    }
    foldRight<U>(zero: U, fn:(cur:T, soFar:U)=>U): U {
        let r = zero;
        for (let i=this.hamt.size-1;i>=0;i--) {
            r = fn(this.hamt.get(i+this.indexShift), r);
        }
        return r;
    }
    mkString(separator: string): string {
        let r = "";
        for (let i=0;i<this.hamt.size;i++) {
            if (i>0) {
                r += separator;
            }
            r += this.hamt.get(i+this.indexShift).toString();
        }
        return r;
    }
    get(idx: number): Option<T> {
        return Option.of(this.hamt.get(idx+this.indexShift));
    }
    drop(n:number): Vector<T> {
        if (n>=this.hamt.size) {
            return <Vector<T>>Vector.emptyVector;
        }
        return new Vector<T>(this.hamt.fold(
            (h:any,v:T,k:number) => (k-this.indexShift>=n) ?
                h.set(k-this.indexShift-n, v) : h,
            hamt.make()), 0);
    }
    dropWhile(predicate:(x:T)=>boolean): Vector<T> {
        let h = hamt.make();
        let skip = true;
        let newIdx = 0;
        for (let i=0;i<this.hamt.size;i++) {
            const v = this.hamt.get(i+this.indexShift);
            if (skip && !predicate(v)) {
                skip = false;
            }
            if (!skip) {
                h = h.set(newIdx++, v);
            }
        }
        return new Vector<T>(h, 0);
    }
    takeWhile(predicate:(x:T)=>boolean): Vector<T> {
        let h = hamt.make();
        let newIdx = 0;
        for (let i=0;i<this.hamt.size;i++) {
            const v = this.hamt.get(i+this.indexShift);
            if (!predicate(v)) {
                break;
            }
            h = h.set(newIdx++, v);
        }
        return new Vector<T>(h, 0);
    }
    dropRight(n:number): Vector<T> {
        const sz = this.hamt.size;
        if (n>=sz) {
            return <Vector<T>>Vector.emptyVector;
        }
        return new Vector<T>(this.hamt.fold(
            (h:any,v:T,k:number) => (sz-k+this.indexShift>n) ?
                h.set(k-this.indexShift, v) : h,
            hamt.make()), 0);
    }
    allMatch(predicate:(v:T)=>boolean): boolean {
        // faster than using .find() because we
        // don't have to traverse elements in order
        const iterator: Iterator<T> = this.hamt.values();
        let curItem = iterator.next();
        while (!curItem.done) {
            if (!predicate(curItem.value)) {
                return false;
            }
            curItem = iterator.next();
        }
        return true;
    }
    anyMatch(predicate:(v:T)=>boolean): boolean {
        // faster than using .find() because we
        // don't have to traverse elements in order
        const iterator: Iterator<T> = this.hamt.values();
        let curItem = iterator.next();
        while (!curItem.done) {
            if (predicate(curItem.value)) {
                return true;
            }
            curItem = iterator.next();
        }
        return false;
    }
    sortBy(compare: (v1:T,v2:T)=>Ordering): Vector<T> {
        return Vector.ofIterableStruct<T>(this.toArray().sort(compare));
    }
    sortOn(getKey: (v:T)=>number): Vector<T> {
        return this.sortBy((x,y) => getKey(x)-getKey(y));
    }
    groupBy<C>(classifier: (v:T & WithEquality)=>C & WithEquality): HashMap<C,Vector<T>> {
        return this.hamt.fold(
            (acc: HashMap<C,Vector<T>>, v:T & WithEquality, k:number) =>
                acc.putWithMerge(
                    classifier(v), Vector.of(v),
                    (v1:Vector<T&WithEquality>,v2:Vector<T&WithEquality>)=>v1.appendAll(v2)), HashMap.empty());
    }
    arrangeBy<K>(getKey: (v:T)=>K&WithEquality): Option<IMap<K,T>> {
        return SeqHelpers.arrangeBy<T,K>(this, getKey);
    }
    shuffle(): Vector<T> {
        return Vector.ofIterable(SeqHelpers.shuffle(this.toArray()));
    }
    toMap<K,V>(converter:(x:T)=>[K & WithEquality,V & WithEquality]): IMap<K,V> {
        return this.toMapStruct(converter);
    }
    toMapStruct<K,V>(converter:(x:T)=>[K & WithEquality,V]): IMap<K,V> {
        return this.hamt.fold(
            (acc: HashMap<K,V>, value:T, k:number) => {
                const converted = converter(value);
                return acc.putStruct(converted[0], converted[1]);
            }, HashMap.empty());
    }
    zipStruct<U>(other: Iterable<U>): Vector<[T,U]> {
        return new Vector<[T,U]>(hamt.empty.mutate(
            (h:any) => {
                let i = 0;
                const thisIterator = this[Symbol.iterator]();
                const otherIterator = other[Symbol.iterator]();
                let thisCurItem = thisIterator.next();
                let otherCurItem = otherIterator.next();
                while (!thisCurItem.done && !otherCurItem.done) {
                    h.set(i++, [thisCurItem.value, otherCurItem.value]);
                    thisCurItem = thisIterator.next();
                    otherCurItem = otherIterator.next();
                }
            }), 0);
    }
    zip<U>(other: Iterable<U&WithEquality>): Vector<[T,U]> {
        return this.zipStruct(other);
    }
    reverse(): Vector<T> {
        const sz = this.hamt.size;
        return new Vector<T>(this.hamt.fold(
            (h:any,v:T,k:number) => h.set(sz-1-k+this.indexShift, v),
            hamt.make()), 0);
    }
    partition(predicate:(x:T)=>boolean): [Vector<T>,Vector<T>] {
        let i1 = 0, i2 = 0;
        let r: any = [null,null];
        hamt.empty.mutate(
            (hamt1:any) =>
                hamt.empty.mutate((hamt2:any) => {
                    let i1 = 0, i2 = 0;
                    for (let i=0;i<this.hamt.size;i++) {
                        const val = this.hamt.get(i+this.indexShift);
                        if (predicate(val)) {
                            hamt1.set(i1++, val);
                        } else {
                            hamt2.set(i2++, val);
                        }
                    }
                    r[0] = new Vector<T>(hamt1,0);
                    r[1] = new Vector<T>(hamt2,0);
                }));
        return r;
    }
    distinctBy<U>(keyExtractor: (x:T)=>U&WithEquality): Vector<T> {
        let keySet = HashSet.empty<U>();
        return new Vector<T>(hamt.empty.mutate(
            (h:any) => {
                let targetIdx = 0;
                for (let i=0;i<this.hamt.size;i++) {
                    const val = this.hamt.get(i+this.indexShift);
                    const transformedVal = keyExtractor(val);
                    if (!keySet.contains(transformedVal)) {
                        h.set(targetIdx++, val);
                        keySet = keySet.add(transformedVal);
                    }
                }
            }), 0);
    }
    transform<U>(converter:(x:Vector<T>)=>U): U {
        return converter(this);
    }
    equals(other: Vector<T>): boolean {
        if (!other || !other.hamt) {
            return false;
        }
        const sz = this.hamt.size;
        if (sz !== other.hamt.size) {
            return false;
        }
        for (let i=0;i<this.hamt.size;i++) {
            const myVal: T & WithEquality|null|undefined = this.hamt.get(i+this.indexShift);
            const hisVal: T & WithEquality|null|undefined = other.hamt.get(i+other.indexShift);
            if ((myVal === undefined) !== (hisVal === undefined)) {
                return false;
            }
            if (myVal === undefined || hisVal === undefined) {
                // they are both undefined, the || is for TS's flow analysis
                // so he realizes none of them is undefined after this.
                continue;
            }
            if (!areEqual(myVal, hisVal)) {
                return false;
            }
        }
        return true;
    }
    hashCode(): number {
        let hash = 1;
        for (let i=0;i<this.hamt.size;i++) {
        }
        return hash;
    }
    toString(): string {
        let r = "[";
        for (let i=0;i<this.hamt.size;i++) {
            if (i>0) {
                r += ", ";
            }
            r += toStringHelper(this.hamt.get(i+this.indexShift));
        }
        return r + "]";
    }
    inspect(): string {
        return this.toString();
    }
}
