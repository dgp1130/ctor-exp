/**
 * @fileoverview Example of a `Set` class with two implementations for
 * optimization. In theory, a lookup operation of O(n) can be faster than a O(1)
 * version for very small n. This explores that idea with two implementations,
 * a `SpareSet` intended for small n, and a `DenseSet` for large n. These two
 * implementations also have mutable versions which should use the same
 * optimization. Lastly, the mutable versions should implement a maximum size,
 * throwing an error if the set would ever exceed its size.
 */

import { ctor, from, Implementation } from './ctor';

describe('Optimized Set', () => {
    it('duplicates code with standard constructors', () => {
        interface OptimizedSet {
            contains(item: number): boolean;
            size(): number;
        }

        class SparseSet implements OptimizedSet {
            private readonly items: number[];

            public constructor(items: number[]) {
                this.items = items;
            }

            public contains(item: number): boolean {
                return this.items.indexOf(item) !== -1;
            }

            public size(): number {
                return this.items.length;
            }
        }

        class DenseSet implements OptimizedSet {
            private readonly map: Map<number, true>;

            public constructor(items: number[]) {
                this.map = new Map(
                    items.map((item) => [ item, true ] as const),
                );
            }

            public contains(item: number): boolean {
                return this.map.has(item);
            }

            public size(): number {
                return this.map.size;
            }
        }

        function createOptimizedSet(items: number[]): OptimizedSet {
            if (items.length < 5) {
                return new SparseSet(items);
            } else {
                return new DenseSet(items);
            }
        }

        // Can use immutable sets directly, dynamically choosing which class.
        const immutableSmallSet = createOptimizedSet([ 1, 2, 3 ]);
        expect(immutableSmallSet).toBeInstanceOf(SparseSet);
        expect(immutableSmallSet.contains(1)).toBeTrue();
        expect(immutableSmallSet.contains(4)).toBeFalse();
        const immutableLargeSet = createOptimizedSet([ 1, 2, 3, 4, 5 ]);
        expect(immutableLargeSet).toBeInstanceOf(DenseSet);
        expect(immutableLargeSet.contains(1)).toBeTrue();
        expect(immutableLargeSet.contains(6)).toBeFalse();

        // Need an interface to represent the common type supported by the
        // Mutable* classes.
        interface MutableOptimizedSet extends OptimizedSet {
            add(item: number): void;
        }

        // Must declare a subclass for each possible superclass implementation.
        class MutableSparseSet
                extends SparseSet implements MutableOptimizedSet {
            private readonly additions: number[] = [];
            private readonly maxSize: number;

            public constructor(items: number[], maxSize: number) {
                super(items);
                this.maxSize = maxSize;
            }

            public add(item: number): void {
                if (this.size() >= this.maxSize) {
                    throw new Error(`Max size ${this.maxSize} exceeded.`);
                }
                this.additions.push(item);
            }

            public size(): number {
                return super.size() + this.additions.length;
            }

            public contains(item: number): boolean {
                if (super.contains(item)) return true;
                return this.additions.indexOf(item) !== -1;
            }
        }

        // Must hard-copy the implementation, even though it is identical to
        // `MutableSparseSet`.
        class MutableDenseSet extends DenseSet implements MutableOptimizedSet {
            private readonly additions: number[] = [];
            private readonly maxSize: number;

            public constructor(items: number[], maxSize: number) {
                super(items);
                this.maxSize = maxSize;
            }

            public add(item: number): void {
                if (this.size() >= this.maxSize) {
                    throw new Error(`Max size ${this.maxSize} exceeded.`);
                }
                this.additions.push(item);
            }

            public size(): number {
                return super.size() + this.additions.length;
            }

            public contains(item: number): boolean {
                if (super.contains(item)) return true;
                return this.additions.indexOf(item) !== -1;
            }
        }

        // Need to duplicate the `createOptimizedSet()` decision logic.
        function createMutableOptimizedSet(items: number[], maxSize: number):
                MutableOptimizedSet {
            if (items.length < 5) {
                return new MutableSparseSet(items, maxSize);
            } else {
                return new MutableDenseSet(items, maxSize);
            }
        }

        const smallSet = createMutableOptimizedSet([ 1, 2, 3 ], 4);
        expect(smallSet).toBeInstanceOf(MutableSparseSet);
        expect(smallSet).toBeInstanceOf(SparseSet);
        expect(smallSet.size()).toBe(3);
        expect(smallSet.contains(1)).toBeTrue();
        expect(smallSet.contains(4)).toBeFalse();
        smallSet.add(4);
        expect(smallSet.contains(4)).toBeTrue();
        expect(smallSet.size()).toBe(4);
        expect(() => smallSet.add(5)).toThrowError('Max size 4 exceeded.');

        const largeSet = createMutableOptimizedSet([ 1, 2, 3, 4, 5 ], 6);
        expect(largeSet).toBeInstanceOf(MutableDenseSet);
        expect(largeSet).toBeInstanceOf(DenseSet);
        expect(largeSet.size()).toBe(5);
        expect(largeSet.contains(1)).toBeTrue();
        expect(largeSet.contains(6)).toBeFalse();
        largeSet.add(6);
        expect(largeSet.contains(6)).toBeTrue();
        expect(largeSet.size()).toBe(6);
        expect(() => largeSet.add(5)).toThrowError('Max size 6 exceeded.');
    });

    it('is easier, but still awkward with mixins and currying', () => {
        // Not all languages have good support for mixins, but if yours does,
        // you might try implementing `OptimizedSet` like this.

        interface OptimizedSet {
            contains(item: number): boolean;
            size(): number;
        }

        class SparseSet implements OptimizedSet {
            private readonly items: number[];

            public constructor({ items }: { items: number[] }) {
                this.items = items;
            }

            public contains(item: number): boolean {
                return this.items.indexOf(item) !== -1;
            }

            public size(): number {
                return this.items.length;
            }
        }

        class DenseSet implements OptimizedSet {
            private readonly map: Map<number, true>;

            public constructor({ items }: { items: number[] }) {
                this.map = new Map(
                    items.map((item) => [ item, true ] as const),
                );
            }

            public contains(item: number): boolean {
                return this.map.has(item);
            }

            public size(): number {
                return this.map.size;
            }
        }

        // Make the optimizer generic, with no knowledge of the sparse/dense
        // versions of the class.
        function optimize<
            T,
            TSparse extends OptimizedSet,
            TDense extends OptimizedSet,
        >(
            SparseClass: new (params: { items: T[] }) => TSparse,
            DenseClass: new (params: { items: T[] }) => TDense,
        ): (items: T[]) => TSparse | TDense {
            return (items: T[]) => {
                if (items.length < 5) {
                    return new SparseClass({ items });
                } else {
                    return new DenseClass({ items });
                }
            };
        }

        // Use the optimizer to decide between a `SparseSet` and a `DenseSet`.
        const createOptimizedSet = optimize(SparseSet, DenseSet);

        // Can use immutable sets directly, dynamically choosing which class.
        const immutableSmallSet = createOptimizedSet([ 1, 2, 3 ]);
        expect(immutableSmallSet).toBeInstanceOf(SparseSet);
        expect(immutableSmallSet.contains(1)).toBeTrue();
        expect(immutableSmallSet.contains(4)).toBeFalse();
        const immutableLargeSet = createOptimizedSet([ 1, 2, 3, 4, 5 ]);
        expect(immutableLargeSet).toBeInstanceOf(DenseSet);
        expect(immutableLargeSet.contains(1)).toBeTrue();
        expect(immutableLargeSet.contains(6)).toBeFalse();

        // Implement mutability as a mixin, rather than a class. This way its
        // functionality can be shared across multiple sub classes of
        // `OptimizedSet`.
        function Mutable<C extends new (...args: any[]) => OptimizedSet>(
                clazz: C) {
            return class extends clazz {
                private readonly additions: number[] = [];

                // Cannot add parameters for a mixin because all mixins in
                // TypeScript must have the constructor signature:
                // `constructor(...args: any[])`. While there are ways to trick
                // this, after an hour, I haven't figured out how to do it in a
                // way that is type safe for users of this mixin, and if that
                // doesn't prove my point that this system sucks, then I don't
                // know what does.
                //
                // TL;DR: Adding the `maxSize` feature is impractical because
                // mixins and constructors don't like each other.
                //
                // public constructor(maxSize: number, ...args: any[]) {
                //     super(...args);
                //     this.maxSize = maxSize;
                // }

                public add(item: number): void {
                    this.additions.push(item);
                }

                public size(): number {
                    return super.size() + this.additions.length;
                }

                public contains(item: number): boolean {
                    if (super.contains(item)) return true;
                    return this.additions.indexOf(item) !== -1;
                }
            };
        }

        // Still need to extend a mutable version of every implementation of
        // `OptimizedSet`.
        class MutableSparseSet extends Mutable(SparseSet) { }
        class MutableDenseSet extends Mutable(DenseSet) { }

        // Use the optimizer to decide between a `MutableSparseSet` and a
        // `MutableDenseSet`.
        const createMutableOptimizedSet =
                optimize(MutableSparseSet, MutableDenseSet);

        const smallSet = createMutableOptimizedSet([ 1, 2, 3 ]);
        expect(smallSet).toBeInstanceOf(MutableSparseSet);
        expect(smallSet).toBeInstanceOf(SparseSet);
        expect(smallSet.size()).toBe(3);
        expect(smallSet.contains(1)).toBeTrue();
        expect(smallSet.contains(4)).toBeFalse();
        smallSet.add(4);
        expect(smallSet.contains(4)).toBeTrue();
        expect(smallSet.size()).toBe(4);

        const largeSet = createMutableOptimizedSet([ 1, 2, 3, 4, 5 ]);
        expect(largeSet).toBeInstanceOf(MutableDenseSet);
        expect(largeSet).toBeInstanceOf(DenseSet);
        expect(largeSet.size()).toBe(5);
        expect(largeSet.contains(1)).toBeTrue();
        expect(largeSet.contains(6)).toBeFalse();
        largeSet.add(6);
        expect(largeSet.contains(6)).toBeTrue();
        expect(largeSet.size()).toBe(6);
    });

    it('works well with ctor<T>', () => {
        interface OptimizedSet {
            contains(item: number): boolean;
            size(): number;
        }

        class SparseSet implements OptimizedSet {
            private readonly items: number[];

            /** Boilerplate, should be generated by compiler. */
            public constructor({ items }: { items: number[] }) {
                this.items = items;
            }

            public contains(item: number): boolean {
                return this.items.indexOf(item) !== -1;
            }

            public size(): number {
                return this.items.length;
            }

            public static from(items: number[]): ctor<SparseSet> {
                return ctor.new(SparseSet, { items }) as ctor<SparseSet>;
            }
        }

        class DenseSet implements OptimizedSet {
            private readonly map: Map<number, true>;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ map }: { map: Map<number, true> }) {
                this.map = map;
            }

            public contains(item: number): boolean {
                return this.map.has(item);
            }

            public size(): number {
                return this.map.size;
            }

            public static from(items: number[]): ctor<DenseSet> {
                const map = new Map(
                    items.map((item) => [ item, true ] as const),
                );
                return ctor.new(DenseSet, { map }) as ctor<DenseSet>;
            }
        }

        function createOptimizedSet(items: number[]): ctor<OptimizedSet> {
            if (items.length < 5) {
                return SparseSet.from(items);
            } else {
                return DenseSet.from(items);
            }
        }

        // Can use immutable sets directly, dynamically choosing which class.
        const immutableSmallSet = createOptimizedSet([ 1, 2, 3 ]).construct();
        expect(immutableSmallSet).toBeInstanceOf(SparseSet);
        expect(immutableSmallSet.contains(1)).toBeTrue();
        expect(immutableSmallSet.contains(4)).toBeFalse();
        const immutableLargeSet =
                createOptimizedSet([ 1, 2, 3, 4, 5 ]).construct();
        expect(immutableLargeSet).toBeInstanceOf(DenseSet);
        expect(immutableLargeSet.contains(1)).toBeTrue();
        expect(immutableLargeSet.contains(6)).toBeFalse();

        class MutableSet extends Implementation<OptimizedSet>() {
            private readonly additions: number[] = [];
            private readonly maxSize: number; // No problem with maxSize!

            /** Boilerplate, should be generated by compiler. */
            public constructor({ maxSize }: {
                maxSize: number,
            }) {
                super();
                this.maxSize = maxSize;
            }

            public add(item: number): void {
                if (this.size() >= this.maxSize) {
                    throw new Error(`Max size ${this.maxSize} exceeded.`);
                }
                this.additions.push(item);
            }

            public contains(item: number): boolean {
                if (this._super.contains(item)) return true;
                return this.additions.indexOf(item) !== -1;
            }

            public size(): number {
                return this._super.size() + this.additions.length;
            }

            // Compose the optimization logic, so all `MutableSet` classes
            // choose the optimal superclass.
            public static from(items: number[], maxSize: number): MutableSet {
                const mutableSetCtor = from(createOptimizedSet(items))
                        .new(MutableSet, { maxSize }) as ctor<MutableSet>;
                return mutableSetCtor.construct();
            }
        }

        // Can extend a mutable set, also dynamically choosing its superclass.
        const smallSet = MutableSet.from([ 1, 2, 3 ], 4);
        expect(smallSet).toBeInstanceOf(MutableSet);
        expect(smallSet).toBeInstanceOf(SparseSet);
        expect(smallSet.size()).toBe(3);
        expect(smallSet.contains(1)).toBeTrue();
        expect(smallSet.contains(4)).toBeFalse();
        smallSet.add(4);
        expect(smallSet.contains(4)).toBeTrue();
        expect(smallSet.size()).toBe(4);
        expect(() => smallSet.add(5)).toThrowError('Max size 4 exceeded.');

        const largeSet = MutableSet.from([ 1, 2, 3, 4, 5 ], 6);
        expect(largeSet).toBeInstanceOf(MutableSet);
        expect(largeSet).toBeInstanceOf(DenseSet);
        expect(largeSet.size()).toBe(5);
        expect(largeSet.contains(1)).toBeTrue();
        expect(largeSet.contains(6)).toBeFalse();
        largeSet.add(6);
        expect(largeSet.contains(6)).toBeTrue();
        expect(largeSet.size()).toBe(6);
        expect(() => largeSet.add(7)).toThrowError('Max size 6 exceeded.');
    });
});
