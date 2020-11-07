/** @fileoverview Examples of design coupling/decoupling. */

import { ctor, from, Implementation } from './ctor';

describe('coupling of subclass and superclass construction', () => {
    it('normally makes factory composition and timing more complicated', async () => {
        class Foo {
            public readonly foo: number;

            public constructor(foo: number) {
                this.foo = foo;
            }

            public static async dataFromFooId(id: number): Promise<number> {
                // Do some async work.
                const data = await Promise.resolve(id);

                // Must return internal data of Foo because we can't construct
                // yet.
                return data;
            }
        }

        class Bar extends Foo {
            public readonly bar: string;

            // Leaks `foo` into constructor of `Bar`.
            // Can avoid this with `ConstructorParameters<typeof Foo>`, but if
            // some parameters should be explicitly provided by `Bar`, this can
            // get awkward.
            public constructor(foo: number, bar: string) {
                super(foo);
                this.bar = bar;
            }

            public static async fromBar(id: number, bar: string): Promise<Bar> {
                // Get the required parameters to construct `Foo`.
                const fooData = await Foo.dataFromFooId(id);

                // Do some more work unique to `Bar`.
                const barData = await Promise.resolve(bar);

                // Must pass `Foo`'s internal data back into itself to construct
                return new Bar(fooData, barData);
            }
        }

        const bar = await Bar.fromBar(0, 'test');
        expect(bar).toBeInstanceOf(Foo);
        expect(bar).toBeInstanceOf(Bar);
        expect(bar.foo).toBe(0);
        expect(bar.bar).toBe('test');
    });

    it('is reduced by using ctor<T> and composing constructors', async () => {
        class Foo {
            public readonly foo: number;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ foo }: { foo: number }) {
                this.foo = foo;
            }

            public static async fromFooId(id: number): Promise<ctor<Foo>> {
                // Do some async work.
                const data = await Promise.resolve(id);

                // Return a self-contained `ctor<Foo>`. Nicely abstracted and
                // does not leak internal information.
                return ctor.new(Foo, { foo: data });
            }
        }

        class Bar extends Implementation<Foo>() {
            public readonly bar: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ bar }: { bar: string }) {
                super();
                this.bar = bar;
            }

            public static async fromBar(id: number, bar: string): Promise<Bar> {
                // Get the `ctor<Foo>`.
                const superCtor = await Foo.fromFooId(id);

                // Do some more work unique to `Bar`.
                const data = await Promise.resolve(bar);

                // Construct `Bar` by simply composing `Foo.fromFoo()`.
                return from(superCtor).new(Bar, { bar: data }).construct();
            }
        }

        const bar = await Bar.fromBar(0, 'test');
        expect(bar).toBeInstanceOf(Foo);
        expect(bar).toBeInstanceOf(Bar);
        expect(bar.foo).toBe(0);
        expect(bar.bar).toBe('test');
    });
});
