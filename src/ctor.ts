/**
 * @fileoverview Implementation of the `ctor<T>` concept. See tests for usage
 * examples.
 */

/** Represents a constructor of a value of type T. */
export class ctor<T> {
    private readonly ctor: ConstructorOf<T>;
    // Should be private, but needed by Extended<T>...
    public readonly params: unknown[];

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
     * @param ctor The class to construct.
     * @param params The parameters for the {@link ctor} constructor.
     */
    private constructor(ctor: ConstructorOf<T>, ...params: unknown[]) {
        this.ctor = ctor;
        this.params = params;
    }

    /** Constructs an instance of the concrete class T. */
    public construct(): T {
        return new this.ctor(...this.params);
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
    public static new<Clazz extends ConstructorOf<unknown>>(
        clazz: Clazz,
        ...params: ConstructorParams<typeof clazz>
    ): ctor<Instance<Clazz>> {
        return new ctor<Instance<Clazz>>(clazz, ...params);
    }

    /**
     * Creates a new `ctor<T>` for the given abstract class with its parameters.
     * You should prefer `ctor.new()` for all concrete classes (even super
     * classes) as it is more strongly typed.
     * 
     * Unfortunately, in TypeScript, abstract classes do not have constructors
     * which are accessible in the type system (because abstract classes do not
     * satisfy `{ new (...args: any[]) => any }` since they cannot be `new`-ed
     * with being extended). This means we have no way of knowing what the
     * appropriate parameter types are for a given abstract class. Instead, this
     * function acts as an alternative to `ctor.new()` except that the user must
     * explicitly provide the `Params` type, rather than automatically inferring
     * it from `Clazz`.
     */
    public static newAbstract<Clazz extends Class, Params extends unknown[]>(
            clazz: Clazz, ...params: Params): ctor<Instance<Clazz>> {
        // Must hard cast to a constructor type here knowing that `ctor` will do
        // the right thing, even though an abstract class cannot be `new`-ed.
        const abstractClazz =
                clazz as unknown as ConstructorOf<Instance<Clazz>>;
        return new ctor<Instance<Clazz>>(abstractClazz, ...params);
    }
}

/** Represents a `ctor<SuperClass>` to be extended by a `ctor<SubClass>`. */
class Extended<Parent> {
    public constructor(private readonly ctor: ctor<Parent>) { }

    /**
     * Creates a `ctor<Child>` by using the constructor parameters provided and
     * extending the `ctor<Parent>`.
     */
    public new<Child extends ConstructorOf<Parent>>(
        child: Child,
        ...params: SubclassParams<typeof child>
    ): ctor<Instance<Child>> {
        return ctor.new(child, ...[ this.ctor.params, ...params ] as any);
    }
}

/**
 * Sets up the provided `ctor<T>` of a parent class to be extended by a
 * `ctor<Child>`.
 */
export function from<T>(superCtor: ctor<T>): Extended<T> {
    return new Extended<T>(superCtor);
}

// Helper types.
type Class = Function & { prototype: unknown };
type Instance<T extends Class> = T['prototype'];
type ConstructorParams<T extends Class> =
        T extends new (...args: infer Params) => any
                ? Params : unknown[];
type SubclassParams<T extends Class> =
        ConstructorParams<T> extends [ infer _, ...infer Params ]
                ? Params : unknown[];
type ConstructorOf<T> = { new (...args: any[]): T };
