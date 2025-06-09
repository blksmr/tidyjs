// Test class for diagnostic testing

export default class SomeClass {
    public id: number;
    public value: string;
    
    constructor(id: number, value: string) {
        this.id = id;
        this.value = value;
    }
    
    getValue(): string {
        return this.value;
    }
    
    static create(id: number, value: string): SomeClass {
        return new SomeClass(id, value);
    }
}