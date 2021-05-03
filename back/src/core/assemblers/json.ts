export abstract class JsonAssembler<T, U> {

    public abstract json(obj: T): U;

    public abstract object(json: U): T;

}
