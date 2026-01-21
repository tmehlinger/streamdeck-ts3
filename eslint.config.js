import { config } from '@elgato/eslint-config';

export default [
    {
        ignores: [
            'me.mehlinger.teamspeak3.sdPlugin/bin/**',
            'me.mehlinger.teamspeak3.sdPlugin/ui/**',
        ],
    },
    ...config.recommended,
    {
        rules: {
            indent: ['warn', 4, { ignoredNodes: ['TemplateLiteral *'], SwitchCase: 1 }],
            '@typescript-eslint/member-ordering': 'off',
            'jsdoc/require-returns': 'off',
        },
    },
];
