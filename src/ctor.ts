/**
 * @fileoverview Implementation of the `ctor<T>` concept. See tests for usage
 * examples.
 */

/** Represents a constructor of a value of type T. */
export class ctor<T> {
    private readonly parentCtor?: ctor<unknown>;
    private readonly ctor: ConstructorOf<T>;
    private readonly params: unknown[];

    /**
     * Ideally the parameters would be more strongly typed. Unfortunately, we
     * would need to move such a generic into the `ctor` class as constructor's
     * cannot have their own generic perameters like regular functions. If we
     * did introduce a `ctor<T, Params>` type, it would mean that `ctor` is no
     * longer covariant for subclasses of `T`. Essentially, it is valid to
     * write:
     * 
     * ```typescript
     * const animal: ctor<Animal> = new ctor<Cat>();
     * ```
     * 
     * But it is **not** valid to write:
     * 
     * ```typescript
     * const animal: ctor<Animal, ConstructorParameters<Animal>> =
     *     new ctor<Cat, ConstructorParameters<Cat>>()
     * ```
     * 
     * As a result, we need to limit `ctor<T>` to only include the constructed
     * type as a parameter to satisfy this contract. Instead, we require users
     * to use `ctor.new()`, which **can** have function-specific generic
     * parameters. We trust that `ctor.new()` properly type checks its inputs
     * and so calls to `new ctor<T>()` are expected to be safe, even if not
     * validated here.
     * 
     * @param parentCtor A `ctor<Parent>` to construct the parent class.
     * @param ctor The class to construct.
     * @param params The parameters for the {@link ctor} constructor.
     */
    private constructor(
        parentCtor: ctor<unknown> | undefined,
        ctor: ConstructorOf<T>,
        ...params: unknown[]
    ) {
        this.parentCtor = parentCtor;
        this.ctor = ctor;
        this.params = params;
    }

    /** Constructs an instance of the concrete class T. */
    public construct(): T {
        const self = {}; // Create a new `this` object.

        // Invoke the class constructor and all parent class constructors using
        // `self` as the `this` object. Since these constructors only assign
        // data, `self` should contain that that data.
        const proto = this.constructOn(self);

        // Set the prototype of the result to use the new prototypical hierarchy
        // rather than the one provided by JavaScript's native `class` syntax.
        Object.setPrototypeOf(self, proto);

        return self as T;
    }

    /**
     * Invokes an objects constructor on the given object and assigns its
     * protos. Since a given class may not know its superclass until it is
     * constructed, we cannot rely on a `super()` call to actually invoke
     * anything useful. Instead, all classes inherit from nothing in a strict
     * JavaScript sense, and `constructOn()` is responsible for allocating a new
     * object, calling the constructor functions appropriately, and mangling the
     * `prototype` objects in order to simulate normal usage. This is done at
     * construction time in order to provide more flexibility than currently
     * available in standard JavaScript.
     */
    private constructOn(obj: Record<string, unknown>): Record<string, unknown> {
        // Invoke parent constructor if this class extends another.
        const parentProto =
                this.parentCtor?.constructOn(obj) ?? Base.prototype;

        // Invoke this class' constructor, assigning its data to `obj`.
        this.ctor.apply(obj as any, this.params);

        // Create a new prototype object by cloning the class' prototype.
        const proto = { ...this.ctor.prototype };

        // For some reason, the constructor is not propagated via object spread
        // or `Object.assign()`. Do this manually.
        proto.constructor = this.ctor.prototype.constructor;

        // Provide an implementation of `Symbol.hasInstance` on the class so
        // `instanceof` will work as expected. This should really be done on the
        // class itself just once rather than doing this during construction,
        // however we don't have any other easy hook to do this on each class in
        // the hierarchy. We can compare with `Object[Symbol.hasInstance]` to
        // know if this initialization has already been done on previous object
        // constructions.
        if (this.ctor[Symbol.hasInstance] === Object[Symbol.hasInstance]) {
            Object.defineProperty(this.ctor, Symbol.hasInstance, {
                value: this.hasInstance.bind(this),
            });
        }

        // Use the new prototype hierarchy.
        Object.setPrototypeOf(proto, parentProto);

        return proto;
    }

    /**
     * Returns whether or not the given object is an instance of the class to be
     * constructed by this `ctor<T>`. This function should be identical for all
     * `ctor` objects with the same `T`.
     */
    private hasInstance(instance: unknown): boolean {
        for (const ctor of Array.from(getPrototypeConstructors(instance))) {
            if (ctor === this.ctor) return true;
        }
        return this.parentCtor?.hasInstance(instance) ?? false;
    }

    /**
     * Creates a new `ctor<T>` for the given class with its parameters.
     * 
     * This factory wraps the `ctor<T>` constructor with properly type checked
     * constructor parameters. This allows us to make the {@link params}
     * argument strongly typed as a generic type inferred from {@link clazz},
     * while leaving the `ctor` class only generic on {@link clazz}, which is
     * helpful for variance.
     * 
     * You can technically use this without `from()` on the superclass
     * `ctor<T>`, however that is definitely not recommended and a compiler
     * which implements these concepts would actually restrict such usage.
     * Unfortunately there is no way to strictly enforce that `from()` is used
     * (there are ways to simulate it with circumventable methods). Fortunately,
     * to use `ctor.new()` on a subclass without `from()` requires explicitly
     * providing super class constructor parameters in a really awkward fashion,
     * so the type system should stop most users from doing this anyways.
     * 
     * @param clazz The class to construct.
     * @param params The parameters for the {@link clazz} constructor.
     */
    public static new<Clazz extends ConstructorOf<any>>(
        clazz: Clazz,
        ...params: ConstructorParameters<typeof clazz>
    ): ctor<InstanceType<typeof clazz>> {
        return new ctor<InstanceType<Clazz>>(undefined, clazz, ...params);
    }

