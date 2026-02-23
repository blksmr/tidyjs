#!/bin/bash
# Version management script for TidyJS
# Usage:
#   ./scripts/bump.sh                  Interactive mode
#   ./scripts/bump.sh minor            Ask version type, prompt for git/publish
#   ./scripts/bump.sh minor --yes      Fully non-interactive: bump + build + commit + tag + push + publish

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Parse flags
VERSION_TYPE=""
AUTO_YES=false

for arg in "$@"; do
  case "$arg" in
    patch|minor|major) VERSION_TYPE="$arg" ;;
    --yes|-y) AUTO_YES=true ;;
  esac
done

confirm() {
  if [ "$AUTO_YES" = true ]; then
    return 0
  fi
  read -p "$1 (y/n) " -n 1 -r
  printf "\n"
  [[ $REPLY =~ ^[Yy]$ ]]
}

show_header() {
  printf "${BLUE}╔════════════════════════════════════════════╗${NC}\n"
  printf "${BLUE}║        TidyJS Version Management           ║${NC}\n"
  printf "${BLUE}╚════════════════════════════════════════════╝${NC}\n"
  printf "\n"
}

# Get current version
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# If no version type provided, ask interactively
if [ -z "$VERSION_TYPE" ]; then
  show_header

  printf "${YELLOW}Current version: ${GREEN}$CURRENT_VERSION${NC}\n\n"
  printf "Choose the version type to increment:\n\n"
  printf "${BLUE}1) Patch${NC} ($MAJOR.$MINOR.$PATCH → $MAJOR.$MINOR.$((PATCH + 1)))\n"
  printf "   └─ Bug fixes, small improvements\n\n"
  printf "${BLUE}2) Minor${NC} ($MAJOR.$MINOR.$PATCH → $MAJOR.$((MINOR + 1)).0)\n"
  printf "   └─ New features, significant improvements\n\n"
  printf "${BLUE}3) Major${NC} ($MAJOR.$MINOR.$PATCH → $((MAJOR + 1)).0.0)\n"
  printf "   └─ Breaking changes, major rework\n\n"
  printf "${BLUE}4) Cancel${NC}\n\n"

  read -p "Your choice (1-4): " choice

  case $choice in
    1) VERSION_TYPE="patch" ;;
    2) VERSION_TYPE="minor" ;;
    3) VERSION_TYPE="major" ;;
    *)
      printf "${YELLOW}Cancelled${NC}\n"
      exit 0
      ;;
  esac
fi

# Calculate new version
case "$VERSION_TYPE" in
  "major") NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  "minor") NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
  "patch") NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
esac

printf "\n${GREEN}► Updating version: $CURRENT_VERSION → $NEW_VERSION${NC}\n"

# Update package.json
if command -v jq &> /dev/null; then
  jq --arg version "$NEW_VERSION" '.version = $version' package.json > package.json.tmp
  mv package.json.tmp package.json
else
  sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
  rm -f package.json.bak
fi

printf "${GREEN}✓ Version updated in package.json${NC}\n"

# Git commit, tag, push, publish
if confirm "Build, commit, tag, push, and publish?"; then
  # Clean old .vsix files
  printf "${BLUE}► Cleaning old .vsix files...${NC}\n"
  rm -f *.vsix

  # Build
  printf "${BLUE}► Building package...${NC}\n"
  npm run build

  VSIX_FILE="tidyjs-${NEW_VERSION}.vsix"
  if [ ! -f "$VSIX_FILE" ]; then
    printf "${RED}✗ Build failed: $VSIX_FILE not found${NC}\n"
    exit 1
  fi

  # Commit + tag
  git add package.json
  git commit -m "chore: bump version to $NEW_VERSION"
  git tag "v$NEW_VERSION"
  printf "${GREEN}✓ Commit + tag v$NEW_VERSION created${NC}\n"

  # Push
  if confirm "Push to GitHub?"; then
    git push origin main && git push origin "v$NEW_VERSION"
    printf "${GREEN}✓ Pushed to GitHub${NC}\n"
  else
    printf "${YELLOW}► Kept locally. Push later: git push origin main && git push origin v$NEW_VERSION${NC}\n"
  fi

  # Publish (delegates to publish.mjs which handles .env + vsce)
  if confirm "Publish to VS Code Marketplace?"; then
    printf "${BLUE}► Publishing to Marketplace...${NC}\n"
    node scripts/publish.mjs

    if [ $? -eq 0 ]; then
      printf "${GREEN}✓ TidyJS v$NEW_VERSION published${NC}\n"
    else
      printf "${RED}✗ Publish failed. Upload manually: $VSIX_FILE${NC}\n"
      printf "  https://marketplace.visualstudio.com/manage/publishers/asmir\n"
      exit 1
    fi
  fi
else
  printf "${GREEN}✓ Version updated (no commit)${NC}\n"
  printf "  To continue manually: git add package.json && git commit -m \"chore: bump version to $NEW_VERSION\"\n"
fi

printf "\n${GREEN}✨ Done!${NC}\n"
