/** @fileoverview Examples of basic `ctor<T>` usage. */

import { ctor, from } from './ctor';

describe('ctor', () => {
    it('constructs a class', () => {
        class Foo {
            public readonly foo: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ foo }: { foo: string }) {
                this.foo = foo;
            }
        }

        const foo = ctor.new(Foo, { foo: 'test' }).construct();
        expect(foo).toBeInstanceOf(Foo);
        expect(foo.foo).toBe('test');
    });

    it('extends a class', () => {
        class Foo {
            public readonly foo: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ foo }: { foo: string }) {
                this.foo = foo;
            }
        }

        class Bar extends Foo {
            public readonly bar: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor(
                superParams: ConstructorParameters<typeof Foo>,
                { bar }: { bar: string },
            ) {
                super(...superParams);
                this.bar = bar;
            }
        }

        const fooCtor = ctor.new(Foo, { foo: 'foo' });
        const bar = from(fooCtor).new(Bar, { bar: 'bar' }).construct();
        expect(bar).toBeInstanceOf(Bar);
        expect(bar.foo).toBe('foo');
        expect(bar.bar).toBe('bar');
    });

    it('transitively extends an inheritance hierarchy', () => {
        class Foo {
            public readonly foo: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor({ foo }: { foo: string }) {
                this.foo = foo;
            }
        }

        class Bar extends Foo {
            public readonly bar: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor(
                superParams: ConstructorParameters<typeof Foo>,
                { bar }: { bar: string },
            ) {
                super(...superParams);
                this.bar = bar;
            }
        }

        class Baz extends Bar {
            public readonly baz: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor(
                superParams: ConstructorParameters<typeof Bar>,
                { baz }: { baz: string },
            ) {
                super(...superParams);
                this.baz = baz;
            }
        }

        const fooCtor = ctor.new(Foo, { foo: 'foo' });
        const barCtor = from(fooCtor).new(Bar, { bar: 'bar' });
        const baz = from(barCtor).new(Baz, { baz: 'baz' }).construct();

        expect(baz).toBeInstanceOf(Foo);
        expect(baz).toBeInstanceOf(Bar);
        expect(baz).toBeInstanceOf(Baz);

        expect(baz.foo).toBe('foo');
        expect(baz.bar).toBe('bar');
        expect(baz.baz).toBe('baz');
    });

    it('extends an abstract class', () => {
        type FooParams = [ { foo: string } ];
        abstract class Foo {
            public readonly foo: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor(...[ { foo } ]: FooParams) {
                this.foo = foo;
            }
        }

        class Bar extends Foo {
            public readonly bar: string;

            /** Boilerplate, should be generated by compiler. */
            public constructor(
                superParams: FooParams,
                { bar }: { bar: string },
            ) {
                super(...superParams);
                this.bar = bar;
            }
        }

        const fooCtor = ctor.newAbstract<typeof Foo, FooParams>(Foo, {
            foo: 'foo',
        });
        const bar = from(fooCtor).new(Bar, { bar: 'bar' }).construct();

        expect(bar).toBeInstanceOf(Foo);
        expect(bar).toBeInstanceOf(Bar);

        expect(bar.foo).toBe('foo');
        expect(bar.bar).toBe('bar');
    });
});
