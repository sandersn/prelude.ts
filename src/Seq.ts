import { WithEquality, Ordering } from "./Comparison";
import { IMap } from "./IMap";
import { Option } from "./Option";
import { Collection } from "./Collection";
import { Foldable } from "./Foldable";
export interface Seq<T> extends Collection<T>, Foldable<T> {
    appendStruct(elt: T): Seq<T>;
    append(elt: T & WithEquality): Seq<T>;
    appendAll(elts: Iterable<T&WithEquality>): Seq<T>;
    appendAllStruct(elts: Iterable<T>): Seq<T>;
    forEach(fn: (v:T)=>void): Seq<T>;
    head(): Option<T>;
    last(): Option<T>;
    tail(): Option<Seq<T>>;
    mapStruct<U>(mapper:(v:T)=>U): Seq<U>;
    map<U>(mapper:(v:T)=>U&WithEquality): Seq<U>;
    find(predicate:(v:T)=>boolean): Option<T>;
    flatMap<U>(mapper:(v:T)=>Seq<U&WithEquality>): Seq<U>;
    flatMapStruct<U>(mapper:(v:T)=>Seq<U>): Seq<U>;
    groupBy<C>(classifier: (v:T)=>C&WithEquality): IMap<C,Seq<T>>;
    arrangeBy<K>(getKey: (v:T)=>K&WithEquality): Option<IMap<K,T>>;
    shuffle(): Seq<T>;
    sortBy(compare: (v1:T,v2:T)=>Ordering): Seq<T>;
    sortOn(getKey: (v:T)=>number): Seq<T>;
    prependStruct(elt: T): Seq<T>;
    prepend(elt: T & WithEquality): Seq<T>;
    prependAll(elts: Iterable<T&WithEquality>): Seq<T>;
    prependAllStruct(elts: Iterable<T>): Seq<T>;
    mkString(separator: string): string;
    zip<U>(other: Iterable<U&WithEquality>): Seq<[T,U]>;
    zipStruct<U>(other: Iterable<U>): Seq<[T,U]>;
    get(idx: number): Option<T>;
    drop(n:number): Seq<T>;
    dropWhile(predicate:(x:T)=>boolean): Seq<T>;
    dropRight(n:number): Seq<T>;
    takeWhile(predicate:(x:T)=>boolean): Seq<T>;
    distinctBy<U>(keyExtractor: (x:T)=>U&WithEquality): Seq<T>;
    reverse(): Seq<T>;
    partition(predicate:(x:T)=>boolean): [Seq<T>,Seq<T>];
    toMap<K,V>(converter:(x:T)=>[K & WithEquality,V & WithEquality]): IMap<K,V>;
    toMapStruct<K,V>(converter:(x:T)=>[K & WithEquality,V]): IMap<K,V>;
    transform<U>(converter:(x:Seq<T>)=>U): U;
}
