export class ImportParserError extends Error {
  constructor(message: string, public raw: string) {
    super(message);
    this.name = 'ImportParserError';
  }
}