    /**
     * Creates a new `ctor<T>` for the given abstract class with its parameters.
     * You should prefer `ctor.new()` for all concrete classes (even super
     * classes) as it is more strongly typed.
     * 
     * Unfortunately, in TypeScript, abstract classes do not have constructors
     * which are accessible in the type system (because abstract classes do not
     * satisfy `{ new (...args: any[]) => any }` since they cannot be `new`-ed
     * without being extended). This means we have no way of knowing what the
     * appropriate parameter types are for a given abstract class. Instead, this
     * function acts as an alternative to `ctor.new()` except that the user must
     * explicitly provide the `Params` type, rather than automatically inferring
     * it from `Clazz`.
     */
    public static newAbstract<
        Clazz extends AbstractClass,
        Params extends unknown[],
    >(clazz: Clazz, ...params: Params): ctor<AbstractInstance<Clazz>> {
        // Must hard cast to a constructor type here knowing that `ctor` will do
        // the right thing, even though an abstract class cannot be `new`-ed.
        const abstractClazz =
                clazz as unknown as ConstructorOf<AbstractInstance<Clazz>>;
        return new ctor<AbstractInstance<Clazz>>(undefined, abstractClazz, ...params);
    }

    public extend<ChildClass extends ConstructorOf<T>>(
        childClass: ChildClass,
        ...params: ConstructorParameters<typeof childClass>
    ): ctor<AbstractInstance<typeof childClass>> {
        return new ctor<AbstractInstance<typeof childClass>>(
                this, childClass, ...params);
    }
}

/** Get all the constructors of each class in prototype hierarchy. */
function* getPrototypeConstructors(obj: any): Iterable<any> {
    let proto = Object.getPrototypeOf(obj);
    while (proto?.constructor && proto.constructor !== Object) {
        yield proto.constructor;
        proto = Object.getPrototypeOf(proto);
    }
}

/** Represents a `ctor<SuperClass>` to be extended by a `ctor<SubClass>`. */
class Extended<Parent> {
    public constructor(private readonly parentCtor: ctor<Parent>) { }

    /**
     * Creates a `ctor<Child>` by using the constructor parameters provided and
     * extending the `ctor<Parent>`.
     */
    public new<Child extends ConstructorOf<Parent>>(
        child: Child,
        ...params: ConstructorParameters<typeof child>
    ): ctor<InstanceType<Child>> {
        return this.parentCtor.extend(child, ...params);
    }
}

/**
 * Sets up the provided `ctor<T>` of a parent class to be extended by a
 * `ctor<Child>`.
 */
export function from<T>(superCtor: ctor<T>): Extended<T> {
    return new Extended<T>(superCtor);
}

/**
 * Creates a fake implementation of interface T. This is useful for extending a
 * superclass without having a direct reference to its implementation. It
 * represents "some implementation of the interface T". The actual
 * implementation it generates is empty, however it is enough to trick the type
 * system into thinking the class is implemented. Constructing through `ctor<T>`
 * actually enforces that the superclass is really provided.
 */
export function Implementation<T = {}>() {
    // This should really return Object, being the top-level object. However,
    // the `Object` constructor will create a new object rather than using the
    // value provided for `this`. Meaning `Object.call({ foo: 'bar' })` returns
    // `{}`, while `(class {}).call({ foo: 'bar' })` returns `{ foo: 'bar' }`
    // (when transpiled). We want the later behavior to be compatible with
    // `ctor`, so we must return `class {}` here, rather than `Object`. It still
    // extends `Object` anyways, so `instanceof Object` works as expected.
    // We also want to use `Base` anyways so we can use `this._super`.
    return Base as unknown as {
        new (...args: any[]): T & {
            _super: T;
        };
    };
}

class Base<T> {
    // Expose a drop-in replacement of `super` for invoking superclass methods.
    // Regular `super.foo()` doesn't work because `super` is transpiled to use a
    // direct reference to the extended class, which doesn't reflect the actual
    // superclass from `ctor<T>`'s perspective. We work around this by always
    // using `this._super.foo()` instead, which provides a reference to the
    // superclass function, bound to `this` so it works as expected.
    protected get _super(): T {
        const self = this;
        const thisClass = Object.getPrototypeOf(this);
        const superClass = Object.getPrototypeOf(thisClass);
        return new Proxy(superClass, {
            get(target, prop) {
                const value = target[prop];
                if (value instanceof Function) {
                    return value.bind(self);
                } else {
                    return value;
                }
            }
        });
    }
}

// Abstract classes don't have a visible constructor type.
type AbstractClass = Function & { prototype: unknown };
type AbstractInstance<T extends AbstractClass> = T['prototype'];

// Short hand for a constructor which yields type T.
type ConstructorOf<T> = { new (...args: any[]): T };
