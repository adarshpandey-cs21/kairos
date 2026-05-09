/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ["release"],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "docs", release: false },
          { type: "chore", release: false },
          { type: "style", release: false },
          { type: "test", release: false },
          { type: "ci", release: false },
          { type: "refactor", release: "patch" },
          { type: "perf", release: "patch" },
        ],
      },
    ],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
    ["@semantic-release/npm", { npmPublish: true }],
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
