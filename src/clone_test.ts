/** @fileoverview Examples of cloning object hierarchies. */

import { ctor, from, Implementation } from './ctor';

describe('cloning', () => {
    it('normally requires awkward copy constructors', () => {
        class Foo {
            private readonly foo: string;

            // We want to just construct off a single string, but we're forced
            // into supporting `Foo` in this constructor.
            public constructor(param: string | Foo) {
                if (param instanceof Foo) {
                    this.foo = param.foo;
                } else {
                    this.foo = param;
                }
            }

            public clone(): Foo {
                // Could write this as `new Foo({ fooParam: this.foo })`,
                // however it would not be composable by `Bar`. Instead we
                // **must** use a copy constructor, which makes the constructor
                // implementation much more complicated.
                return new Foo(this);
            }
        }

        class Bar extends Foo {
            private readonly bar: string;

            // This gets even more awkward as the constructor gets more
            // complicated. We need to support either copying a single `Bar`, or
            // constructing off two strings.
            public constructor(params: Bar | [ foo: string, bar: string ]) {
                if (params instanceof Bar) {
                    super(params);
                    this.bar = params.bar;
                } else {
                    const [ foo, bar ] = params;
                    super(foo);
                    this.bar = bar;
                }
            }

            public clone(): Bar {
                return new Bar(this);
            }
        }

        // Using `Bar` is now more awkward, using an array shouldn't be needed!
        const bar = new Bar([ 'foo', 'bar' ]);
        const barClone = bar.clone();
        expect(barClone).toEqual(bar);
        expect(barClone).not.toBe(bar);
    });

    it('is intuitive with ctor<T>', () => {
        class Foo {
            public readonly foo: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ foo }: { foo: string }) {
                this.foo = foo;
            }

            // Clone is just a non-static factory, easily composeable!
            public clone(): ctor<Foo> {
                return ctor.new(Foo, { foo: this.foo });
            }
        }

        class Bar extends Implementation<Foo>() {
            public readonly bar: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ bar }: { bar: string }) {
                super();
                this.bar = bar;
            }

            // `Bar` simply composes `Foo.prototype.clone()` intuitively. No
            // awkward copy constructors.
            public clone(): ctor<Bar> {
                return from(this._super.clone()).new(Bar, { bar: this.bar });
            }
        }

        // Construction API is unaffected, no awkward array literal here!
        const fooCtor = ctor.new(Foo, { foo: 'foo' });
        const bar = from(fooCtor).new(Bar, { bar: 'bar' }).construct();

        const barClone = bar.clone().construct();

        expect(barClone).toBeInstanceOf(Foo);
        expect(barClone).toBeInstanceOf(Bar);
        expect(barClone).toEqual(bar);
        expect(barClone).not.toBe(bar);
    });
});
