import { ConfigLoader } from '../../src/utils/configLoader';
import { logError, logDebug } from '../../src/utils/log';

jest.mock('../../src/utils/log');

const mockedLogError = logError as jest.MockedFunction<typeof logError>;
const mockedLogDebug = logDebug as jest.MockedFunction<typeof logDebug>;

describe('ConfigLoader Deprecation Warning', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should show deprecation warning for isDefault property', () => {
        const configWithIsDefault = {
            groups: [
                {
                    name: 'Misc',
                    order: 5,
                    priority: 10,
                    match: '^lodash$',
                    isDefault: true
                }
            ],
            format: {
                singleQuote: true,
                removeUnusedImports: false
            }
        };

        const result = ConfigLoader.convertFileConfigToConfig(configWithIsDefault);

        expect(mockedLogError).toHaveBeenCalledWith(
            'DEPRECATION WARNING: Group "Misc" in config file uses deprecated property "isDefault". Please use "default" instead. The "isDefault" property will be removed in a future version.'
        );
        expect(mockedLogDebug).toHaveBeenCalledWith(
            'Auto-migrating "isDefault" to "default" for group "Misc" in config file'
        );
        expect(result.groups![0].default).toBe(true);
    });

    it('should show warning when both isDefault and default are present', () => {
        const configWithBoth = {
            groups: [
                {
                    name: 'TestGroup',
                    order: 1,
                    match: '^test$',
                    isDefault: true,
                    default: false
                }
            ]
        };

        const result = ConfigLoader.convertFileConfigToConfig(configWithBoth);

        expect(mockedLogError).toHaveBeenCalledWith(
            'DEPRECATION WARNING: Group "TestGroup" in config file uses deprecated property "isDefault". Please use "default" instead. The "isDefault" property will be removed in a future version.'
        );
        expect(mockedLogError).toHaveBeenCalledWith(
            'Group "TestGroup" in config file has both "isDefault" and "default" properties. Using "default" value and ignoring "isDefault".'
        );
        expect(result.groups![0].default).toBe(false); // default should win
    });

    it('should NOT show warning when only default is present', () => {
        const configWithOnlyDefault = {
            groups: [
                {
                    name: 'TestGroup',
                    order: 1,
                    match: '^test$',
                    default: true
                }
            ]
        };

        const result = ConfigLoader.convertFileConfigToConfig(configWithOnlyDefault);

        expect(mockedLogError).not.toHaveBeenCalledWith(
            expect.stringContaining('DEPRECATION WARNING')
        );
        expect(result.groups![0].default).toBe(true);
    });

    it('should NOT show warning when neither isDefault nor default is present', () => {
        const configWithoutDefault = {
            groups: [
                {
                    name: 'TestGroup',
                    order: 1,
                    match: '^test$'
                }
            ]
        };

        const result = ConfigLoader.convertFileConfigToConfig(configWithoutDefault);

        expect(mockedLogError).not.toHaveBeenCalledWith(
            expect.stringContaining('DEPRECATION WARNING')
        );
        expect(result.groups![0].default).toBe(false); // should default to false
    });
});