export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testPathIgnorePatterns: ['/node_modules/', '__tests__/setup\\.js'],
};
