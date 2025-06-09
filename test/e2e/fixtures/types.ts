// Test types for diagnostic testing

export interface User {
    id: number;
    name: string;
    email?: string;
}

export interface BaseProps {
    id?: string;
    className?: string;
    children?: any; // ReactNode equivalent for testing
}

export interface ApiResponse<T> {
    data: T;
    status: number;
    message: string;
}

export type Theme = 'light' | 'dark' | 'auto';

export class SomeClass {
    public id: number;
    public name: string;
    
    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
    }
    
    toString(): string {
        return `${this.name} (${this.id})`;
    }
}