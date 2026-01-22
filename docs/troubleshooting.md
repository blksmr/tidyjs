# Troubleshooting

## Common Issues

| Issue | Solution |
|-------|----------|
| Imports not formatting | Ensure file type is supported (.ts, .tsx, .js, .jsx) |
| Groups not matching | Verify regex patterns are valid and properly escaped |
| Configuration ignored | Check configuration hierarchy and file locations |
| Performance slow | Enable debug mode to identify bottlenecks |
| Mixed imports not separated | Update to version 1.5.0 or later |

## Configuration Validation

TidyJS provides comprehensive validation with helpful error messages:

```
Configuration Error Examples:
- "Multiple groups marked as default: React, Utils"
- "Invalid regex pattern in group 'External': Unterminated character class"
- "Duplicate group names found: Internal, Internal"
- "Invalid sortOrder in group 'React': array cannot be empty"
```

## Error Recovery

TidyJS handles errors gracefully:

- **Malformed Imports**: Continues processing valid imports even with syntax errors
- **Invalid Regex**: Falls back to string matching for invalid patterns
- **Missing Modules**: Optional removal of imports from non-existent packages
- **Parse Errors**: Detailed error reporting with line numbers and context

## Debug Mode

Enable comprehensive logging:

```json
{
  "tidyjs.debug": true
}
```

### Debug Output Example

```
[TidyJS] Configuration loaded: 4 groups, 0 excluded folders
[TidyJS] Parsing document: 23 imports found
[TidyJS] Mixed import separated: React, { useState, type FC }
[TidyJS] Groups created: React (3), External (8), Internal (12)
[TidyJS] Formatting completed in 12.3ms
```

## Viewing Debug Output

1. Open VS Code Output panel: **View > Output**
2. Select **TidyJS** from the dropdown
3. Review validation and processing messages

## Getting Help

1. **Enable Debug Mode**: Set `tidyjs.debug: true`
2. **Check Output Panel**: View > Output > Select "TidyJS"
3. **Review Configuration**: Validate your `.tidyjsrc` or settings
4. **GitHub Issues**: Report bugs at [github.com/asmirbe/tidyjs](https://github.com/asmirbe/tidyjs)
