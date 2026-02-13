#!/bin/bash
# Interactive version management script for TidyJS

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

show_header() {
  printf "${BLUE}╔════════════════════════════════════════════╗${NC}\n"
  printf "${BLUE}║        TidyJS Version Management           ║${NC}\n"
  printf "${BLUE}╚════════════════════════════════════════════╝${NC}\n"
  printf "\n"
}

# Get current version
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

# Parse version
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# If an argument is passed, use it directly
if [ "$1" == "patch" ] || [ "$1" == "minor" ] || [ "$1" == "major" ]; then
  VERSION_TYPE=$1
else
  # Interactive mode
  show_header

  printf "${YELLOW}Current version: ${GREEN}$CURRENT_VERSION${NC}\n"
  printf "\n"
  printf "Choose the version type to increment:\n"
  printf "\n"
  printf "${BLUE}1) Patch${NC} ($MAJOR.$MINOR.$PATCH → $MAJOR.$MINOR.$((PATCH + 1)))\n"
  printf "   └─ Bug fixes, small improvements\n"
  printf "\n"
  printf "${BLUE}2) Minor${NC} ($MAJOR.$MINOR.$PATCH → $MAJOR.$((MINOR + 1)).0)\n"
  printf "   └─ New features, significant improvements\n"
  printf "\n"
  printf "${BLUE}3) Major${NC} ($MAJOR.$MINOR.$PATCH → $((MAJOR + 1)).0.0)\n"
  printf "   └─ Breaking changes, major rework\n"
  printf "\n"
  printf "${BLUE}4) Cancel${NC}\n"
  printf "\n"

  read -p "Your choice (1-4): " choice

  case $choice in
    1) VERSION_TYPE="patch" ;;
    2) VERSION_TYPE="minor" ;;
    3) VERSION_TYPE="major" ;;
    4)
      printf "${YELLOW}Cancelled${NC}\n"
      exit 0
      ;;
    *)
      printf "${YELLOW}Invalid choice. Cancelled.${NC}\n"
      exit 1
      ;;
  esac
fi

# Calculate new version
case "$VERSION_TYPE" in
  "major")
    NEW_MAJOR=$((MAJOR + 1))
    NEW_MINOR=0
    NEW_PATCH=0
    ;;
  "minor")
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$((MINOR + 1))
    NEW_PATCH=0
    ;;
  "patch")
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$MINOR
    NEW_PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="$NEW_MAJOR.$NEW_MINOR.$NEW_PATCH"

printf "\n"
printf "${GREEN}► Updating version: $CURRENT_VERSION → $NEW_VERSION${NC}\n"

# Update package.json
if command -v jq &> /dev/null; then
  jq --arg version "$NEW_VERSION" '.version = $version' package.json > package.json.tmp
  mv package.json.tmp package.json
else
  sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
  rm -f package.json.bak
fi

printf "${GREEN}✓ Version updated in package.json${NC}\n"

# Ask to create commit and tag
printf "\n"
read -p "Create a Git commit and tag? (y/n) " -n 1 -r
printf "\n"

if [[ $REPLY =~ ^[Yy]$ ]]; then
  # Clean old .vsix files
  printf "${BLUE}► Cleaning old .vsix files...${NC}\n"
  rm -f *.vsix

  # Build the package
  printf "${BLUE}► Building package...${NC}\n"
  npm run build

  # Create commit
  git add package.json
  git commit -m "chore: bump version to $NEW_VERSION"
  printf "${GREEN}✓ Commit created${NC}\n"

  # Create tag
  git tag "v$NEW_VERSION"
  printf "${GREEN}✓ Tag v$NEW_VERSION created${NC}\n"

  # Ask to push
  printf "\n"
  read -p "Push changes to GitHub? (y/n) " -n 1 -r
  printf "\n"

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main
    git push origin "v$NEW_VERSION"
    printf "${GREEN}✓ Changes pushed to GitHub${NC}\n"
  else
    printf "${YELLOW}► Changes kept locally${NC}\n"
    printf "  To push later: git push origin main && git push origin v$NEW_VERSION\n"
  fi

  # Ask to publish to Marketplace
  printf "\n"
  read -p "Publish to VS Code Marketplace? (y/n) " -n 1 -r
  printf "\n"

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -z "$VSCE_PAT" ]; then
      printf "${YELLOW}✗ VSCE_PAT not set. Add it to .env or ~/.zshrc:${NC}\n"
      printf "  export VSCE_PAT=\"your-token\"\n"
      exit 1
    fi

    VSIX_FILE="tidyjs-${NEW_VERSION}.vsix"
    if [ ! -f "$VSIX_FILE" ]; then
      printf "${YELLOW}✗ File $VSIX_FILE not found${NC}\n"
      exit 1
    fi

    printf "${BLUE}► Publishing to Marketplace...${NC}\n"
    vsce publish --packagePath "$VSIX_FILE" -p "$VSCE_PAT"

    if [ $? -eq 0 ]; then
      printf "${GREEN}✓ TidyJS v$NEW_VERSION published to Marketplace${NC}\n"
    else
      printf "${YELLOW}✗ Publish failed. Upload manually: $VSIX_FILE${NC}\n"
      printf "  https://marketplace.visualstudio.com/manage/publishers/asmir\n"
    fi
  fi
else
  printf "${GREEN}✓ Version updated (no commit)${NC}\n"
  printf "  To commit manually: git add package.json && git commit -m \"chore: bump version to $NEW_VERSION\"\n"
fi

printf "\n"
printf "${GREEN}✨ Done!${NC}\n"
