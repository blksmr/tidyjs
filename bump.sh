#!/bin/bash
# This script is used to update the version in the package.json file
# and automatically create a Git tag for the release

# Help function
show_help() {
  echo "Usage: ./bump.sh [option]"
  echo "Options:"
  echo "  major    Increment the major version (X.0.0)"
  echo "  minor    Increment the minor version (0.X.0)"
  echo "  patch    Increment the patch version (0.0.X)"
  echo "  --help   Show this help"
  echo ""
  echo "If no option is specified, the patch version will be incremented by default."
}

# Check if help is requested
if [ "$1" == "--help" ]; then
  show_help
  exit 0
fi

# Get the current version from package.json
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

# Split the version into components
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# Determine which part of the version to increment
case "$1" in
  "major")
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  "minor")
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  "patch"|"")
    PATCH=$((PATCH + 1))
    ;;
  *)
    echo "Unrecognized option: $1"
    show_help
    exit 1
    ;;
esac

# Build the new version
NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo "Updating version: $CURRENT_VERSION -> $NEW_VERSION"

# Update the version in package.json
if command -v jq &> /dev/null; then
  # Use jq if available (better JSON manipulation)
  jq --arg version "$NEW_VERSION" '.version = $version' package.json > package.json.tmp
  mv package.json.tmp package.json
  echo "Version updated with jq"
else
  # Use sed as an alternative
  sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
  rm -f package.json.bak
  echo "Version updated with sed"
fi

echo "Version successfully updated: $NEW_VERSION"

# Delete any existing .vsix files
echo "Removing existing .vsix files..."
rm -f *.vsix

# Run npm build command to create a new .vsix file
echo "Building package..."
npm run build

# Create a Git commit with the new version and .vsix file
git add package.json *.vsix
git commit -m "Bump version to $NEW_VERSION"

# Create a Git tag for the new version
git tag "v$NEW_VERSION"

# Ask for confirmation before pushing
read -p "Do you want to push the commit and tag to GitHub? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  # Push the commit and tag
  git push origin main
  git push origin "v$NEW_VERSION"
  echo "Commit and tag successfully pushed. GitHub Actions will now create a release."
else
  echo "Commit and tag created locally. Use 'git push origin main && git push origin v$NEW_VERSION' to trigger the release creation."
fi
