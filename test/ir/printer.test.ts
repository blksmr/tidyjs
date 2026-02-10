import { measureTextWidth, measure, render } from '../../src/ir/printer';
import { text, hardLine, indent, concat, alignAnchor, alignGroup, doc } from '../../src/ir/builders';

describe('IR Printer', () => {
    describe('measureTextWidth', () => {
        it('should measure simple text', () => {
            expect(measureTextWidth(text('hello'))).toBe(5);
        });

        it('should measure empty text', () => {
            expect(measureTextWidth(text(''))).toBe(0);
        });

        it('should measure multiline text — only last line', () => {
            expect(measureTextWidth(text('first\nsecond\nab'))).toBe(2);
        });

        it('should measure concat nodes', () => {
            expect(measureTextWidth(concat(text('ab'), text('cd')))).toBe(4);
        });

        it('should measure indent nodes', () => {
            expect(measureTextWidth(indent(4, text('x')))).toBe(5);
        });

        it('should reset width after hardLine', () => {
            expect(measureTextWidth(concat(text('long'), hardLine(), text('ab')))).toBe(2);
        });

        it('should handle hardLine as zero width', () => {
            expect(measureTextWidth(hardLine())).toBe(0);
        });
    });

    describe('measure', () => {
        it('should collect anchors within the same group and resolve to max', () => {
            const document = doc([
                alignGroup('g1', [
                    alignAnchor('g1', text('import React '), text("from 'react';")),
                    hardLine(),
                    alignAnchor('g1', text('import { useState } '), text("from 'react';")),
                ]),
            ]);

            const resolved = measure(document);
            // 'import { useState } ' = 20 chars, 'import React ' = 13 chars → max = 20
            expect(resolved.get('g1')).toBe(20);
        });

        it('should keep separate groups independent', () => {
            const document = doc([
                alignGroup('g1', [
                    alignAnchor('g1', text('import React '), text("from 'react';")),
                ]),
                hardLine(),
                alignGroup('g2', [
                    alignAnchor('g2', text('import { veryLongSpecifierName } '), text("from './utils';")),
                ]),
            ]);

            const resolved = measure(document);
            expect(resolved.get('g1')).toBe(13);
            expect(resolved.get('g2')).toBe(33);
        });

        it('should use idealWidth when provided', () => {
            const document = doc([
                alignGroup('g1', [
                    alignAnchor('g1', text('import React '), text("from 'react';"), 25),
                    hardLine(),
                    alignAnchor('g1', text('import { useState } '), text("from 'react';")),
                ]),
            ]);

            const resolved = measure(document);
            // idealWidth=25 > measured 20 → 25
            expect(resolved.get('g1')).toBe(25);
        });

        it('should return empty map for documents with no anchors', () => {
            const document = doc([text('hello'), hardLine(), text('world')]);
            const resolved = measure(document);
            expect(resolved.size).toBe(0);
        });
    });

    describe('render', () => {
        it('should render simple text', () => {
            const resolved = new Map<string, number>();
            expect(render(text('hello'), resolved)).toBe('hello');
        });

        it('should render hardLine as newline', () => {
            const resolved = new Map<string, number>();
            expect(render(hardLine(), resolved)).toBe('\n');
        });

        it('should render concat', () => {
            const resolved = new Map<string, number>();
            expect(render(concat(text('a'), text('b')), resolved)).toBe('ab');
        });

        it('should render indent', () => {
            const resolved = new Map<string, number>();
            expect(render(indent(4, text('x')), resolved)).toBe('    x');
        });

        it('should pad single-line anchor to resolved column', () => {
            const resolved = new Map([['g1', 20]]);
            const node = alignAnchor('g1', text('import React '), text("from 'react';"));
            const result = render(node, resolved);
            expect(result).toBe("import React        from 'react';");
            // 'import React ' padded to 20 = 'import React        '
        });

        it('should pad multiline anchor on last line', () => {
            const resolved = new Map([['g1', 20]]);
            const prefix = text('import {\n    useState,\n    useEffect\n} ');
            const suffix = text("from 'react';");
            const node = alignAnchor('g1', prefix, suffix);
            const result = render(node, resolved);

            const lines = result.split('\n');
            expect(lines[0]).toBe('import {');
            expect(lines[1]).toBe('    useState,');
            expect(lines[2]).toBe('    useEffect');
            // Last line should have } padded to column 20
            expect(lines[3]).toMatch(/^\}\s+from 'react';$/);
            // Check that 'from' starts at column 20
            expect(lines[3].indexOf('from')).toBe(20);
        });

        it('should render document with all children', () => {
            const resolved = new Map<string, number>();
            const document = doc([text('line1'), hardLine(), text('line2'), hardLine()]);
            expect(render(document, resolved)).toBe('line1\nline2\n');
        });
    });
});
