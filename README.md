# ctor-exp

An experimental implementation of `ctor<T>`, a new paradigm for constructing
objects as described [here](https://blog.dwac.dev/posts/constructors/). This is
implemented as a simple TypeScript library because it's type system is
~~abusable~~ powerfull enough to provide most of the critical features of
`ctor<T>`. Someone smarter than me could probably do better with a custom
compiler or plugin, but this is good enough for an experimental implementation.

This is not intended for production usage or anything beyond basic
experimentation. **DO NOT USE THIS IN REAL CODE**. You have been warned.

Retrofitting an existing language's constructor semantics to fit a new paradigm
is a losing battle and should not be done, I am merely doing it here for
explanatory purposes and to give developers something they can actually use in
order to evaluate how effective this system actually is.

## Installation

Install the package via NPM and import/require it accordingly. The only two
symbols exported are `ctor<T>`, and `from()` (described below).

```shell
npm install ctor-exp
```

## Basic Usage

Classes should be defined with public constructors that follow the format
(examples are TypeScript, JavaScript can be used by simply dropping the types):

```typescript
class Foo {
    // Declare class fields.
    private foo: string;
    public bar: number;
    private readonly baz: boolean;
    private other: string = 'something';

    // Boilerplate, uninteresting constructor. In a real implementation this
    // would be automatically generated by the compiler, but for this experiment
    // it must be hand-written. See Invariants section for more info on the
    // precise requirements of constructors.
    public constructor({ foo, bar, baz }: {
        foo: string,
        bar: number,
        baz: boolean,
    }) {
        // Directly assign constructor parameters to class fields, do not do any
        // additional computation in the constructor.
        this.foo = foo;
        this.bar = bar;
        this.baz = baz;
        // Fields unrelated to the constructor (like `other`) can be left out.
    }
}
```

Now that the boilerplate constructor exists, we can use `ctor<T>` to construct
it. We can introduce a factory to construct this type:

```typescript
import { ctor } from 'ctor-exp';

class Foo {
    // Snip - Class fields and constructor...

    // Factory to use when creating a `Foo` object.
    public static from(foo: string, bar: number): Foo {
        const baz = foo.length === bar; // Do some work..

        // Construct `Foo` when ready!
        return ctor.new(Foo, { foo, bar, baz }).construct();
    }
}
```

Using this system we have simple, boilerplate constructors and all the
initialization logic is performed in separate factories. However, it is easy
follow this pattern in existing programming languages if a developer is so
inclined. The tricky part is inheritance, so let's extend something!

```typescript
import { ctor, from, Implementation } from 'ctor-exp';

class Foo {
    public readonly foo: string;

    // Boilerplate, uninteresting constructor.
    public constructor({ foo }: { foo: string }) {
        this.foo = foo;
    }

    // Factory for creating a `ctor<Foo>`, extendable by subclasses.
    public static createFoo(foo: string): ctor<Foo> {
        const oof = foo.split('').reverse().join(''); // Do some work...

        // Return the `ctor<Foo>`, just don't `.construct()` it yet.
        return ctor.new(Foo, { foo: oof });
    }
}

// Extend an implementation of `Foo`, generated by `ctor<T>`. This is necessary
// to properly construct this extended class with `ctor<T>`.
class Bar extends Implementation<Foo>() {
    public readonly bar: string;

    // Also boilerplate, equally uninteresting constructor.
    // Only difference is an empty `super()` call. No need to provide any
    // parameters to `Foo`, `ctor<T>` will do that for you.
    public constructor({ bar }: { bar: string }) {
        super();
        this.bar = bar;
    }

    // Factory for creating a `Bar`, composing `Foo.createFoo()`.
    public static createBar(foo: string, bar: string): Bar {
        // Get a `ctor<Foo>` by calling `Foo`'s factory.
        const fooCtor = Foo.createFoo(foo);

        // Constrct `Bar` by extending the return `ctor<Foo>`.
        return from(fooCtor).new(Bar, { bar }).construct();
    }
}
```

Using `from()`, we're able to cleanly compose and reuse the `ctor<T>` object
returned from `Foo.createFoo()`.

You should *never* extend a class directly. Always extend
`Implementation<MyParentClass>()` instead.

If you ever want to call a superclass method, rather than using
`super.method()`, you should use `this._super.method()`. This is just a quirk of
how the library is implemented on top of the existing JavaScript class paradigm.

## Examples

The idea of using a "dumb" constructor that
only assigns class fields combined with composeable factories that perform the
real business logic in a form which cleanly supports inheritance allows an
easier implementation of many common problems in computer science.

Check out some examples which take simple use cases and show how they can be
surprisingly tricky using traditional constructors. Then look at the `ctor<T>`
implementation to see how much simpler these solutions can be.

*   [Basic use](./src/ctor_test.ts)
*   [Factory composition](./src/factories_test.ts)
*   [Dependency injection of `ctor<T>`](./src/injection_test.ts)
*   [Deep cloning objects](./src/clone_test.ts)
*   [Serialization/deserialization](./src/serialization_test.ts)
*   [Constructor coupling](./src/coupling_test.ts)

## Invariants

Since this constructor paradigm is intended for a brand new programming
language, not all of its features/restrictions can be implemented in this
experimental library. As a result, there are a few invariants to keep in mind
when using it to ensure that you are using it in a way that would be supported
by a real compiler. Some of these restrictions are partially enforced by the
type systems, others are not.

*   Constructors **must** merely assign parameters to class fields and should
    not contain any additional logic. Such logic should be implemented in
    factories.
*   Constructors *should* use named parameters, but that is not strictly
    necessary in this implementation.
*   Subclasses **must** extend `Implementation<SuperClass>` and should **never**
    extend a `SuperClass` directly.
*   When calling a superclass method, you **must** use `this._super.method()`
    and never use `super.method()`, as it won't have the method you are calling.
*   Do not call `new Foo()` directly on a subclass. It is reasonable to use
    `new` on a class which does not extend another parent class, however
    subclasses must always be constructed with
    `from(parentCtor).new(/* ... */)`.
*   `ctor.new(Foo, /* ... */)` should only be used within `Foo` itself (via
    methods on the class).
    *   Invoking `ctor.new()` is an implementation detail of the class being
        constructed.
    *   Subclasses should **not** call `ctor.new(ParentClass, /* ... */)`, they
        should call a factory which returns `ctor<ParentClass>`.
    *   Calling `.construct()` is perfectly reasonable from any context.
*   `from(ctor<SuperClass>)` should only be used to immediately call
    `.new(SubClass, /* ... */)` on its result.
    *   The type returned by `from()` is an implementation detail of `ctor<T>`,
        which should not be observed by the program.
