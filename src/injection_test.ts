/** @fileoverview Examples of supporting multiple constructor types. */

import { ctor, from, Implementation } from './ctor';

describe('multiple superclass constructors', () => {
    it('normally leak into the subclass constructors', () => {
        class Foo {
            public readonly foo: number;

            // We want to support construction from either a string or a number.
            // In many languages this is implemented by overloading the
            // constructor function.
            public constructor(foo: string | number) {
                if (typeof foo === 'number') {
                    this.foo = foo;
                } else {
                    this.foo = foo.length;
                }
            }
        }

        class Bar extends Foo {
            public readonly bar: string;

            // Type of `foo` parameter leaks into `Bar`'s constructor, even
            // though we don't care which one is actually used. This is
            // especially annoying for overloaded constructors.
            public constructor(foo: string | number, bar: string) {
                super(foo);
                this.bar = bar;
            }
        }

        const barFromNumber = new Bar(1, 'bar');
        expect(barFromNumber).toBeInstanceOf(Foo);
        expect(barFromNumber).toBeInstanceOf(Bar);
        expect(barFromNumber.foo).toBe(1);
        expect(barFromNumber.bar).toBe('bar');

        const barFromString = new Bar('test', 'bar');
        expect(barFromString).toBeInstanceOf(Foo);
        expect(barFromString).toBeInstanceOf(Bar);
        expect(barFromString.foo).toBe(4);
        expect(barFromString.bar).toBe('bar');
    });

    it('are abstracted away by injecting ctor<SuperClass> as a dependency', () => {
        class Foo {
            public readonly foo: number;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ foo }: { foo: number }) {
                this.foo = foo;
            }

            // Two different factories to handle the different possible inputs.
            public static fromNumber(foo: number): ctor<Foo> {
                return ctor.new(Foo, { foo });
            }
            public static fromString(foo: string): ctor<Foo> {
                return ctor.new(Foo, { foo: foo.length });
            }
        }

        class Bar extends Implementation<Foo>() {
            public readonly bar: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ bar }: { bar: string }) {
                super();
                this.bar = bar;
            }

            // `Foo` constructor data is nicely abstracted, we don't care which
            // one is used and no information leaks into `Bar`!
            public static fromBar(superCtor: ctor<Foo>, bar: string): Bar {
                return from(superCtor).new(Bar, { bar }).construct();
            }
        }

        // Consumer of Bar is free to choose `Foo.fromNumber()`...
        const superCtorFromNumber = Foo.fromNumber(1);
        const barFromNumber = Bar.fromBar(superCtorFromNumber, 'bar');
        expect(barFromNumber).toBeInstanceOf(Foo);
        expect(barFromNumber).toBeInstanceOf(Bar);
        expect(barFromNumber.foo).toBe(1);
        expect(barFromNumber.bar).toBe('bar');

        // Or `Foo.fromString()`...
        const superCtorFromString = Foo.fromString('test');
        const barFromRandom = Bar.fromBar(superCtorFromString, 'bar');
        expect(barFromRandom).toBeInstanceOf(Foo);
        expect(barFromRandom).toBeInstanceOf(Bar);
        expect(barFromRandom.foo).toBe(4);
        expect(barFromRandom.bar).toBe('bar');
    });
});
